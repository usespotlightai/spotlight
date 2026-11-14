package v2

import (
	"strings"

	"usespotlight.ai/data-plane/protocol"
)

type sides struct {
	paths  []string
	before []string
	after  []string
}

func sidesIn(patch string) []sides {
	var all []sides
	var current *sides
	inHunk := false

	for line := range strings.Lines(patch) {
		line = strings.TrimSuffix(line, "\n")

		switch {
		case strings.HasPrefix(line, "diff --git "):
			all = append(all, sides{})
			current = &all[len(all)-1]
			inHunk = false
		case current == nil:
			continue
		case strings.HasPrefix(line, "@@"):
			inHunk = true
		case !inHunk && (strings.HasPrefix(line, "--- ") || strings.HasPrefix(line, "+++ ")):
			if path := patchPath(line[4:]); path != "" {
				current.paths = append(current.paths, path)
			}
		case !inHunk:
			continue
		case strings.HasPrefix(line, "-"):
			current.before = append(current.before, line[1:])
		case strings.HasPrefix(line, "+"):
			current.after = append(current.after, line[1:])
		case strings.HasPrefix(line, " "):
			current.before = append(current.before, line[1:])
			current.after = append(current.after, line[1:])
		}
	}

	return all
}

func patchPath(raw string) string {
	path, _, _ := strings.Cut(raw, "\t")
	if path == "/dev/null" {
		return ""
	}
	for _, prefix := range []string{"a/", "b/"} {
		if rest, ok := strings.CutPrefix(path, prefix); ok {
			return rest
		}
	}
	return path
}

func (s sides) names(path string) bool {
	for _, each := range s.paths {
		if each == path || strings.HasSuffix(path, "/"+each) {
			return true
		}
	}
	return false
}

func withSides(files []protocol.FileChange, patch string) {
	found := sidesIn(patch)
	for i := range files {
		for _, each := range found {
			if !each.names(files[i].Path) || len(each.before)+len(each.after) == 0 {
				continue
			}
			before := strings.Join(each.before, "\n")
			after := strings.Join(each.after, "\n")
			files[i].Before, files[i].After = &before, &after
			break
		}
	}
}
