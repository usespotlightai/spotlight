package workspace_test

import (
	"errors"
	"io"
	"os"
	"path/filepath"
	"syscall"
	"testing"

	"usespotlight.ai/data-plane/runner/internal/account"
	"usespotlight.ai/data-plane/runner/internal/workspace"
)

func writing(content string) func(io.Writer) error {
	return func(into io.Writer) error {
		_, err := io.WriteString(into, content)
		return err
	}
}

func TestReceivePlacesTheFileWhereItWasAsked(t *testing.T) {
	space, err := workspace.Open(t.TempDir())
	if err != nil {
		t.Fatalf("create: %v", err)
	}

	path := ".spotlight/attachments/att_1/notes.txt"
	if err := space.Receive(path, nil, writing("the notes")); err != nil {
		t.Fatalf("receive: %v", err)
	}

	placed, err := os.ReadFile(filepath.Join(space.Dir, path))
	if err != nil || string(placed) != "the notes" {
		t.Fatalf("placed %q: %v", placed, err)
	}

	entries, err := os.ReadDir(filepath.Dir(filepath.Join(space.Dir, path)))
	if err != nil {
		t.Fatal(err)
	}
	if len(entries) != 1 {
		t.Errorf("expected only the file, found %d entries", len(entries))
	}
}

func TestReceiveRefusesAPathOutOfTheWorkspace(t *testing.T) {
	space, err := workspace.Open(t.TempDir())
	if err != nil {
		t.Fatalf("create: %v", err)
	}

	for _, escaping := range []string{"../escape", "/etc/escape", ".spotlight/../../escape"} {
		fetched := false
		err := space.Receive(escaping, nil, func(io.Writer) error {
			fetched = true
			return nil
		})

		if err == nil {
			t.Errorf("%q should be refused", escaping)
		}
		if fetched {
			t.Errorf("%q was fetched before it was refused", escaping)
		}
	}
}

func TestReceiveWillNotFollowALinkOutOfTheWorkspace(t *testing.T) {
	root := t.TempDir()
	outside := t.TempDir()

	space, err := workspace.Open(root)
	if err != nil {
		t.Fatalf("create: %v", err)
	}
	if err := os.Symlink(outside, filepath.Join(space.Dir, ".spotlight")); err != nil {
		t.Fatal(err)
	}

	if err := space.Receive(".spotlight/notes.txt", nil, writing("x")); err == nil {
		t.Error("a path through a link out of the workspace should be refused")
	}
	if _, err := os.Stat(filepath.Join(outside, "notes.txt")); !os.IsNotExist(err) {
		t.Errorf("a file was written outside the workspace: %v", err)
	}
}

func TestReceiveLeavesAFileAlreadyThereAlone(t *testing.T) {
	space, err := workspace.Open(t.TempDir())
	if err != nil {
		t.Fatalf("create: %v", err)
	}

	path := filepath.Join(space.Dir, "notes.txt")
	if err := os.WriteFile(path, []byte("kept"), 0o600); err != nil {
		t.Fatal(err)
	}

	fetched := false
	err = space.Receive("notes.txt", nil, func(io.Writer) error {
		fetched = true
		return nil
	})
	if err != nil {
		t.Fatalf("receive: %v", err)
	}

	if fetched {
		t.Error("a file already there was fetched again")
	}
	if kept, _ := os.ReadFile(path); string(kept) != "kept" {
		t.Errorf("the file was replaced with %q", kept)
	}
}

func TestReceiveNeverShowsHalfAFile(t *testing.T) {
	space, err := workspace.Open(t.TempDir())
	if err != nil {
		t.Fatalf("create: %v", err)
	}

	path := filepath.Join(space.Dir, "attachments", "notes.txt")
	err = space.Receive("attachments/notes.txt", nil, func(into io.Writer) error {
		if _, err := io.WriteString(into, "the first half"); err != nil {
			return err
		}
		if _, err := os.Stat(path); !os.IsNotExist(err) {
			t.Error("the file was visible before it was whole")
		}
		return errors.New("the connection dropped")
	})

	if err == nil {
		t.Fatal("a failed fetch should fail")
	}
	entries, err := os.ReadDir(filepath.Dir(path))
	if err != nil {
		t.Fatal(err)
	}
	if len(entries) != 0 {
		t.Errorf("a failed fetch left %d entries behind", len(entries))
	}
}

func TestReceiveGivesWhatItMakesToTheAgent(t *testing.T) {
	if os.Getuid() != 0 {
		t.Skip("giving files to another account needs root")
	}

	space, err := workspace.Open(t.TempDir())
	if err != nil {
		t.Fatalf("create: %v", err)
	}
	if err := os.Mkdir(filepath.Join(space.Dir, ".spotlight"), 0o700); err != nil {
		t.Fatal(err)
	}

	agent := &account.User{UID: 12345, GID: 12345}
	path := ".spotlight/attachments/att_1/notes.txt"
	if err := space.Receive(path, agent, writing("the notes")); err != nil {
		t.Fatalf("receive: %v", err)
	}

	for _, made := range []string{".spotlight/attachments", ".spotlight/attachments/att_1", path} {
		if uid := ownerOf(t, filepath.Join(space.Dir, made)); uid != agent.UID {
			t.Errorf("%s is owned by %d", made, uid)
		}
	}
	if uid := ownerOf(t, filepath.Join(space.Dir, ".spotlight")); uid != 0 {
		t.Errorf(".spotlight was already there, yet is now owned by %d", uid)
	}
}

func ownerOf(t *testing.T, path string) uint32 {
	t.Helper()

	info, err := os.Lstat(path)
	if err != nil {
		t.Fatal(err)
	}
	return info.Sys().(*syscall.Stat_t).Uid
}

func TestReplaceWritesOverAFileAlreadyThere(t *testing.T) {
	space, err := workspace.Open(t.TempDir())
	if err != nil {
		t.Fatalf("create: %v", err)
	}

	path := ".claude/skills/spotlight-handover/SKILL.md"
	if err := space.Receive(path, nil, writing("as it was")); err != nil {
		t.Fatalf("receive: %v", err)
	}
	if err := space.Replace(path, nil, writing("as it is now")); err != nil {
		t.Fatalf("replace: %v", err)
	}

	placed, err := os.ReadFile(filepath.Join(space.Dir, path))
	if err != nil || string(placed) != "as it is now" {
		t.Fatalf("placed %q: %v", placed, err)
	}
}

func TestReplaceRefusesWhatIsNotAFile(t *testing.T) {
	space, err := workspace.Open(t.TempDir())
	if err != nil {
		t.Fatalf("create: %v", err)
	}

	path := ".claude/skills/spotlight-handover"
	if err := os.MkdirAll(filepath.Join(space.Dir, path), 0o755); err != nil {
		t.Fatal(err)
	}

	if err := space.Replace(path, nil, writing("x")); err == nil {
		t.Fatal("replaced a directory")
	}
	if info, err := os.Stat(filepath.Join(space.Dir, path)); err != nil || !info.IsDir() {
		t.Errorf("the directory is gone: %v", err)
	}
}

func TestReplaceRefusesAPathOutOfTheWorkspace(t *testing.T) {
	space, err := workspace.Open(t.TempDir())
	if err != nil {
		t.Fatalf("create: %v", err)
	}

	if err := space.Replace("../outside.md", nil, writing("x")); err == nil {
		t.Fatal("wrote outside the workspace")
	}
}
