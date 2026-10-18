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
	path := filepath.Join(dir, workspace.HandoverPath)
	if err := os.WriteFile(path, []byte(body), 0o600); err != nil {
		t.Fatalf("write the outcome: %v", err)
	}
}

func TestHandoverReadsWhatTheAgentLeft(t *testing.T) {
	space, err := workspace.Open(t.TempDir())
	if err != nil {
		t.Fatalf("create the workspace: %v", err)
	}

	write(t, space.Dir, `{"next":"Spec","note":"Reproduced on restart."}`)

	handover := space.TakeHandover()
	if handover == nil {
		t.Fatal("expected a handover, got none")
	}
	if handover.Next != "Spec" || handover.Note != "Reproduced on restart." {
		t.Fatalf("read back %+v", handover)
	}
}

func TestAHandoverIsTakenOncePerTurn(t *testing.T) {
	space, err := workspace.Open(t.TempDir())
	if err != nil {
		t.Fatalf("create the workspace: %v", err)
	}

	write(t, space.Dir, `{"next":"review","note":"Is this right?"}`)

	if handover := space.TakeHandover(); handover == nil {
		t.Fatal("expected a handover, got none")
	}
	if again := space.TakeHandover(); again != nil {
		t.Fatalf("the next turn would take %+v again", again)
	}
}

func TestHandoverIsNothingWhenTheAgentLeftNone(t *testing.T) {
	space, err := workspace.Open(t.TempDir())
	if err != nil {
		t.Fatalf("create the workspace: %v", err)
	}

	if handover := space.TakeHandover(); handover != nil {
		t.Fatalf("expected nothing, got %+v", handover)
	}
}

func TestHandoverIsNothingWhenItCannotBeRead(t *testing.T) {
	space, err := workspace.Open(t.TempDir())
	if err != nil {
		t.Fatalf("create the workspace: %v", err)
	}

	write(t, space.Dir, `not json at all`)

	if handover := space.TakeHandover(); handover != nil {
		t.Fatalf("expected nothing, got %+v", handover)
	}
}

func TestHandoverIsNothingWhenItNamesNowhere(t *testing.T) {
	space, err := workspace.Open(t.TempDir())
	if err != nil {
		t.Fatalf("create the workspace: %v", err)
	}

	write(t, space.Dir, `{"note":"I did some things."}`)

	if handover := space.TakeHandover(); handover != nil {
		t.Fatalf("expected nothing, got %+v", handover)
	}
}
