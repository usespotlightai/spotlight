package v2_test

import (
	"os"
	"path/filepath"
	"testing"
)

func pretend(t *testing.T, script string) string {
	t.Helper()

	path := filepath.Join(t.TempDir(), "harness")
	if err := os.WriteFile(path, []byte("#!/usr/bin/env node\n"+script), 0o755); err != nil {
		t.Fatal(err)
	}

	return path
}
