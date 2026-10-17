package workspace

import (
	"encoding/json"
	"os"
	"path/filepath"

	"usespotlight.ai/data-plane/protocol"
)

const HandoverPath = ".spotlight/outcome.json"

func (w *Workspace) TakeHandover() *protocol.Handover {
	path := filepath.Join(w.Dir, HandoverPath)

	raw, err := os.ReadFile(path)
	if err != nil {
		return nil
	}
	_ = os.Remove(path)

	var handover protocol.Handover
	if err := json.Unmarshal(raw, &handover); err != nil {
		return nil
	}

	if handover.Next == "" {
		return nil
	}

	return &handover
}
