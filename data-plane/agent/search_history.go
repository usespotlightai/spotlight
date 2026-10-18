package agent

import (
	"bytes"
	"encoding/json"
	"fmt"
	"path/filepath"
	"strconv"
	"strings"

	"usespotlight.ai/data-plane/agent/internal/unidiff"
	"usespotlight.ai/data-plane/protocol"
)

type candidateScore struct {
	Succeeded   int                `json:"succeeded"`
	Scored      int                `json:"scored"`
	Repeats     int                `json:"repeats"`
	TasksScored int                `json:"tasksScored"`
	Rate        *float64           `json:"rate"`
	Failed      []string           `json:"failed"`
	Verdicts    map[string]int     `json:"verdicts"`
	Spent       map[string]float64 `json:"spent"`
	Unpriced    int                `json:"unpriced"`
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

		repeated := repeatsOf(candidate) > 1
		for _, run := range candidate.Runs {
			ran := filepath.Join(at, "runs", run.Original)
			if repeated {
				ran = filepath.Join(ran, strconv.Itoa(run.Repeat))
			}
			files[filepath.Join(ran, "journal.md")] = journalMarkdown(run.Run())

			result, err := json.MarshalIndent(struct {
				RunID       string             `json:"runId"`
				Original    string             `json:"original"`
				Repeat      int                `json:"repeat"`
				TaskID      string             `json:"taskId"`
				Fingerprint *string            `json:"fingerprint"`
				State       string             `json:"state"`
				Usage       *protocol.RunUsage `json:"usage"`
				Succeeded   *bool              `json:"succeeded"`
				Reasons     []string           `json:"reasons"`
				Verdict     *string            `json:"verdict"`
			}{
				run.RunID, run.Original, run.Repeat, run.TaskID, run.Fingerprint, run.State, run.Usage,
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

func repeatsOf(candidate protocol.HistoryCandidate) int {
	most := 1
	for _, run := range candidate.Runs {
		most = max(most, run.Repeat)
	}

	return most
}

func scoreOf(candidate protocol.HistoryCandidate) candidateScore {
	score := candidateScore{Repeats: repeatsOf(candidate), Failed: []string{}, Verdicts: map[string]int{}, Spent: map[string]float64{}}
	type taskRepeats struct{ succeeded, scored int }
	tasks := map[string]*taskRepeats{}
	failed := map[string]bool{}

	for _, run := range candidate.Runs {
		if run.Usage != nil && run.Usage.Cost != nil && run.Usage.Currency != nil {
			score.Spent[*run.Usage.Currency] += *run.Usage.Cost
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
		task := tasks[run.Original]
		if task == nil {
			task = &taskRepeats{}
			tasks[run.Original] = task
		}
		task.scored++
		if *run.Succeeded {
			score.Succeeded++
			task.succeeded++
		} else if !failed[run.TaskID] {
			failed[run.TaskID] = true
			score.Failed = append(score.Failed, run.TaskID)
		}
	}

	if len(tasks) > 0 {
		sum := 0.0
		for _, task := range tasks {
			sum += float64(task.succeeded) / float64(task.scored)
		}
		rate := sum / float64(len(tasks))
		score.TasksScored = len(tasks)
		score.Rate = &rate
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

	out.WriteString("| Candidate | Config | Succeeded | Scored | Repeats | Rate | Hypothesis |\n")
	out.WriteString("| --- | --- | --- | --- | --- | --- | --- |\n")
	for _, candidate := range history.Candidates {
		score := scoreOf(candidate)
		rate := "-"
		if score.Rate != nil {
			rate = fmt.Sprintf("%.0f%%", *score.Rate*100)
		}
		fmt.Fprintf(&out, "| [%s](candidates/%s/score.json) | %s | %d | %d | %d | %s | %s |\n",
			cell(candidate.CandidateName), candidate.CandidateName, short(candidate.Fingerprint),
			score.Succeeded, score.Scored, score.Repeats, rate, cell(candidate.Hypothesis),
		)
	}
	if anyRepeated(history) {
		out.WriteString("\nA candidate replayed each run more than once keeps each repeat under runs/<original>/<repeat>/; its rate is per task, the share of the task's repeats that succeeded, averaged over the tasks.\n")
	}

	return out.String()
}

func anyRepeated(history protocol.History) bool {
	for _, candidate := range history.Candidates {
		if repeatsOf(candidate) > 1 {
			return true
		}
	}

	return false
}

func indented(raw json.RawMessage) (string, error) {
	var out bytes.Buffer
	if err := json.Indent(&out, raw, "", "  "); err != nil {
		return "", err
	}

	return out.String() + "\n", nil
}

func nonNil(values []string) []string {
	if values == nil {
		return []string{}
	}

	return values
}
