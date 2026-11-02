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

	var written struct {
		Next string `json:"next"`
		Note string `json:"note"`
	}
	if err := json.Unmarshal(raw, &written); err != nil {
		return nil
	}

	if written.Next == "" {
		return nil
	}

	return &protocol.Handover{Next: written.Next, Note: written.Note}
}
