package workspace

import (
	"encoding/json"
	"os"
	"path/filepath"

	"usespotlight.ai/runner/internal/protocol"
)

// OutcomePath is where an agent says what should happen to its task next.
const OutcomePath = ".spotlight/outcome.json"

// Outcome reads what the agent left behind, if it left anything. A missing or
// unreadable file is not an error: saying nothing is itself an answer, and the
// control plane treats it as one.
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
