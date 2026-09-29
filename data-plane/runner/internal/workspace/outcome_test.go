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
	space, err := workspace.Open(t.TempDir())
	if err != nil {
		t.Fatalf("create the workspace: %v", err)
	}

	write(t, space.Dir, `{"next":"Spec","note":"Reproduced on restart."}`)

	spoken := space.TakeOutcome()
	if spoken == nil {
		t.Fatal("expected an outcome, got none")
	}
	if spoken.Next != "Spec" || spoken.Note != "Reproduced on restart." {
		t.Fatalf("read back %+v", spoken)
	}
}

func TestAnOutcomeIsTakenOncePerTurn(t *testing.T) {
	space, err := workspace.Open(t.TempDir())
	if err != nil {
		t.Fatalf("create the workspace: %v", err)
	}

	write(t, space.Dir, `{"next":"review","note":"Is this right?"}`)

	if spoken := space.TakeOutcome(); spoken == nil {
		t.Fatal("expected an outcome, got none")
	}
	if again := space.TakeOutcome(); again != nil {
		t.Fatalf("the next turn would say %+v again", again)
	}
}

func TestOutcomeIsNothingWhenTheAgentSaidNothing(t *testing.T) {
	space, err := workspace.Open(t.TempDir())
	if err != nil {
		t.Fatalf("create the workspace: %v", err)
	}

	if spoken := space.TakeOutcome(); spoken != nil {
		t.Fatalf("expected nothing, got %+v", spoken)
	}
}

func TestOutcomeIsNothingWhenItCannotBeRead(t *testing.T) {
	space, err := workspace.Open(t.TempDir())
	if err != nil {
		t.Fatalf("create the workspace: %v", err)
	}

	write(t, space.Dir, `not json at all`)

	if spoken := space.TakeOutcome(); spoken != nil {
		t.Fatalf("expected nothing, got %+v", spoken)
	}
}

func TestOutcomeIsNothingWhenItNamesNowhere(t *testing.T) {
	space, err := workspace.Open(t.TempDir())
	if err != nil {
		t.Fatalf("create the workspace: %v", err)
	}

	write(t, space.Dir, `{"note":"I did some things."}`)

	if spoken := space.TakeOutcome(); spoken != nil {
		t.Fatalf("expected nothing, got %+v", spoken)
	}
}
