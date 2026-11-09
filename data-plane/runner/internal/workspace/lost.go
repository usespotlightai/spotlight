package workspace

import (
	"encoding/json"
	"os"
	"path/filepath"
)

const LostBackgroundPath = ".spotlight/background-lost.json"

type LostTask struct {
	Kind        string `json:"kind"`
	Description string `json:"description"`
}

func (w *Workspace) KeepLostBackground(tasks []LostTask) error {
	path := filepath.Join(w.Dir, LostBackgroundPath)
	if len(tasks) == 0 {
		return w.Remove(LostBackgroundPath)
	}
	raw, err := json.Marshal(tasks)
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return err
	}
	return os.WriteFile(path, raw, 0o644)
}

func (w *Workspace) TakeLostBackground() []LostTask {
	path := filepath.Join(w.Dir, LostBackgroundPath)

	raw, err := os.ReadFile(path)
	if err != nil {
		return nil
	}
	_ = os.Remove(path)

	var tasks []LostTask
	if json.Unmarshal(raw, &tasks) != nil {
		return nil
	}
	return tasks
}
