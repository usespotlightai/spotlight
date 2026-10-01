package agent

import (
	"bytes"
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"usespotlight.ai/data-plane/protocol"
)

func historian(t *testing.T, history protocol.History) *[]protocol.HistoryRequest {
	t.Helper()

	server, err := serveHandover([]string{"spec"}, nil)
	if err != nil {
		t.Fatalf("serve: %v", err)
	}
	t.Cleanup(func() { _ = server.Close() })

	var asked []protocol.HistoryRequest
	server.Histories(func(request protocol.HistoryRequest) (json.RawMessage, error) {
		asked = append(asked, request)
		return json.Marshal(history)
	})

	t.Setenv(protocol.HandoverURLVar, server.URL())
	t.Setenv(protocol.HandoverTokenVar, server.Token())

	return &asked
}

func text(value string) *string { return &value }

const (
	olderFingerprint = "aaaaaaaaaaaa1111111111111111111111111111111111111111111111111111"
	newerFingerprint = "bbbbbbbbbbbb2222222222222222222222222222222222222222222222222222"
)

func sampleHistory() protocol.History {
	tool, status := "bash", "completed"
	given := "{\"command\":\"go test ./...\"}"
	returned := "--- FAIL: TestUploadRetries (0.02s)\n    upload_test.go:41: ```retry``` gave up after 3 tries\nFAIL"
	failure, checks, delivery := "tests-failed", "failed", "open"
	ms, cost, currency := 90000, 0.42, "USD"
	line := 12
	editedPath := "api/upload.go"

	older := protocol.StationConfig{
		Prompt:  text("Implement the task.\n"),
		Harness: "claude-code", Model: text("opus"), Effort: text("high"),
		Repositories: []protocol.ConfigRepository{{Name: "api", Setup: text("npm ci")}},
		Skills:       []protocol.ConfigSkill{{Key: "tdd", Digest: "1111111111111111"}},
		Tools:        []string{"linear"},
		Decisions:    true,
	}
	newer := older
	newer.Prompt = text("Implement the task.\nRun the tests first.\n")
	newer.Effort = text("xhigh")
	newer.Skills = []protocol.ConfigSkill{{Key: "tdd", Digest: "2222222222222222"}, {Key: "review", Digest: "3333"}}
	newer.Tools = nil
	newer.Memories = true
	newer.Judge = &protocol.ConfigJudge{RubricDigest: "cccc", Sample: 0.2, Trust: 0.6}
	newer.Profile = &protocol.ConfigProfile{Key: "fast", Settings: json.RawMessage(`{"b":[1,{"c":true}],"a":null}`)}

	return protocol.History{
		Line:    protocol.HistoryPlace{Key: "delivery", Name: "Delivery"},
		Station: protocol.HistoryPlace{Key: "implementation", Name: "Implementation"},
		Configs: []protocol.HistoryConfig{
			{Fingerprint: newerFingerprint, Config: newer},
			{Fingerprint: olderFingerprint, Config: older},
		},
		Runs: []protocol.HistoryRun{
			{
				RunID: "run_2", TaskID: "task_2", Title: "Retry | uploads", Fingerprint: text(newerFingerprint),
				State: "completed", Attempt: 1, Harness: "claude-code",
				StartedAt: text("2026-09-29T10:00:00Z"), EndedAt: text("2026-09-29T10:01:30Z"),
				Outcome: &protocol.RunOutcome{
					Ending: "failed", Failure: &failure, Round: 2,
					Cost:   &protocol.RunCost{Ms: &ms, Steps: 14, Faults: 1, Cost: &cost, Currency: &currency},
					Checks: &checks, Next: &protocol.RunNext{Act: "asked", At: "2026-09-29T10:01:31Z"}, Delivery: &delivery,
				},
				Changes: []protocol.HistoryChange{
					{Path: "api/upload.go", Before: "package api\n\nfunc upload() {}\n", After: "package api\n\nfunc upload() { retry() }\n"},
					{Path: "api/retry.go", Before: "", After: "package api\n"},
				},
				Trace: protocol.Trace{
					Ms: 90000, Rows: 3, Faults: 1,
					Roots: []protocol.TraceNode{{
						ID: "run:2", Kind: "run", Name: "Run", Ms: 90000, Tone: "agent",
						Children: []protocol.TraceNode{
							{
								ID: "2:step:0", Kind: "step", Name: "go test ./...", Ms: 800, Tone: "failed",
								Step: &protocol.TraceStep{
									Kind: "tool", Text: "go test ./...", Tool: &tool, Status: &status,
									Given: &given, Returned: &returned,
									Locations: []protocol.TraceLocation{{Path: "api/upload_test.go", Line: &line}},
								},
							},
							{
								ID: "2:step:1", Kind: "step", Name: "Edit upload.go", Ms: 20, Tone: "agent",
								Step: &protocol.TraceStep{
									Kind: "edit", Text: "Edit upload.go",
									Change: &protocol.TraceChange{Path: &editedPath, Before: "func upload() {}\n", After: "func upload() { retry() }\n"},
								},
								Children: []protocol.TraceNode{{
									ID: "span:1", Kind: "span", Name: "gopls check", Ms: 5, Tone: "span",
									Span: &protocol.TraceSpan{
										ID: "span:1", Name: "gopls check", Ms: 5,
										Attributes: []protocol.TraceAttribute{{Name: "file", Value: "api/upload.go"}},
									},
								}},
							},
						},
					}},
				},
			},
			{
				RunID: "run_1", TaskID: "task_1", Title: "First go", Fingerprint: text(olderFingerprint),
				State: "completed", Attempt: 1, Harness: "claude-code",
				Outcome: &protocol.RunOutcome{Ending: "completed", Round: 1},
				Trace:   protocol.Trace{Roots: []protocol.TraceNode{}},
			},
		},
	}
}

func readFile(t *testing.T, path string) string {
	t.Helper()

	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("read %s: %v", path, err)
	}
	return string(data)
}

func TestHistoryWritesAGreppableTreeOfTheStationsRuns(t *testing.T) {
	asked := historian(t, sampleHistory())
	root := t.TempDir()
	out := new(bytes.Buffer)

	err := run([]string{
		"history", "--station", "implementation", "--line", "delivery",
		"--outcome", "failed", "--since", "2026-09-01", "--last", "30", "--out", root,
	}, strings.NewReader(""), out)
	if err != nil {
		t.Fatalf("run: %v", err)
	}

	want := protocol.HistoryRequest{
		Station: "implementation", Line: "delivery", Outcome: "failed", Since: "2026-09-01", Last: 30,
	}
	if len(*asked) != 1 || (*asked)[0] != want {
		t.Fatalf("asked %+v, want %+v", *asked, want)
	}

	dir := filepath.Join(root, "implementation")
	for _, want := range []string{dir, "2 runs of delivery/implementation across 2 configs", "grep -r"} {
		if !strings.Contains(out.String(), want) {
			t.Errorf("receipt missing %q in %q", want, out)
		}
	}

	index := readFile(t, filepath.Join(dir, "index.md"))
	for _, want := range []string{
		"# Delivery / Implementation",
		"[run_2](runs/run_2/journal.md) | Retry \\| uploads | bbbbbbbbbbbb | failed (tests-failed) | failed | asked | open | 2 | 0.42 USD | 14 | 90.0s |",
		"effort high → xhigh",
		"prompt changed",
		"+Run the tests first.",
		"skill tdd changed (111111111111 → 222222222222)",
		"skill review added",
		"tool linear removed",
		"profile fast added",
		"memories off → on",
		"judge added",
		"- the oldest config here",
	} {
		if !strings.Contains(index, want) {
			t.Errorf("index missing %q in\n%s", want, index)
		}
	}
	if strings.Index(index, "### aaaaaaaaaaaa") > strings.Index(index, "### bbbbbbbbbbbb") {
		t.Errorf("configs not oldest first:\n%s", index)
	}

	journal := readFile(t, filepath.Join(dir, "runs", "run_2", "journal.md"))
	for _, want := range []string{
		"# Retry | uploads",
		"- config: " + newerFingerprint,
		"## 1 Run",
		"### 1.1 go test ./...",
		"- tool: bash",
		`{"command":"go test ./..."}`,
		"upload_test.go:41: ```retry``` gave up after 3 tries",
		"````\n--- FAIL: TestUploadRetries",
		"- api/upload_test.go:12",
		"```diff\n--- a/api/upload.go\n+++ b/api/upload.go\n@@ -1 +1 @@\n-func upload() {}\n+func upload() { retry() }\n```",
		"#### 1.2.1 gopls check",
		"- file: api/upload.go",
	} {
		if !strings.Contains(journal, want) {
			t.Errorf("journal missing %q in\n%s", want, journal)
		}
	}

	var outcome struct {
		RunID       string               `json:"runId"`
		TaskID      string               `json:"taskId"`
		Fingerprint *string              `json:"fingerprint"`
		Outcome     *protocol.RunOutcome `json:"outcome"`
	}
	if err := json.Unmarshal([]byte(readFile(t, filepath.Join(dir, "runs", "run_2", "outcome.json"))), &outcome); err != nil {
		t.Fatalf("outcome.json: %v", err)
	}
	if outcome.RunID != "run_2" || outcome.TaskID != "task_2" || *outcome.Fingerprint != newerFingerprint ||
		outcome.Outcome.Ending != "failed" || *outcome.Outcome.Cost.Cost != 0.42 {
		t.Errorf("outcome.json %+v", outcome)
	}

	patch := readFile(t, filepath.Join(dir, "runs", "run_2", "diff.patch"))
	for _, want := range []string{
		"--- a/api/upload.go\n+++ b/api/upload.go\n@@ -1,3 +1,3 @@\n package api\n \n-func upload() {}\n+func upload() { retry() }\n",
		"--- /dev/null\n+++ b/api/retry.go\n@@ -0,0 +1 @@\n+package api\n",
	} {
		if !strings.Contains(patch, want) {
			t.Errorf("patch missing %q in\n%s", want, patch)
		}
	}

	if _, err := os.Stat(filepath.Join(dir, "runs", "run_1", "diff.patch")); !errors.Is(err, os.ErrNotExist) {
		t.Errorf("a run without changes got a patch: %v", err)
	}

	config := readFile(t, filepath.Join(dir, "configs", newerFingerprint+".yml"))
	for _, want := range []string{`effort: "xhigh"`, "  settings:\n    \"a\": null\n    \"b\":\n      - 1\n      -\n        \"c\": true\n"} {
		if !strings.Contains(config, want) {
			t.Errorf("config missing %q in\n%s", want, config)
		}
	}
}

func TestHistoryNamesAFileTooLargeToSendInsteadOfDiffingIt(t *testing.T) {
	root := t.TempDir()
	history := sampleHistory()
	history.Runs[0].Changes = []protocol.HistoryChange{{Path: "data/fixtures.json", Omitted: true}}
	historian(t, history)

	if err := run(
		[]string{"history", "--station", "implementation", "--out", root}, strings.NewReader(""), new(bytes.Buffer),
	); err != nil {
		t.Fatalf("run: %v", err)
	}

	patch := readFile(t, filepath.Join(root, "implementation", "runs", history.Runs[0].RunID, "diff.patch"))
	if patch != "Omitted data/fixtures.json: too large to send whole\n" {
		t.Errorf("patch = %q", patch)
	}
}

func TestHistoryRewritesOnlyItsOwnStation(t *testing.T) {
	root := t.TempDir()
	stale := filepath.Join(root, "implementation", "runs", "run_gone", "journal.md")
	neighbour := filepath.Join(root, "review", "index.md")
	for _, path := range []string{stale, neighbour} {
		if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(path, []byte("old"), 0o644); err != nil {
			t.Fatal(err)
		}
	}
	historian(t, sampleHistory())

	if err := run(
		[]string{"history", "--station", "implementation", "--out", root}, strings.NewReader(""), new(bytes.Buffer),
	); err != nil {
		t.Fatalf("run: %v", err)
	}

	if _, err := os.Stat(stale); !errors.Is(err, os.ErrNotExist) {
		t.Errorf("stale run left behind: %v", err)
	}
	if readFile(t, neighbour) != "old" {
		t.Error("another station's history was touched")
	}
}

func TestHistoryDefaultsToTheWorkspacesSpotlightFolder(t *testing.T) {
	historian(t, sampleHistory())
	t.Chdir(t.TempDir())

	if err := run(
		[]string{"history", "--station", "implementation"}, strings.NewReader(""), new(bytes.Buffer),
	); err != nil {
		t.Fatalf("run: %v", err)
	}

	if _, err := os.Stat(filepath.Join(".spotlight", "history", "implementation", "index.md")); err != nil {
		t.Fatalf("no index in the workspace: %v", err)
	}
}

func TestHistoryNeedsAStationThatIsOneFolder(t *testing.T) {
	historian(t, sampleHistory())

	for _, args := range [][]string{{"history"}, {"history", "--station", "../escape"}, {"history", "--station", "x", "--last", "-1"}} {
		if err := run(args, strings.NewReader(""), new(bytes.Buffer)); err == nil {
			t.Errorf("%v was accepted", args)
		}
	}
}

func TestHistoryCarriesSpotlightsRefusalToTheAgent(t *testing.T) {
	server, err := serveHandover([]string{"spec"}, nil)
	if err != nil {
		t.Fatalf("serve: %v", err)
	}
	t.Cleanup(func() { _ = server.Close() })
	server.Histories(func(protocol.HistoryRequest) (json.RawMessage, error) {
		return nil, errors.New("Several lines have a station by that key; name one with --line: delivery, maintenance")
	})
	t.Setenv(protocol.HandoverURLVar, server.URL())
	t.Setenv(protocol.HandoverTokenVar, server.Token())
	root := t.TempDir()

	err = run([]string{"history", "--station", "implementation", "--out", root}, strings.NewReader(""), new(bytes.Buffer))

	if err == nil || !strings.Contains(err.Error(), "name one with --line") {
		t.Fatalf("err = %v", err)
	}
	if _, statErr := os.Stat(filepath.Join(root, "implementation")); !errors.Is(statErr, os.ErrNotExist) {
		t.Errorf("wrote a history anyway: %v", statErr)
	}
}
