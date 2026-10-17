package archive_test

import (
	"archive/tar"
	"bytes"
	"compress/gzip"
	"os"
	"path/filepath"
	"testing"
	"time"

	"usespotlight.ai/data-plane/runner/internal/archive"
)

func write(t *testing.T, path, content string, mode os.FileMode) {
	t.Helper()

	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(path, []byte(content), mode); err != nil {
		t.Fatal(err)
	}
}

func packed(t *testing.T, dir string) *archive.Packed {
	t.Helper()

	kept, err := archive.Pack(dir, t.TempDir(), nil)
	if err != nil {
		t.Fatalf("pack: %v", err)
	}
	return kept
}

func unpacked(t *testing.T, kept *archive.Packed) string {
	t.Helper()

	into := t.TempDir()
	file, err := os.Open(kept.Path)
	if err != nil {
		t.Fatal(err)
	}
	defer file.Close()

	if err := archive.Unpack(file, into); err != nil {
		t.Fatalf("unpack: %v", err)
	}
	return into
}

func TestKeepsFilesFoldersModesAndLinksAsTheyWere(t *testing.T) {
	dir := t.TempDir()
	write(t, filepath.Join(dir, "repo", "main.go"), "package main\n", 0o644)
	write(t, filepath.Join(dir, "repo", "run.sh"), "#!/bin/sh\n", 0o755)
	write(t, filepath.Join(dir, ".spotlight", "state", "claude", "session.jsonl"), "{}\n", 0o600)
	if err := os.MkdirAll(filepath.Join(dir, "empty"), 0o750); err != nil {
		t.Fatal(err)
	}
	if err := os.Symlink("repo/main.go", filepath.Join(dir, "entry")); err != nil {
		t.Fatal(err)
	}
	when := time.Date(2026, 9, 1, 12, 0, 0, 0, time.UTC)
	if err := os.Chtimes(filepath.Join(dir, "repo", "main.go"), when, when); err != nil {
		t.Fatal(err)
	}

	into := unpacked(t, packed(t, dir))

	for name, want := range map[string]string{
		"repo/main.go":                          "package main\n",
		".spotlight/state/claude/session.jsonl": "{}\n",
		"entry":                                 "package main\n",
	} {
		got, err := os.ReadFile(filepath.Join(into, name))
		if err != nil || string(got) != want {
			t.Errorf("%s: %q, %v", name, got, err)
		}
	}

	for name, want := range map[string]os.FileMode{"repo/run.sh": 0o755, "repo/main.go": 0o644, "empty": 0o750} {
		info, err := os.Stat(filepath.Join(into, name))
		if err != nil || info.Mode().Perm() != want {
			t.Errorf("%s: mode %v, %v", name, info.Mode().Perm(), err)
		}
	}

	if link, err := os.Readlink(filepath.Join(into, "entry")); err != nil || link != "repo/main.go" {
		t.Errorf("the link points at %q, %v", link, err)
	}

	info, err := os.Stat(filepath.Join(into, "repo", "main.go"))
	if err != nil || !info.ModTime().Equal(when) {
		t.Errorf("modified %v, wanted %v", info.ModTime(), when)
	}
}

func TestSaysWhatItPackedAndHowBig(t *testing.T) {
	dir := t.TempDir()
	write(t, filepath.Join(dir, "notes.md"), "halfway\n", 0o644)

	kept := packed(t, dir)
	info, err := os.Stat(kept.Path)

	if err != nil || info.Size() != kept.Size || len(kept.SHA256) != 64 {
		t.Errorf("packed %d bytes, said %d, sha %q", info.Size(), kept.Size, kept.SHA256)
	}

	if err := kept.Remove(); err != nil {
		t.Errorf("remove: %v", err)
	}
}

func crafted(t *testing.T, entries ...tar.Header) *bytes.Buffer {
	t.Helper()

	var buffer bytes.Buffer
	zipped := gzip.NewWriter(&buffer)
	written := tar.NewWriter(zipped)

	for _, entry := range entries {
		header := entry
		if header.Typeflag == tar.TypeReg {
			header.Size = 2
		}
		if err := written.WriteHeader(&header); err != nil {
			t.Fatal(err)
		}
		if header.Typeflag == tar.TypeReg {
			if _, err := written.Write([]byte("hi")); err != nil {
				t.Fatal(err)
			}
		}
	}
	if err := written.Close(); err != nil {
		t.Fatal(err)
	}
	if err := zipped.Close(); err != nil {
		t.Fatal(err)
	}

	return &buffer
}

func TestRejectsAnythingThatReachesOutsideTheWorkspace(t *testing.T) {
	outside := t.TempDir()

	cases := map[string][]tar.Header{
		"a climb out":      {{Name: "../escaped", Typeflag: tar.TypeReg, Mode: 0o644}},
		"an absolute path": {{Name: filepath.Join(outside, "escaped"), Typeflag: tar.TypeReg, Mode: 0o644}},
		"a write through a link out": {
			{Name: "door", Typeflag: tar.TypeSymlink, Linkname: outside},
			{Name: "door/escaped", Typeflag: tar.TypeReg, Mode: 0o644},
		},
	}

	for name, entries := range cases {
		t.Run(name, func(t *testing.T) {
			err := archive.Unpack(crafted(t, entries...), t.TempDir())

			if err == nil {
				t.Error("unpacked it")
			}
			if _, statErr := os.Stat(filepath.Join(outside, "escaped")); !os.IsNotExist(statErr) {
				t.Error("wrote outside the workspace")
			}
		})
	}
}

func TestFingerprintChangesOnlyWithTheWorkspace(t *testing.T) {
	dir := t.TempDir()
	write(t, filepath.Join(dir, "notes.md"), "halfway\n", 0o644)

	before, err := archive.Fingerprint(dir, nil)
	if err != nil {
		t.Fatal(err)
	}
	again, _ := archive.Fingerprint(dir, nil)
	if before != again {
		t.Error("the same workspace took two fingerprints")
	}

	write(t, filepath.Join(dir, "notes.md"), "finished\n", 0o644)
	after, _ := archive.Fingerprint(dir, nil)

	if before == after {
		t.Error("a changed workspace kept its fingerprint")
	}
}

func TestRestoresAFolderThatAllowsNoWriting(t *testing.T) {
	dir := t.TempDir()
	write(t, filepath.Join(dir, "cache", "module", "go.mod"), "module x\n", 0o444)
	for _, locked := range []string{filepath.Join(dir, "cache", "module"), filepath.Join(dir, "cache")} {
		if err := os.Chmod(locked, 0o555); err != nil {
			t.Fatal(err)
		}
	}
	t.Cleanup(func() { _ = os.Chmod(filepath.Join(dir, "cache"), 0o755) })
	t.Cleanup(func() { _ = os.Chmod(filepath.Join(dir, "cache", "module"), 0o755) })

	into := unpacked(t, packed(t, dir))
	t.Cleanup(func() {
		_ = os.Chmod(filepath.Join(into, "cache"), 0o755)
		_ = os.Chmod(filepath.Join(into, "cache", "module"), 0o755)
	})

	got, err := os.ReadFile(filepath.Join(into, "cache", "module", "go.mod"))
	if err != nil || string(got) != "module x\n" {
		t.Errorf("go.mod: %q, %v", got, err)
	}
	info, err := os.Stat(filepath.Join(into, "cache"))
	if err != nil || info.Mode().Perm() != 0o555 {
		t.Errorf("cache: mode %v, %v", info.Mode().Perm(), err)
	}
}

func TestKeepsALinkOutOfTheWorkspaceAsALinkAndNeverWhatItPointsAt(t *testing.T) {
	secret := filepath.Join(t.TempDir(), "token")
	write(t, secret, "do-not-pack", 0o600)

	dir := t.TempDir()
	if err := os.Symlink(secret, filepath.Join(dir, "token")); err != nil {
		t.Fatal(err)
	}

	kept := packed(t, dir)
	file, err := os.Open(kept.Path)
	if err != nil {
		t.Fatal(err)
	}
	defer file.Close()
	unzipped, err := gzip.NewReader(file)
	if err != nil {
		t.Fatal(err)
	}
	var contents bytes.Buffer
	if _, err := contents.ReadFrom(unzipped); err != nil {
		t.Fatal(err)
	}

	if bytes.Contains(contents.Bytes(), []byte("do-not-pack")) {
		t.Error("packed what the link points at")
	}

	into := unpacked(t, kept)
	if link, err := os.Readlink(filepath.Join(into, "token")); err != nil || link != secret {
		t.Errorf("the link points at %q, %v", link, err)
	}
}

func TestLeavesOutWhatIsRebuiltElsewhere(t *testing.T) {
	dir := t.TempDir()
	write(t, filepath.Join(dir, "acme", "api", "main.go"), "package main\n", 0o644)
	write(t, filepath.Join(dir, "acme", "api", "node_modules", "x", "index.js"), "installed\n", 0o644)
	write(t, filepath.Join(dir, "acme", "api", "debug.log"), "noise\n", 0o644)

	kept, err := archive.Pack(dir, t.TempDir(), []string{"acme/api/node_modules", "acme/api/debug.log"})
	if err != nil {
		t.Fatalf("pack: %v", err)
	}
	into := unpacked(t, kept)

	if _, err := os.Stat(filepath.Join(into, "acme", "api", "main.go")); err != nil {
		t.Errorf("the checkout was left out: %v", err)
	}
	for _, left := range []string{"acme/api/node_modules", "acme/api/debug.log"} {
		if _, err := os.Stat(filepath.Join(into, left)); !os.IsNotExist(err) {
			t.Errorf("%s was packed", left)
		}
	}
}

func TestUnpacksOverWhatIsAlreadyThere(t *testing.T) {
	dir := t.TempDir()
	write(t, filepath.Join(dir, "notes.md"), "kept\n", 0o644)
	if err := os.Symlink("notes.md", filepath.Join(dir, "entry")); err != nil {
		t.Fatal(err)
	}
	kept := packed(t, dir)

	into := t.TempDir()
	write(t, filepath.Join(into, "entry"), "a file the image laid down\n", 0o644)
	if err := os.Symlink("elsewhere", filepath.Join(into, "notes.md")); err != nil {
		t.Fatal(err)
	}

	file, err := os.Open(kept.Path)
	if err != nil {
		t.Fatal(err)
	}
	defer file.Close()
	if err := archive.Unpack(file, into); err != nil {
		t.Fatalf("unpack: %v", err)
	}

	if got, err := os.ReadFile(filepath.Join(into, "notes.md")); err != nil || string(got) != "kept\n" {
		t.Errorf("notes.md contains %q: %v", got, err)
	}
	if link, err := os.Readlink(filepath.Join(into, "entry")); err != nil || link != "notes.md" {
		t.Errorf("entry links to %q: %v", link, err)
	}
}
