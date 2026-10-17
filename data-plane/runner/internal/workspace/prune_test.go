package workspace_test

import (
	"os"
	"path/filepath"
	"testing"

	"usespotlight.ai/data-plane/runner/internal/workspace"
)

func planted(t *testing.T, space *workspace.Workspace, paths ...string) {
	t.Helper()

	for _, path := range paths {
		full := filepath.Join(space.Dir, path)
		if err := os.MkdirAll(filepath.Dir(full), 0o755); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(full, []byte("x"), 0o600); err != nil {
			t.Fatal(err)
		}
	}
}

func there(t *testing.T, space *workspace.Workspace, path string) bool {
	t.Helper()

	_, err := os.Lstat(filepath.Join(space.Dir, path))
	if err != nil && !os.IsNotExist(err) {
		t.Fatal(err)
	}
	return err == nil
}

func TestPruneRemovesWhatThisRunWasNotGiven(t *testing.T) {
	space, err := workspace.Open(t.TempDir())
	if err != nil {
		t.Fatalf("create: %v", err)
	}

	planted(t, space,
		".claude/skills/spotlight-handover/SKILL.md",
		".claude/skills/our-migrations/SKILL.md",
		".claude/skills/our-migrations/examples/add-column.md",
		".claude/skills/our-migrations/examples/drop-column.md",
		".claude/skills/spotlight-pull-request/SKILL.md",
		".claude/settings.json",
	)

	err = space.Prune(".claude/skills", []string{
		".claude/skills/spotlight-handover/SKILL.md",
		".claude/skills/our-migrations/SKILL.md",
		".claude/skills/our-migrations/examples/add-column.md",
	})
	if err != nil {
		t.Fatalf("prune: %v", err)
	}

	for _, kept := range []string{
		".claude/skills/spotlight-handover/SKILL.md",
		".claude/skills/our-migrations/SKILL.md",
		".claude/skills/our-migrations/examples/add-column.md",
		".claude/settings.json",
	} {
		if !there(t, space, kept) {
			t.Errorf("%s is gone", kept)
		}
	}
	for _, dropped := range []string{
		".claude/skills/our-migrations/examples/drop-column.md",
		".claude/skills/spotlight-pull-request",
	} {
		if there(t, space, dropped) {
			t.Errorf("%s is still there", dropped)
		}
	}
}

func TestPruneLeavesAWorkspaceWithoutTheDirectoryAlone(t *testing.T) {
	space, err := workspace.Open(t.TempDir())
	if err != nil {
		t.Fatalf("create: %v", err)
	}

	if err := space.Prune(".claude/skills", nil); err != nil {
		t.Fatalf("prune: %v", err)
	}
	if there(t, space, ".claude") {
		t.Error("made what it was only to prune")
	}
}

func TestPruneRemovesALinkWithoutFollowingIt(t *testing.T) {
	outside := t.TempDir()
	planted := filepath.Join(outside, "SKILL.md")
	if err := os.WriteFile(planted, []byte("x"), 0o600); err != nil {
		t.Fatal(err)
	}

	space, err := workspace.Open(t.TempDir())
	if err != nil {
		t.Fatalf("create: %v", err)
	}
	if err := os.MkdirAll(filepath.Join(space.Dir, ".claude/skills"), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.Symlink(outside, filepath.Join(space.Dir, ".claude/skills/elsewhere")); err != nil {
		t.Fatal(err)
	}

	if err := space.Prune(".claude/skills", []string{".claude/skills/elsewhere/SKILL.md"}); err != nil {
		t.Fatalf("prune: %v", err)
	}

	if there(t, space, ".claude/skills/elsewhere") {
		t.Error("the link is still there")
	}
	if _, err := os.Stat(planted); err != nil {
		t.Errorf("followed the link out of the workspace: %v", err)
	}
}

func TestPruneRejectsADirectoryThroughALink(t *testing.T) {
	outside := t.TempDir()
	stranger := filepath.Join(outside, "skills", "theirs", "SKILL.md")
	if err := os.MkdirAll(filepath.Dir(stranger), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(stranger, []byte("x"), 0o600); err != nil {
		t.Fatal(err)
	}

	space, err := workspace.Open(t.TempDir())
	if err != nil {
		t.Fatalf("create: %v", err)
	}
	if err := os.Symlink(outside, filepath.Join(space.Dir, ".claude")); err != nil {
		t.Fatal(err)
	}

	if err := space.Prune(".claude/skills", nil); err == nil {
		t.Error("pruned through a link")
	}
	if _, err := os.Stat(stranger); err != nil {
		t.Errorf("removed something through the link: %v", err)
	}
}

func TestPruneRejectsAPathOutOfTheWorkspace(t *testing.T) {
	space, err := workspace.Open(t.TempDir())
	if err != nil {
		t.Fatalf("create: %v", err)
	}

	for _, escaping := range []string{"../skills", "/etc"} {
		if err := space.Prune(escaping, nil); err == nil {
			t.Errorf("%q should be rejected", escaping)
		}
	}
	if err := space.Prune(".claude/skills", []string{"../SKILL.md"}); err == nil {
		t.Error("a kept path out of the workspace should be rejected")
	}
}
