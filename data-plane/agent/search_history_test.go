package agent

import (
	"bytes"
	"encoding/json"
	"errors"
	"io/fs"
	"maps"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"testing"

	"usespotlight.ai/data-plane/protocol"
)

func yes(value bool) *bool { return &value }

func searchHistory() protocol.History {
	history := sampleHistory()
	history.SeedBlock = json.RawMessage(`{"prompt":"Implement the task.","effort":"high"}`)

	priced := func(amount float64, currency string) *protocol.RunCost {
		return &protocol.RunCost{Steps: 3, Cost: &amount, Currency: &currency}
	}

	replayed := func(original, task string, succeeded *bool, verdict *string, reasons []string, changes []protocol.HistoryChange) protocol.CandidateRun {
		return protocol.CandidateRun{
			RunID: "run_of_" + original, TaskID: task, Title: "Replay of " + task, Fingerprint: text(newerFingerprint),
			State: "completed", Attempt: 1, Harness: "claude-code",
			Changes:  changes,
			Trace:    protocol.Trace{Roots: []protocol.TraceNode{}},
			Original: original, Succeeded: succeeded, Reasons: reasons, Verdict: verdict,
		}
	}

	candidates := []protocol.HistoryCandidate{
		{
			CandidateName: "terse", Fingerprint: newerFingerprint,
			Hypothesis: "Shorter prompts finish sooner.\n",
			Block:      json.RawMessage(`{"prompt":"Be brief.","effort":"high"}`),
			Runs: []protocol.CandidateRun{
				replayed("run_1", "task_1", yes(true), text("pass"), nil,
					[]protocol.HistoryChange{{Path: "api/upload.go", Before: "a\n", After: "b\n"}}),
				replayed("run_2", "task_2", yes(false), text("fail"), []string{"tests failed"}, nil),
				replayed("run_3", "task_3", nil, nil, nil, nil),
			},
		},
		{
			CandidateName: "untried", Fingerprint: olderFingerprint, Hypothesis: "Low effort is enough.",
			Block: json.RawMessage(`{"prompt":"Implement the task.","effort":"low"}`),
			Runs:  []protocol.CandidateRun{},
		},
	}

	candidates[0].Runs[0].Cost = priced(0.25, "USD")
	candidates[0].Runs[1].Cost = priced(0.5, "USD")
	candidates[0].Runs[2].Cost = priced(0.1, "EUR")
	history.Candidates = candidates

	return history
}

func TestHistoryWritesASearchsCandidatesAndTheBlockItStartedFrom(t *testing.T) {
	historian(t, searchHistory())
	root := t.TempDir()
	out := new(bytes.Buffer)

	if err := run([]string{"history", "--station", "implementation", "--out", root}, strings.NewReader(""), out); err != nil {
		t.Fatalf("run: %v", err)
	}
	dir := filepath.Join(root, "implementation")

	if !strings.Contains(out.String(), "2 candidates proposed so far, under "+filepath.Join(dir, "candidates")) {
		t.Errorf("receipt %q", out)
	}

	if got := readFile(t, filepath.Join(dir, "current.json")); got != "{\n  \"prompt\": \"Implement the task.\",\n  \"effort\": \"high\"\n}\n" {
		t.Errorf("current.json = %q", got)
	}

	terse := filepath.Join(dir, "candidates", "terse")
	if got := readFile(t, filepath.Join(terse, "block.json")); got != "{\n  \"prompt\": \"Be brief.\",\n  \"effort\": \"high\"\n}\n" {
		t.Errorf("block.json = %q", got)
	}
	if got := readFile(t, filepath.Join(terse, "hypothesis.md")); got != "Shorter prompts finish sooner.\n" {
		t.Errorf("hypothesis.md = %q", got)
	}
	if got := readFile(t, filepath.Join(terse, "changes.diff")); !strings.Contains(got, "-  \"prompt\": \"Implement the task.\",\n+  \"prompt\": \"Be brief.\",") {
		t.Errorf("changes.diff = %q", got)
	}

	var score struct {
		Succeeded int                `json:"succeeded"`
		Scored    int                `json:"scored"`
		Failed    []string           `json:"failed"`
		Verdicts  map[string]int     `json:"verdicts"`
		Spent     map[string]float64 `json:"spent"`
		Unpriced  int                `json:"unpriced"`
	}
	if err := json.Unmarshal([]byte(readFile(t, filepath.Join(terse, "score.json"))), &score); err != nil {
		t.Fatalf("score.json: %v", err)
	}
	if score.Succeeded != 1 || score.Scored != 2 || !slices.Equal(score.Failed, []string{"task_2"}) ||
		score.Verdicts["pass"] != 1 || score.Verdicts["fail"] != 1 || len(score.Verdicts) != 2 ||
		score.Spent["USD"] != 0.75 || score.Spent["EUR"] != 0.1 || len(score.Spent) != 2 || score.Unpriced != 0 {
		t.Errorf("score.json %+v", score)
	}

	if got := readFile(t, filepath.Join(terse, "runs", "run_1", "journal.md")); !strings.Contains(got, "# Replay of task_1") {
		t.Errorf("journal.md = %q", got)
	}
	if got := readFile(t, filepath.Join(terse, "runs", "run_1", "diff.patch")); !strings.Contains(got, "--- a/api/upload.go\n+++ b/api/upload.go\n") {
		t.Errorf("diff.patch = %q", got)
	}
	if _, err := os.Stat(filepath.Join(terse, "runs", "run_2", "diff.patch")); !errors.Is(err, os.ErrNotExist) {
		t.Errorf("a replay without changes got a patch: %v", err)
	}

	var result struct {
		RunID     string            `json:"runId"`
		Original  string            `json:"original"`
		TaskID    string            `json:"taskId"`
		Succeeded *bool             `json:"succeeded"`
		Reasons   []string          `json:"reasons"`
		Verdict   *string           `json:"verdict"`
		Cost      *protocol.RunCost `json:"cost"`
	}
	if err := json.Unmarshal([]byte(readFile(t, filepath.Join(terse, "runs", "run_2", "result.json"))), &result); err != nil {
		t.Fatalf("result.json: %v", err)
	}
	if result.RunID != "run_of_run_2" || result.Original != "run_2" || result.TaskID != "task_2" ||
		result.Succeeded == nil || *result.Succeeded || !slices.Equal(result.Reasons, []string{"tests failed"}) ||
		result.Verdict == nil || *result.Verdict != "fail" ||
		result.Cost == nil || *result.Cost.Cost != 0.5 || *result.Cost.Currency != "USD" {
		t.Errorf("result.json %+v", result)
	}

	untried := filepath.Join(dir, "candidates", "untried")
	if got := readFile(t, filepath.Join(untried, "score.json")); !strings.Contains(got, `"scored": 0`) || !strings.Contains(got, `"failed": []`) || !strings.Contains(got, `"spent": {}`) {
		t.Errorf("an untried candidate's score.json = %q", got)
	}

	index := readFile(t, filepath.Join(dir, "index.md"))
	for _, want := range []string{"## Candidates", "current.json", "| [terse](candidates/terse/score.json) | bbbbbbbbbbbb | 1 | 2 | 1 | 50% | Shorter prompts finish sooner. |"} {
		if !strings.Contains(index, want) {
			t.Errorf("index missing %q in\n%s", want, index)
		}
	}
}

func TestHistoryWritesExactlyTheCandidatesAndRunsItIsSent(t *testing.T) {
	history := searchHistory()
	historian(t, history)
	root := t.TempDir()

	if err := run([]string{"history", "--station", "implementation", "--out", root}, strings.NewReader(""), new(bytes.Buffer)); err != nil {
		t.Fatalf("run: %v", err)
	}

	sent := []string{}
	for _, candidate := range history.Candidates {
		sent = append(sent, filepath.Join("candidates", candidate.CandidateName))
		for _, ran := range candidate.Runs {
			sent = append(sent, filepath.Join("candidates", candidate.CandidateName, "runs", ran.Original))
		}
	}

	dir := filepath.Join(root, "implementation")
	written := []string{}
	err := filepath.WalkDir(filepath.Join(dir, "candidates"), func(path string, entry fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		relative, _ := filepath.Rel(dir, path)
		parent := filepath.Base(filepath.Dir(path))
		if entry.IsDir() && (parent == "candidates" || parent == "runs") {
			written = append(written, relative)
		}
		return nil
	})
	if err != nil {
		t.Fatal(err)
	}

	slices.Sort(sent)
	slices.Sort(written)
	if !slices.Equal(written, sent) {
		t.Errorf("wrote %v, want exactly %v", written, sent)
	}
}

func TestHistoryOfAStationRunWritesNoCandidates(t *testing.T) {
	server, err := serveHandover([]string{"spec"}, nil)
	if err != nil {
		t.Fatalf("serve: %v", err)
	}
	t.Cleanup(func() { _ = server.Close() })
	plain, err := json.Marshal(sampleHistory())
	if err != nil {
		t.Fatal(err)
	}
	var shaped map[string]json.RawMessage
	if err := json.Unmarshal(plain, &shaped); err != nil {
		t.Fatal(err)
	}
	shaped["candidates"] = json.RawMessage(`[]`)
	shaped["seedBlock"] = json.RawMessage(`null`)
	server.Histories(func(protocol.HistoryRequest) (json.RawMessage, error) { return json.Marshal(shaped) })
	t.Setenv(protocol.HandoverURLVar, server.URL())
	t.Setenv(protocol.HandoverTokenVar, server.Token())
	root := t.TempDir()
	out := new(bytes.Buffer)

	if err := run([]string{"history", "--station", "implementation", "--out", root}, strings.NewReader(""), out); err != nil {
		t.Fatalf("run: %v", err)
	}

	dir := filepath.Join(root, "implementation")
	for _, absent := range []string{"candidates", "current.json"} {
		if _, err := os.Stat(filepath.Join(dir, absent)); !errors.Is(err, os.ErrNotExist) {
			t.Errorf("%s written for a station run: %v", absent, err)
		}
	}
	if strings.Contains(readFile(t, filepath.Join(dir, "index.md")), "## Candidates") || strings.Contains(out.String(), "candidate") {
		t.Error("a station run's history speaks of candidates")
	}
}

func TestHistoryRejectsACandidateOrReplayNamedOutsideItsFolder(t *testing.T) {
	for _, spoil := range []func(*protocol.History){
		func(h *protocol.History) { h.Candidates[0].CandidateName = "../escape" },
		func(h *protocol.History) { h.Candidates[0].Runs[0].Original = "../../runs" },
		func(h *protocol.History) { h.Candidates[0].Runs[0].Original = "" },
		func(h *protocol.History) { h.Candidates[1].CandidateName = "Terse" },
		func(h *protocol.History) { h.Candidates[0].Runs[1].Original = h.Candidates[0].Runs[0].Original },
	} {
		history := searchHistory()
		spoil(&history)
		historian(t, history)
		root := t.TempDir()

		err := run([]string{"history", "--station", "implementation", "--out", root}, strings.NewReader(""), new(bytes.Buffer))

		if err == nil || !strings.Contains(err.Error(), "Spotlight named") {
			t.Errorf("err = %v", err)
		}
		if _, statErr := os.Stat(filepath.Join(root, "implementation")); !errors.Is(statErr, os.ErrNotExist) {
			t.Errorf("wrote a history anyway: %v", statErr)
		}
	}
}

func TestSearchFilesKeepEachCopyOfARepeatedRunApartAndRateEachTaskByItsCopies(t *testing.T) {
	copyOf := func(original, task string, repeat int, succeeded bool) protocol.CandidateRun {
		return protocol.CandidateRun{
			RunID: "run_of_" + original + "_" + string(rune('0'+repeat)), TaskID: task, State: "completed",
			Trace: protocol.Trace{Roots: []protocol.TraceNode{}}, Original: original, Repeat: repeat, Succeeded: yes(succeeded),
		}
	}
	history := protocol.History{Candidates: []protocol.HistoryCandidate{{
		CandidateName: "twice", Fingerprint: newerFingerprint, Hypothesis: "Twice is surer.",
		Block: json.RawMessage(`{"prompt":"Be sure."}`),
		Runs: []protocol.CandidateRun{
			copyOf("run_1", "task_1", 1, true),
			copyOf("run_2", "task_2", 1, false),
			copyOf("run_1", "task_1", 2, false),
			copyOf("run_2", "task_2", 2, false),
		},
	}}}
	files := map[string]string{}

	if err := searchFiles(files, history); err != nil {
		t.Fatalf("searchFiles: %v", err)
	}
	for _, each := range []string{"runs/run_1/1/result.json", "runs/run_1/2/result.json", "runs/run_2/1/journal.md", "runs/run_2/2/journal.md"} {
		if _, ok := files[filepath.Join("candidates", "twice", filepath.FromSlash(each))]; !ok {
			t.Errorf("no %s among %v", each, slices.Sorted(maps.Keys(files)))
		}
	}

	var score struct {
		Succeeded   int      `json:"succeeded"`
		Scored      int      `json:"scored"`
		Repeats     int      `json:"repeats"`
		TasksScored int      `json:"tasksScored"`
		Rate        *float64 `json:"rate"`
		Failed      []string `json:"failed"`
	}
	if err := json.Unmarshal([]byte(files[filepath.Join("candidates", "twice", "score.json")]), &score); err != nil {
		t.Fatalf("score.json: %v", err)
	}
	if score.Succeeded != 1 || score.Scored != 4 || score.Repeats != 2 || score.TasksScored != 2 || score.Rate == nil || *score.Rate != 0.25 || !slices.Equal(score.Failed, []string{"task_2", "task_1"}) {
		t.Errorf("score.json %+v", score)
	}
	if index := candidatesIndex(history); !strings.Contains(index, "| 1 | 4 | 2 | 25% |") || !strings.Contains(index, "runs/<original>/<copy>/") {
		t.Errorf("index:\n%s", index)
	}
}
