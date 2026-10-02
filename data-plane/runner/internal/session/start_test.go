package session

import (
	"context"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"

	"usespotlight.ai/data-plane/protocol"
)

type toldStarts struct {
	told []protocol.StartingPoint
}

func (s *toldStarts) RecordStartingPoint(_ context.Context, _ string, point protocol.StartingPoint) error {
	s.told = append(s.told, point)
	return nil
}

func committed(t *testing.T, dir, path string) string {
	t.Helper()

	repository := filepath.Join(dir, path)
	if err := os.MkdirAll(repository, 0o755); err != nil {
		t.Fatal(err)
	}
	git(t, repository, "init", "--quiet")
	git(t, repository, "commit", "--quiet", "--allow-empty", "--message", "start")

	return git(t, repository, "rev-parse", "HEAD")
}

func TestRecordsTheArchiveRestoredAndTheCommitEachCheckoutIsAt(t *testing.T) {
	if _, err := exec.LookPath("git"); err != nil {
		t.Skip("git is not installed")
	}

	dir := t.TempDir()
	api := committed(t, dir, "api")
	web := committed(t, dir, "web")

	to := &toldStarts{}
	run := protocol.Run{ID: "run_1", Attempt: 2, Spec: protocol.Spec{Checkouts: []protocol.Checkout{{Path: "api"}, {Path: "web"}}}}

	if err := recordStart(context.Background(), to, run, dir, "archive_1"); err != nil {
		t.Fatalf("record: %v", err)
	}

	if len(to.told) != 1 {
		t.Fatalf("told %d starting points, want one", len(to.told))
	}
	told := to.told[0]
	if told.Attempt != 2 {
		t.Errorf("told attempt %d, want the one the run was handed on", told.Attempt)
	}
	if told.ArchiveID == nil || *told.ArchiveID != "archive_1" {
		t.Errorf("told archive %v, want archive_1", told.ArchiveID)
	}
	want := []protocol.StartedCheckout{{Path: "api", Commit: api}, {Path: "web", Commit: web}}
	if len(told.Checkouts) != 2 || told.Checkouts[0] != want[0] || told.Checkouts[1] != want[1] {
		t.Errorf("told checkouts %+v, want %+v", told.Checkouts, want)
	}
	if len(api) != 40 {
		t.Errorf("a commit is named by %q, not its full SHA", api)
	}
}

func TestRecordsARunThatRestoredNothingAsStartingAfresh(t *testing.T) {
	to := &toldStarts{}

	if err := recordStart(context.Background(), to, protocol.Run{ID: "run_1"}, t.TempDir(), ""); err != nil {
		t.Fatalf("record: %v", err)
	}

	if len(to.told) != 1 || to.told[0].ArchiveID != nil || len(to.told[0].Checkouts) != 0 {
		t.Errorf("told %+v, want a start from no archive and no checkouts", to.told)
	}
}

func TestTellsNothingWhenACheckoutHasNoCommitToName(t *testing.T) {
	if _, err := exec.LookPath("git"); err != nil {
		t.Skip("git is not installed")
	}

	dir := t.TempDir()
	committed(t, dir, "api")
	to := &toldStarts{}
	run := protocol.Run{ID: "run_1", Spec: protocol.Spec{Checkouts: []protocol.Checkout{{Path: "api"}, {Path: "missing"}}}}

	err := recordStart(context.Background(), to, run, dir, "")

	if err == nil || !strings.Contains(err.Error(), "missing") {
		t.Errorf("recording a checkout that is not there said %v", err)
	}
	if len(to.told) != 0 {
		t.Errorf("told %+v, want nothing", to.told)
	}
}
