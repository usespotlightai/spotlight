package workspace

import (
	"encoding/json"
	"os"
	"path/filepath"

	"usespotlight.ai/data-plane/protocol"
)

const OutcomePath = ".spotlight/outcome.json"

func (w *Workspace) TakeOutcome() *protocol.Outcome {
	path := filepath.Join(w.Dir, OutcomePath)

	raw, err := os.ReadFile(path)
	if err != nil {
		return nil
	}
	_ = os.Remove(path)

	var spoken protocol.Outcome
	if err := json.Unmarshal(raw, &spoken); err != nil {
		return nil
	}

	if spoken.Next == "" {
		return nil
	}

	return &spoken
}
