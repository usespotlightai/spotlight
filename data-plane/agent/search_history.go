package agent

import (
	"bytes"
	"encoding/json"
	"fmt"
	"path/filepath"
	"strings"

	"usespotlight.ai/data-plane/agent/internal/unidiff"
	"usespotlight.ai/data-plane/protocol"
)

type candidateScore struct {
	Succeeded int                `json:"succeeded"`
	Scored    int                `json:"scored"`
	Failed    []string           `json:"failed"`
	Verdicts  map[string]int     `json:"verdicts"`
	Spent     map[string]float64 `json:"spent"`
	Unpriced  int                `json:"unpriced"`
}

func seeded(history protocol.History) bool {
	trimmed := bytes.TrimSpace(history.SeedBlock)
	return len(trimmed) > 0 && !bytes.Equal(trimmed, []byte("null"))
}

func searchFiles(files map[string]string, history protocol.History) error {
	seed := ""
	if seeded(history) {
		current, err := indented(history.SeedBlock)
		if err != nil {
			return fmt.Errorf("write the current station block: %w", err)
		}
		seed = current
		files["current.json"] = seed
	}

	for _, candidate := range history.Candidates {
		at := filepath.Join("candidates", candidate.CandidateName)

		block, err := indented(candidate.Block)
		if err != nil {
			return fmt.Errorf("write candidate %s: %w", candidate.CandidateName, err)
		}
		files[filepath.Join(at, "block.json")] = block
		if changed := unidiff.Diff("current.json", "block.json", seed, block); seed != "" && changed != "" {
			files[filepath.Join(at, "changes.diff")] = changed
		}
		files[filepath.Join(at, "hypothesis.md")] = strings.TrimSpace(candidate.Hypothesis) + "\n"

		score, err := json.MarshalIndent(scoreOf(candidate), "", "  ")
		if err != nil {
			return err
		}
		files[filepath.Join(at, "score.json")] = string(score) + "\n"

		for _, run := range candidate.Runs {
			ran := filepath.Join(at, "runs", run.Original)
			files[filepath.Join(ran, "journal.md")] = journalMarkdown(run.Run())

			result, err := json.MarshalIndent(struct {
				RunID       string            `json:"runId"`
				Original    string            `json:"original"`
				TaskID      string            `json:"taskId"`
				Fingerprint *string           `json:"fingerprint"`
				State       string            `json:"state"`
				Cost        *protocol.RunCost `json:"cost"`
				Succeeded   *bool             `json:"succeeded"`
				Reasons     []string          `json:"reasons"`
				Verdict     *string           `json:"verdict"`
			}{
				run.RunID, run.Original, run.TaskID, run.Fingerprint, run.State, run.Cost,
				run.Succeeded, nonNil(run.Reasons), run.Verdict,
			}, "", "  ")
			if err != nil {
				return err
			}
			files[filepath.Join(ran, "result.json")] = string(result) + "\n"

			if patch := runPatch(run.Changes); patch != "" {
				files[filepath.Join(ran, "diff.patch")] = patch
			}
		}
	}

	return nil
}

func scoreOf(candidate protocol.HistoryCandidate) candidateScore {
	score := candidateScore{Failed: []string{}, Verdicts: map[string]int{}, Spent: map[string]float64{}}

	for _, run := range candidate.Runs {
		if run.Cost != nil && run.Cost.Cost != nil && run.Cost.Currency != nil {
			score.Spent[*run.Cost.Currency] += *run.Cost.Cost
		} else {
			score.Unpriced++
		}
		if run.Verdict != nil {
			score.Verdicts[*run.Verdict]++
		}
		if run.Succeeded == nil {
			continue
		}
		score.Scored++
		if *run.Succeeded {
			score.Succeeded++
		} else {
			score.Failed = append(score.Failed, run.TaskID)
		}
	}

	return score
}

func candidatesIndex(history protocol.History) string {
	if len(history.Candidates) == 0 && !seeded(history) {
		return ""
	}

	var out strings.Builder
	out.WriteString("\n## Candidates\n\n")
	if seeded(history) {
		out.WriteString("The station block the search started from is in current.json.\n\n")
	}
	if len(history.Candidates) == 0 {
		out.WriteString("No candidates proposed yet.\n")
		return out.String()
	}

	out.WriteString("| Candidate | Config | Succeeded | Scored | Hypothesis |\n")
	out.WriteString("| --- | --- | --- | --- | --- |\n")
	for _, candidate := range history.Candidates {
		score := scoreOf(candidate)
		fmt.Fprintf(&out, "| [%s](candidates/%s/score.json) | %s | %d | %d | %s |\n",
			cell(candidate.CandidateName), candidate.CandidateName, short(candidate.Fingerprint),
			score.Succeeded, score.Scored, cell(candidate.Hypothesis),
		)
	}

	return out.String()
}

func indented(raw json.RawMessage) (string, error) {
	var out bytes.Buffer
	if err := json.Indent(&out, raw, "", "  "); err != nil {
		return "", err
	}

	return out.String() + "\n", nil
}

func nonNil(said []string) []string {
	if said == nil {
		return []string{}
	}

	return said
}
