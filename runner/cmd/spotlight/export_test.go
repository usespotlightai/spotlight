package main

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func exporting(t *testing.T, files []exportedFile) *[]string {
	t.Helper()
	asked := []string{}

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		asked = append(asked, r.URL.RequestURI())

		if r.Header.Get(clientHeader) != "cli/"+version {
			w.WriteHeader(http.StatusBadRequest)
			_, _ = w.Write([]byte(`{"title":"Unnamed client","detail":"Spotlight-Client names no cli"}`))
			return
		}

		if r.Header.Get("Authorization") != "Bearer q3Vd0n8yXbT2c4kPzR7mW1sLhA9eJ5gUfN6oYiC0xEw" {
			w.Header().Set("Content-Type", "application/problem+json")
			w.WriteHeader(http.StatusUnauthorized)
			_, _ = w.Write([]byte(`{"title":"No valid credentials","detail":"Unauthorized"}`))
			return
		}

		switch r.URL.Path {
		case "/api/resources/workspaces/import":
			if r.URL.Query().Get("address") != "acme" {
				w.WriteHeader(http.StatusNotFound)
				_, _ = w.Write([]byte(`{"title":"No such resource","detail":"No such workspace that you may see"}`))
				return
			}
			_, _ = w.Write([]byte(`{"id":"ws_1","slug":"acme"}`))
		case "/api/resources/workspaces/ws_1/export":
			_ = json.NewEncoder(w).Encode(map[string]any{"files": files})
		default:
			w.WriteHeader(http.StatusNotFound)
		}
	}))
	t.Cleanup(server.Close)

	t.Setenv(exportURLVar, server.URL+"/")
	t.Setenv(exportTokenVar, "q3Vd0n8yXbT2c4kPzR7mW1sLhA9eJ5gUfN6oYiC0xEw")

	return &asked
}

func TestExportWritesEveryFileTheWorkspaceAnswers(t *testing.T) {
	exporting(t, []exportedFile{
		{Path: "main.tf", Content: "terraform {}\n"},
		{Path: "prompts/core/delivery/implementation.md", Content: "Implement it.\n\n"},
		{Path: "skills/core/grafana/SKILL.md", Content: "---\nname: grafana\n---\n"},
		{Path: "variables.tf", Content: "variable \"secret_linear_api_key\" {}\n"},
	})
	dir := t.TempDir()
	out := new(bytes.Buffer)

	if err := run([]string{"export", "--workspace", "acme", "--out", dir}, strings.NewReader(""), out); err != nil {
		t.Fatalf("run: %v", err)
	}

	for path, want := range map[string]string{
		"main.tf": "terraform {}\n",
		"prompts/core/delivery/implementation.md": "Implement it.\n\n",
		"skills/core/grafana/SKILL.md":            "---\nname: grafana\n---\n",
		"variables.tf":                            "variable \"secret_linear_api_key\" {}\n",
	} {
		got, err := os.ReadFile(filepath.Join(dir, filepath.FromSlash(path)))
		if err != nil {
			t.Fatalf("read %s: %v", path, err)
		}
		if string(got) != want {
			t.Fatalf("%s holds %q, want %q", path, got, want)
		}
	}

	if !strings.Contains(out.String(), "4 files") {
		t.Fatalf("receipt %q does not count the files", out.String())
	}
}

func TestExportFindsTheWorkspaceBySlug(t *testing.T) {
	asked := exporting(t, []exportedFile{{Path: "main.tf", Content: ""}})

	if err := run([]string{"export", "--workspace", "acme", "--out", t.TempDir()}, strings.NewReader(""), new(bytes.Buffer)); err != nil {
		t.Fatalf("run: %v", err)
	}

	want := []string{
		"/api/resources/workspaces/import?address=acme",
		"/api/resources/workspaces/ws_1/export",
	}
	if strings.Join(*asked, " ") != strings.Join(want, " ") {
		t.Fatalf("asked %v, want %v", *asked, want)
	}
}

func TestExportRefusesAFileOutsideTheDirectory(t *testing.T) {
	exporting(t, []exportedFile{
		{Path: "main.tf", Content: "terraform {}\n"},
		{Path: "../escaped.tf", Content: "nope"},
	})
	parent := t.TempDir()
	dir := filepath.Join(parent, "module")

	err := run([]string{"export", "--workspace", "acme", "--out", dir}, strings.NewReader(""), new(bytes.Buffer))
	if err == nil || !strings.Contains(err.Error(), "refusing") {
		t.Fatalf("err = %v, want a refusal", err)
	}

	if _, statErr := os.Stat(filepath.Join(parent, "escaped.tf")); !os.IsNotExist(statErr) {
		t.Fatalf("wrote outside the directory")
	}
	if _, statErr := os.Stat(filepath.Join(dir, "main.tf")); !os.IsNotExist(statErr) {
		t.Fatalf("wrote part of a refused export")
	}
}

func TestExportRefusesAFileItDoesNotOwn(t *testing.T) {
	exporting(t, []exportedFile{
		{Path: "main.tf", Content: "terraform {}\n"},
		{Path: "outputs.tf", Content: "nope"},
	})
	dir := t.TempDir()

	err := run([]string{"export", "--workspace", "acme", "--out", dir}, strings.NewReader(""), new(bytes.Buffer))
	if err == nil || !strings.Contains(err.Error(), "refusing") {
		t.Fatalf("err = %v, want a refusal", err)
	}
	if _, statErr := os.Stat(filepath.Join(dir, "outputs.tf")); !os.IsNotExist(statErr) {
		t.Fatalf("wrote a file export does not own")
	}
}

func TestExportSaysWhatSpotlightRefused(t *testing.T) {
	exporting(t, nil)

	err := run([]string{"export", "--workspace", "nowhere"}, strings.NewReader(""), new(bytes.Buffer))
	if err == nil || !strings.Contains(err.Error(), "No such workspace that you may see") {
		t.Fatalf("err = %v, want Spotlight's reason", err)
	}
}

func TestExportNeedsWhereAndWhoFrom(t *testing.T) {
	t.Setenv(exportURLVar, "")
	t.Setenv(exportTokenVar, "")

	err := run([]string{"export", "--workspace", "acme"}, strings.NewReader(""), new(bytes.Buffer))
	if err == nil || !strings.Contains(err.Error(), exportTokenVar) {
		t.Fatalf("err = %v, want it to name %s", err, exportTokenVar)
	}

	if err := run([]string{"export"}, strings.NewReader(""), new(bytes.Buffer)); err == nil ||
		!strings.Contains(err.Error(), "--workspace is required") {
		t.Fatalf("err = %v, want --workspace required", err)
	}
}

func TestExportReplacesOnlyWhatItOwns(t *testing.T) {
	exporting(t, []exportedFile{
		{Path: "main.tf", Content: "terraform {}\n"},
		{Path: "prompts/core/delivery/implementation.md", Content: "Implement it."},
	})
	dir := t.TempDir()
	for path, content := range map[string]string{
		"main.tf":                       "old\n",
		"prompts/core/delivery/spec.md": "a station since removed",
		"skills/core/gone/SKILL.md":     "a skill since removed",
		"variables.tf":                  "variable \"x\" {}\n",
		"outputs.tf":                    "output \"x\" {}\n",
		"modules/extra/main.tf":         "kept\n",
		"notes/prompts/keep.md":         "kept\n",
	} {
		at := filepath.Join(dir, filepath.FromSlash(path))
		if err := os.MkdirAll(filepath.Dir(at), 0o755); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(at, []byte(content), 0o644); err != nil {
			t.Fatal(err)
		}
	}

	if err := run([]string{"export", "--workspace", "acme", "--out", dir}, strings.NewReader(""), new(bytes.Buffer)); err != nil {
		t.Fatalf("run: %v", err)
	}

	for _, gone := range []string{"prompts/core/delivery/spec.md", "skills", "variables.tf"} {
		if _, err := os.Stat(filepath.Join(dir, filepath.FromSlash(gone))); !os.IsNotExist(err) {
			t.Fatalf("%s is stale but still there", gone)
		}
	}
	for path, want := range map[string]string{
		"main.tf": "terraform {}\n",
		"prompts/core/delivery/implementation.md": "Implement it.",
		"outputs.tf":            "output \"x\" {}\n",
		"modules/extra/main.tf": "kept\n",
		"notes/prompts/keep.md": "kept\n",
	} {
		got, err := os.ReadFile(filepath.Join(dir, filepath.FromSlash(path)))
		if err != nil || string(got) != want {
			t.Fatalf("%s holds %q (%v), want %q", path, got, err, want)
		}
	}
}

func TestExportCallsWithTheTokenAsItIsAndNamesItselfTheCli(t *testing.T) {
	var authorization, client string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		authorization, client = r.Header.Get("Authorization"), r.Header.Get(clientHeader)
		w.WriteHeader(http.StatusNotFound)
	}))
	t.Cleanup(server.Close)
	t.Setenv(exportURLVar, server.URL)
	t.Setenv(exportTokenVar, "any-token-without-a-prefix")

	_ = run([]string{"export", "--workspace", "acme", "--out", t.TempDir()}, strings.NewReader(""), new(bytes.Buffer))

	if authorization != "Bearer any-token-without-a-prefix" {
		t.Fatalf("Authorization = %q", authorization)
	}
	if client != "cli/"+version {
		t.Fatalf("%s = %q, want cli/%s", clientHeader, client, version)
	}
}
