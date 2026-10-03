package agent

import (
	"bytes"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"usespotlight.ai/data-plane/protocol"
)

func causer(t *testing.T, status int, body string) *[]protocol.CauseRecord {
	t.Helper()

	server, err := serveHandover([]string{"spec"}, nil)
	if err != nil {
		t.Fatalf("serve: %v", err)
	}
	t.Cleanup(func() { _ = server.Close() })

	var asked []protocol.CauseRecord
	server.Causes(func(record protocol.CauseRecord) (int, string) {
		asked = append(asked, record)
		return status, body
	})

	t.Setenv(protocol.HandoverURLVar, server.URL())
	t.Setenv(protocol.HandoverTokenVar, server.Token())

	return &asked
}

const recordedJudge = `{"taskId":"task_1","cause":"judge","replayRunId":"replayed_1"}`

func TestCauseRecordsTheCauseOfAFailingTask(t *testing.T) {
	asked := causer(t, 200, recordedJudge)
	out := new(bytes.Buffer)

	err := run([]string{
		"cause", "--task", "task_1", "--cause", "judge",
		"--evidence", "The rubric asks for tests the task never needed.", "--suggestion", "Drop that line.",
	}, strings.NewReader(""), out)
	if err != nil {
		t.Fatalf("run: %v", err)
	}

	want := protocol.CauseRecord{
		TaskID: "task_1", Cause: "judge",
		Evidence: "The rubric asks for tests the task never needed.", Suggestion: "Drop that line.",
	}
	if len(*asked) != 1 || (*asked)[0] != want {
		t.Errorf("recorded %+v", *asked)
	}
	for _, said := range []string{"Recorded judge as the cause for task task_1, whose replay run replayed_1 failed.", "replaces this one"} {
		if !strings.Contains(out.String(), said) {
			t.Errorf("said %q, missing %q", out, said)
		}
	}
}

func TestCauseReadsItsEvidenceAndSuggestionFromFiles(t *testing.T) {
	asked := causer(t, 201, recordedJudge)
	dir := t.TempDir()
	evidence := filepath.Join(dir, "evidence.md")
	suggestion := filepath.Join(dir, "suggestion.md")
	if err := os.WriteFile(evidence, []byte("Step 12 shows\nthe judge misread it.\n"), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(suggestion, []byte("Say what passing means.\n"), 0o644); err != nil {
		t.Fatal(err)
	}

	err := run([]string{"cause", "--task", "task_1", "--cause", "judge", "--evidence", "@" + evidence, "--suggestion", "@" + suggestion},
		strings.NewReader(""), new(bytes.Buffer))
	if err != nil {
		t.Fatalf("run: %v", err)
	}

	if len(*asked) != 1 || (*asked)[0].Evidence != "Step 12 shows\nthe judge misread it." || (*asked)[0].Suggestion != "Say what passing means." {
		t.Errorf("recorded %+v", *asked)
	}
}

func TestCauseRefusesMisuseBeforeAskingSpotlight(t *testing.T) {
	asked := causer(t, 200, recordedJudge)

	for _, args := range [][]string{
		{"cause"},
		{"cause", "--cause", "judge", "--evidence", "x"},
		{"cause", "--task", "task_1", "--evidence", "x"},
		{"cause", "--task", "task_1", "--cause", "luck", "--evidence", "x"},
		{"cause", "--task", "task_1", "--cause", "judge"},
		{"cause", "--task", "task_1", "--cause", "judge", "--evidence", "x", "extra"},
		{"cause", "--task", "task_1", "--cause", "judge", "--evidence", "x", "--colour", "red"},
	} {
		err := run(args, strings.NewReader(""), new(bytes.Buffer))
		if err == nil || !strings.Contains(err.Error(), "usage:") {
			t.Errorf("%v said %v", args, err)
		}
	}
	if err := run([]string{"cause", "--task", "task_1", "--cause", "judge", "--evidence", "@" + filepath.Join(t.TempDir(), "gone.md")},
		strings.NewReader(""), new(bytes.Buffer)); err == nil || !strings.Contains(err.Error(), "read the evidence") {
		t.Errorf("a missing evidence file said %v", err)
	}
	if len(*asked) != 0 {
		t.Errorf("recorded anyway: %+v", *asked)
	}
}

func TestCauseCarriesARefusal(t *testing.T) {
	causer(t, 422, "No failing task task_9 among the tasks this reflection looks into\n")

	err := run([]string{"cause", "--task", "task_9", "--cause", "task", "--evidence", "x"}, strings.NewReader(""), new(bytes.Buffer))

	if err == nil || err.Error() != "No failing task task_9 among the tasks this reflection looks into" {
		t.Fatalf("err = %v", err)
	}
}

func TestCauseSaysWhenTheRunCannotRecordOne(t *testing.T) {
	server, err := serveHandover([]string{"spec"}, nil)
	if err != nil {
		t.Fatalf("serve: %v", err)
	}
	t.Cleanup(func() { _ = server.Close() })
	t.Setenv(protocol.HandoverURLVar, server.URL())
	t.Setenv(protocol.HandoverTokenVar, server.Token())

	err = run([]string{"cause", "--task", "task_1", "--cause", "judge", "--evidence", "x"}, strings.NewReader(""), new(bytes.Buffer))
	if err == nil || !strings.Contains(err.Error(), "only a search's runs do") {
		t.Fatalf("got %v", err)
	}
}

func TestCauseOutsideARunSaysSo(t *testing.T) {
	t.Setenv(protocol.HandoverURLVar, "")
	t.Setenv(protocol.HandoverTokenVar, "")

	err := run([]string{"cause", "--task", "task_1", "--cause", "judge", "--evidence", "x"}, strings.NewReader(""), new(bytes.Buffer))
	if err == nil || !strings.Contains(err.Error(), "no run") {
		t.Fatalf("got %v", err)
	}
}
