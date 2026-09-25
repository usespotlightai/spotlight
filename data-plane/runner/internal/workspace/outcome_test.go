package workspace_test

import (
	"os"
	"path/filepath"
	"testing"

	"usespotlight.ai/data-plane/runner/internal/workspace"
)

func write(t *testing.T, dir, body string) {
	t.Helper()

	if err := os.MkdirAll(filepath.Join(dir, ".spotlight"), 0o700); err != nil {
		t.Fatalf("make the outcome directory: %v", err)
	}
	path := filepath.Join(dir, workspace.OutcomePath)
	if err := os.WriteFile(path, []byte(body), 0o600); err != nil {
		t.Fatalf("write the outcome: %v", err)
	}
}

func TestOutcomeReadsWhatTheAgentLeft(t *testing.T) {
	space, err := workspace.Create(t.TempDir(), "run_1")
	if err != nil {
		t.Fatalf("create the workspace: %v", err)
	}

	write(t, space.Dir, `{"next":"Spec","note":"Reproduced on restart."}`)

	spoken := space.Outcome()
	if spoken == nil {
		t.Fatal("expected an outcome, got none")
	}
	if spoken.Next != "Spec" || spoken.Note != "Reproduced on restart." {
		t.Fatalf("read back %+v", spoken)
	}
}

func TestOutcomeIsNothingWhenTheAgentSaidNothing(t *testing.T) {
	space, err := workspace.Create(t.TempDir(), "run_2")
	if err != nil {
		t.Fatalf("create the workspace: %v", err)
	}

	if spoken := space.Outcome(); spoken != nil {
		t.Fatalf("expected nothing, got %+v", spoken)
	}
}

func TestOutcomeIsNothingWhenItCannotBeRead(t *testing.T) {
	space, err := workspace.Create(t.TempDir(), "run_3")
	if err != nil {
		t.Fatalf("create the workspace: %v", err)
	}

	write(t, space.Dir, `not json at all`)

	if spoken := space.Outcome(); spoken != nil {
		t.Fatalf("expected nothing, got %+v", spoken)
	}
}

func TestOutcomeIsNothingWhenItNamesNowhere(t *testing.T) {
	space, err := workspace.Create(t.TempDir(), "run_4")
	if err != nil {
		t.Fatalf("create the workspace: %v", err)
	}

	write(t, space.Dir, `{"note":"I did some things."}`)

	if spoken := space.Outcome(); spoken != nil {
		t.Fatalf("expected nothing, got %+v", spoken)
	}
}
