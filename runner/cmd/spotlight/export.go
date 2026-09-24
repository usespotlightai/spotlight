package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"
)

const (
	exportURLVar   = "SPOTLIGHT_URL"
	exportTokenVar = "SPOTLIGHT_API_TOKEN"
	clientHeader   = "Spotlight-Client"
)

var exportOwns = []string{"main.tf", "variables.tf", "prompts", "skills"}

const exportUsage = `usage:
  spotlight export --workspace <slug> [--out <dir>]

Writes main.tf, with an import block beside each resource; variables.tf, with a
sensitive variable for each secret value and runner token Spotlight never
answers; and the prompt and skill files main.tf reads, for everything in the
workspace. It replaces main.tf, variables.tf, prompts/ and skills/ under --out,
and leaves everything else there alone. Reads SPOTLIGHT_URL, and
SPOTLIGHT_API_TOKEN, a workspace token allowed at least to read.`

type exportedFile struct {
	Path    string `json:"path"`
	Content string `json:"content"`
}

type problem struct {
	Title  string `json:"title"`
	Detail string `json:"detail"`
}

func exportCmd(args []string, out io.Writer) error {
	flags := flag.NewFlagSet("export", flag.ContinueOnError)
	flags.SetOutput(io.Discard)
	workspace := flags.String("workspace", "", "the slug of the workspace to export")
	dir := flags.String("out", ".", "the directory to write the Terraform into")

	if err := flags.Parse(args); err != nil {
		return fmt.Errorf("%s", exportUsage)
	}
	if strings.TrimSpace(*workspace) == "" {
		return fmt.Errorf("--workspace is required\n%s", exportUsage)
	}

	base, token := os.Getenv(exportURLVar), os.Getenv(exportTokenVar)
	if base == "" || token == "" {
		return fmt.Errorf("set %s and %s to export\n%s", exportURLVar, exportTokenVar, exportUsage)
	}

	var found struct {
		ID string `json:"id"`
	}
	if err := getJSON(
		base, token,
		"/api/resources/workspaces/import?address="+url.QueryEscape(*workspace),
		&found,
	); err != nil {
		return fmt.Errorf("find workspace %s: %w", *workspace, err)
	}

	var exported struct {
		Files []exportedFile `json:"files"`
	}
	if err := getJSON(
		base, token,
		"/api/resources/workspaces/"+url.PathEscape(found.ID)+"/export",
		&exported,
	); err != nil {
		return fmt.Errorf("export workspace %s: %w", *workspace, err)
	}

	if err := writeExport(*dir, exported.Files); err != nil {
		return err
	}

	fmt.Fprintf(
		out,
		"Exported %s to %s: %d files. Run terraform init, then terraform plan to adopt it.\n",
		*workspace, *dir, len(exported.Files),
	)

	return nil
}

func owns(path string) bool {
	for _, owned := range exportOwns {
		if path == owned || strings.HasPrefix(path, owned+"/") {
			return true
		}
	}

	return false
}

func writeExport(dir string, files []exportedFile) error {
	for _, file := range files {
		if !filepath.IsLocal(filepath.FromSlash(file.Path)) || !owns(file.Path) {
			return fmt.Errorf("refusing to write %q outside what export owns in %s", file.Path, dir)
		}
	}

	for _, owned := range exportOwns {
		if err := os.RemoveAll(filepath.Join(dir, owned)); err != nil {
			return fmt.Errorf("clear %s: %w", filepath.Join(dir, owned), err)
		}
	}

	for _, file := range files {
		path := filepath.Join(dir, filepath.FromSlash(file.Path))

		if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
			return fmt.Errorf("make %s: %w", filepath.Dir(path), err)
		}
		if err := os.WriteFile(path, []byte(file.Content), 0o644); err != nil {
			return fmt.Errorf("write %s: %w", path, err)
		}
	}

	return nil
}

func getJSON(base, token, path string, into any) error {
	request, err := http.NewRequest(
		http.MethodGet, strings.TrimSuffix(base, "/")+path, nil,
	)
	if err != nil {
		return err
	}
	request.Header.Set("Authorization", "Bearer "+token)
	request.Header.Set("Accept", "application/json")
	request.Header.Set(clientHeader, "cli/"+version)

	response, err := client.Do(request)
	if err != nil {
		return fmt.Errorf("reach Spotlight: %w", err)
	}
	defer response.Body.Close()

	body, err := io.ReadAll(response.Body)
	if err != nil {
		return fmt.Errorf("read Spotlight's answer: %w", err)
	}

	if response.StatusCode >= 300 {
		var said problem
		if json.Unmarshal(body, &said) == nil {
			switch {
			case said.Detail != "":
				return fmt.Errorf("%s", said.Detail)
			case said.Title != "":
				return fmt.Errorf("%s", said.Title)
			}
		}

		return fmt.Errorf("Spotlight answered %s", response.Status)
	}

	if err := json.Unmarshal(body, into); err != nil {
		return fmt.Errorf("Spotlight answered with %q", string(body))
	}

	return nil
}
