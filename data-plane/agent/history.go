package agent

import (
	"cmp"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"slices"
	"strconv"
	"strings"

	"usespotlight.ai/data-plane/agent/internal/unidiff"
	"usespotlight.ai/data-plane/protocol"
)

const historyUsage = `usage:
  spotlight history --station <key> [--line <key>] [--fingerprint <fp>] [--outcome <word>] [--since <date>] [--last <n>] [--out <dir>]`

func historyCmd(args []string, out io.Writer) error {
	flags := flag.NewFlagSet("history", flag.ContinueOnError)
	flags.SetOutput(io.Discard)
	station := flags.String("station", "", "the station whose runs to write")
	line := flags.String("line", "", "the line the station is on, when several have it")
	fingerprint := flags.String("fingerprint", "", "only runs of this config")
	outcome := flags.String("outcome", "", "only runs that ended this way")
	since := flags.String("since", "", "only runs since this date")
	last := flags.Int("last", 0, "only the latest this many runs")
	into := flags.String("out", "", "where to write it (.spotlight/history by default)")

	if err := flags.Parse(args); err != nil {
		return fmt.Errorf("%s", historyUsage)
	}
	key := strings.TrimSpace(*station)
	if key == "" {
		return fmt.Errorf("--station is required\n%s", historyUsage)
	}
	if !protocol.OneSegment(key) {
		return fmt.Errorf("%q is not a station key\n%s", key, historyUsage)
	}
	if *last < 0 {
		return fmt.Errorf("--last counts runs, so it cannot be %d\n%s", *last, historyUsage)
	}

	root := *into
	if strings.TrimSpace(root) == "" {
		workspace, err := os.Getwd()
		if err != nil {
			return fmt.Errorf("find the workspace: %w", err)
		}
		root = filepath.Join(workspace, ".spotlight", "history")
	}

	history, err := fetchHistory(protocol.HistoryRequest{
		Station:     key,
		Line:        strings.TrimSpace(*line),
		Fingerprint: strings.TrimSpace(*fingerprint),
		Outcome:     strings.TrimSpace(*outcome),
		Since:       strings.TrimSpace(*since),
		Last:        *last,
	})
	if err != nil {
		return err
	}

	dir := filepath.Join(root, key)
	if err := writeHistory(dir, history); err != nil {
		return err
	}

	fmt.Fprintf(out, "Wrote the history to %s\n", dir)
	fmt.Fprintf(
		out, "%d %s of %s/%s across %d %s\n",
		len(history.Runs), plural(len(history.Runs), "run", "runs"),
		history.Line.Key, history.Station.Key,
		len(history.Configs), plural(len(history.Configs), "config", "configs"),
	)
	if len(history.Candidates) > 0 {
		fmt.Fprintf(
			out, "%d %s proposed so far, under %s\n",
			len(history.Candidates), plural(len(history.Candidates), "candidate", "candidates"),
			filepath.Join(dir, "candidates"),
		)
	}
	fmt.Fprintf(out, "Search it with your own tools: grep -r <term> %s\n", dir)

	return nil
}

func fetchHistory(asked protocol.HistoryRequest) (protocol.History, error) {
	endpoint, token := os.Getenv(protocol.HandoverURLVar), os.Getenv(protocol.HandoverTokenVar)
	if endpoint == "" || token == "" {
		return protocol.History{}, fmt.Errorf(
			"no run to read history from: spotlight runs inside a Spotlight workspace",
		)
	}

	body, err := json.Marshal(asked)
	if err != nil {
		return protocol.History{}, err
	}

	answered, err := post(
		strings.TrimSuffix(endpoint, "/")+protocol.HandoverHistoryPath, token, body,
	)
	if err != nil {
		return protocol.History{}, err
	}

	var history protocol.History
	if err := json.Unmarshal([]byte(answered), &history); err != nil {
		return protocol.History{}, fmt.Errorf("Spotlight answered with %q", answered)
	}

	return history, nil
}

func writeHistory(dir string, history protocol.History) error {
	for _, config := range history.Configs {
		if !protocol.OneSegment(config.Fingerprint) {
			return fmt.Errorf("Spotlight named a config %q", config.Fingerprint)
		}
	}
	for _, run := range history.Runs {
		if !protocol.OneSegment(run.RunID) {
			return fmt.Errorf("Spotlight named a run %q", run.RunID)
		}
	}
	named := map[string]bool{}
	for _, candidate := range history.Candidates {
		if !protocol.OneSegment(candidate.CandidateName) {
			return fmt.Errorf("Spotlight named a candidate %q", candidate.CandidateName)
		}
		folded := strings.ToLower(candidate.CandidateName)
		if named[folded] {
			return fmt.Errorf("Spotlight named two candidates %q", candidate.CandidateName)
		}
		named[folded] = true
		replayed := map[string]bool{}
		for _, run := range candidate.Runs {
			if !protocol.OneSegment(run.Original) {
				return fmt.Errorf("Spotlight named a replayed run %q", run.Original)
			}
			if replayed[run.Original] {
				return fmt.Errorf("Spotlight named run %q twice among candidate %s's replays", run.Original, candidate.CandidateName)
			}
			replayed[run.Original] = true
		}
	}

	if err := os.RemoveAll(dir); err != nil {
		return fmt.Errorf("clear %s: %w", dir, err)
	}

	files := map[string]string{"index.md": historyIndex(history) + candidatesIndex(history)}

	for _, config := range history.Configs {
		written, err := configYAML(config.Fingerprint, config.Config)
		if err != nil {
			return fmt.Errorf("write config %s: %w", config.Fingerprint, err)
		}
		files[filepath.Join("configs", config.Fingerprint+".yml")] = written
	}

	if err := searchFiles(files, history); err != nil {
		return err
	}

	for _, run := range history.Runs {
		at := filepath.Join("runs", run.RunID)
		files[filepath.Join(at, "journal.md")] = journalMarkdown(run)

		outcome, err := json.MarshalIndent(struct {
			RunID       string               `json:"runId"`
			TaskID      string               `json:"taskId"`
			Fingerprint *string              `json:"fingerprint"`
			Outcome     *protocol.RunOutcome `json:"outcome"`
		}{run.RunID, run.TaskID, run.Fingerprint, run.Outcome}, "", "  ")
		if err != nil {
			return err
		}
		files[filepath.Join(at, "outcome.json")] = string(outcome) + "\n"

		if patch := runPatch(run.Changes); patch != "" {
			files[filepath.Join(at, "diff.patch")] = patch
		}
	}

	for name, content := range files {
		path := filepath.Join(dir, name)
		if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
			return fmt.Errorf("make %s: %w", filepath.Dir(path), err)
		}
		if err := os.WriteFile(path, []byte(content), 0o644); err != nil {
			return fmt.Errorf("write %s: %w", path, err)
		}
	}

	return nil
}

func runPatch(changes []protocol.HistoryChange) string {
	var out strings.Builder
	for _, change := range changes {
		if change.Omitted {
			fmt.Fprintf(&out, "Omitted %s: too large to send whole\n", change.Path)
			continue
		}
		out.WriteString(unidiff.File(change.Path, change.Before, change.After))
	}

	return out.String()
}

func historyIndex(history protocol.History) string {
	var out strings.Builder

	fmt.Fprintf(&out, "# %s / %s\n\n", oneLine(history.Line.Name), oneLine(history.Station.Name))
	fmt.Fprintf(&out, "Line `%s`, station `%s`: %d %s, newest first, across %d %s.\n\n",
		history.Line.Key, history.Station.Key,
		len(history.Runs), plural(len(history.Runs), "run", "runs"),
		len(history.Configs), plural(len(history.Configs), "config", "configs"),
	)

	out.WriteString("## Runs\n\n")
	if len(history.Runs) == 0 {
		out.WriteString("No runs match.\n")
	} else {
		out.WriteString("| Run | Task | Config | Ending | Checks | Next | Delivery | Round | Cost | Steps | Duration | Started |\n")
		out.WriteString("| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |\n")
		for _, run := range history.Runs {
			out.WriteString("| " + strings.Join(runRow(run), " | ") + " |\n")
		}
	}

	out.WriteString("\n## Configs\n")
	if len(history.Configs) == 0 {
		out.WriteString("\nNo configs recorded.\n")
	}

	ordered := oldestFirst(history)
	for i, config := range ordered {
		used := 0
		for _, run := range history.Runs {
			if run.Fingerprint != nil && *run.Fingerprint == config.Fingerprint {
				used++
			}
		}

		fmt.Fprintf(&out, "\n### %s\n\n", short(config.Fingerprint))
		fmt.Fprintf(&out, "- fingerprint: %s\n", config.Fingerprint)
		fmt.Fprintf(&out, "- file: configs/%s.yml\n", config.Fingerprint)
		fmt.Fprintf(&out, "- runs: %d\n", used)

		if i == 0 {
			out.WriteString("- the oldest config here\n")
			continue
		}

		was := ordered[i-1]
		changes := configChanges(was.Config, config.Config)
		fmt.Fprintf(&out, "- since %s:\n", short(was.Fingerprint))
		if len(changes) == 0 {
			out.WriteString("  - nothing that shows in the resolved config\n")
		}
		for _, change := range changes {
			out.WriteString("  - " + change + "\n")
		}

		if was.Config.Prompt != nil && config.Config.Prompt != nil && *was.Config.Prompt != *config.Config.Prompt {
			writeBlock(&out, "Prompt change", "diff", unidiff.Diff(
				"prompt@"+short(was.Fingerprint), "prompt@"+short(config.Fingerprint),
				*was.Config.Prompt, *config.Config.Prompt,
			))
		}
	}

	return out.String()
}

func runRow(run protocol.HistoryRun) []string {
	config := "none"
	if run.Fingerprint != nil {
		config = short(*run.Fingerprint)
	}

	row := []string{
		"[" + run.RunID + "](runs/" + run.RunID + "/journal.md)",
		cell(run.Title),
		config,
	}

	outcome := run.Outcome
	if outcome == nil {
		return append(row, run.State, "", "", "", "", "", "", tookMs(run.Trace.Ms), shown(run.StartedAt))
	}

	next, cost, steps, took := "", "", "", tookMs(run.Trace.Ms)
	if outcome.Next != nil {
		next = outcome.Next.Act
	}
	if spent := outcome.Cost; spent != nil {
		steps = strconv.Itoa(spent.Steps)
		if spent.Cost != nil {
			cost = money(*spent.Cost, spent.Currency)
		}
		if spent.Ms != nil {
			took = tookMs(*spent.Ms)
		}
	}

	return append(row,
		cell(ending(outcome)),
		shown(outcome.Checks),
		cell(next),
		shown(outcome.Delivery),
		strconv.Itoa(outcome.Round),
		cost, steps, took,
		shown(run.StartedAt),
	)
}

func oldestFirst(history protocol.History) []protocol.HistoryConfig {
	oldest := map[string]int{}
	for at, run := range history.Runs {
		if run.Fingerprint != nil {
			oldest[*run.Fingerprint] = at
		}
	}

	ordered := slices.Clone(history.Configs)
	slices.SortStableFunc(ordered, func(a, b protocol.HistoryConfig) int {
		atA, usedA := oldest[a.Fingerprint]
		atB, usedB := oldest[b.Fingerprint]
		switch {
		case usedA && usedB:
			return cmp.Compare(atB, atA)
		case usedA:
			return 1
		case usedB:
			return -1
		}
		return 0
	})

	return ordered
}

func cell(text string) string {
	return strings.ReplaceAll(oneLine(text), "|", `\|`)
}

func plural(count int, one, many string) string {
	if count == 1 {
		return one
	}

	return many
}
