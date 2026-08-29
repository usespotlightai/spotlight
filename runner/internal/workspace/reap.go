package workspace

import (
	"fmt"
	"os"
	"path/filepath"
)

// Reap disposes of the workspaces under root that nothing will come back for.
// Only the control plane knows which those are, so it says what is still
// wanted and everything else goes.
func Reap(root string, keep []string) (int, error) {
	wanted := make(map[string]struct{}, len(keep))
	for _, key := range keep {
		wanted[key] = struct{}{}
	}

	entries, err := os.ReadDir(root)
	if err != nil {
		if os.IsNotExist(err) {
			return 0, nil
		}
		return 0, fmt.Errorf("read the workspace root: %w", err)
	}

	reaped := 0
	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}
		if _, ok := wanted[entry.Name()]; ok {
			continue
		}

		if err := os.RemoveAll(filepath.Join(root, entry.Name())); err != nil {
			return reaped, fmt.Errorf("dispose of %s: %w", entry.Name(), err)
		}
		reaped++
	}

	return reaped, nil
}
