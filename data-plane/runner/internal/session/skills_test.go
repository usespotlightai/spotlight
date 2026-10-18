package session

import (
	"maps"
	"slices"
	"testing"

	"usespotlight.ai/data-plane/protocol"
)

func files(paths ...string) []protocol.SkillFile {
	skills := make([]protocol.SkillFile, 0, len(paths))
	for _, path := range paths {
		skills = append(skills, protocol.SkillFile{Path: path})
	}
	return skills
}

func TestSkillHomesIsWhereEverySkillIsLaid(t *testing.T) {
	written := []string{
		".claude/skills/spotlight-handover/SKILL.md",
		".claude/skills/our-migrations/SKILL.md",
		".claude/skills/our-migrations/examples/SKILL.md",
		".claude/skills/our-migrations/examples/add-column.md",
	}

	homes := skillHomes(nil, files(written...))

	if got := slices.Collect(maps.Keys(homes)); !slices.Equal(got, []string{".claude/skills"}) {
		t.Fatalf("homes = %v", got)
	}
	if !slices.Equal(homes[".claude/skills"], written) {
		t.Errorf("written there = %v", homes[".claude/skills"])
	}
}

func TestSkillHomesAreNamedEvenWhereNoSkillIsLaid(t *testing.T) {
	written := []string{".claude/skills/our-migrations/SKILL.md"}

	homes := skillHomes([]string{".claude/skills", ".spotlight/skills/", "."}, files(written...))

	got := slices.Sorted(maps.Keys(homes))
	if !slices.Equal(got, []string{".claude/skills", ".spotlight/skills"}) {
		t.Fatalf("homes = %v", got)
	}
	if !slices.Equal(homes[".claude/skills"], written) {
		t.Errorf("written in .claude/skills = %v", homes[".claude/skills"])
	}
	if len(homes[".spotlight/skills"]) != 0 {
		t.Errorf("written in .spotlight/skills = %v", homes[".spotlight/skills"])
	}
}

func TestSkillHomesNeverNamesTheWorkspaceItself(t *testing.T) {
	for _, written := range [][]string{
		nil,
		{"spotlight-handover/SKILL.md"},
		{"SKILL.md"},
	} {
		if homes := skillHomes(nil, files(written...)); len(homes) != 0 {
			t.Errorf("skillHomes(%v) = %v, want none", written, homes)
		}
	}
}
