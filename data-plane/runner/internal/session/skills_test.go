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
	laid := []string{
		".claude/skills/spotlight-handover/SKILL.md",
		".claude/skills/our-migrations/SKILL.md",
		".claude/skills/our-migrations/examples/SKILL.md",
		".claude/skills/our-migrations/examples/add-column.md",
	}

	homes := skillHomes(files(laid...))

	if got := slices.Collect(maps.Keys(homes)); !slices.Equal(got, []string{".claude/skills"}) {
		t.Fatalf("homes = %v", got)
	}
	if !slices.Equal(homes[".claude/skills"], laid) {
		t.Errorf("laid there = %v", homes[".claude/skills"])
	}
}

func TestSkillHomesNeverNamesTheWorkspaceItself(t *testing.T) {
	for _, laid := range [][]string{
		nil,
		{"spotlight-handover/SKILL.md"},
		{"SKILL.md"},
	} {
		if homes := skillHomes(files(laid...)); len(homes) != 0 {
			t.Errorf("skillHomes(%v) = %v, want none", laid, homes)
		}
	}
}
