package workspace

import (
	"encoding/json"
	"os"
	"path/filepath"

	"usespotlight.ai/data-plane/protocol"
)

const OutcomePath = ".spotlight/outcome.json"

func (w *Workspace) Outcome() *protocol.Outcome {
	raw, err := os.ReadFile(filepath.Join(w.Dir, OutcomePath))
	if err != nil {
		return nil
	}

	var spoken protocol.Outcome
	if err := json.Unmarshal(raw, &spoken); err != nil {
		return nil
	}

	if spoken.Next == "" {
		return nil
	}

	return &spoken
}
