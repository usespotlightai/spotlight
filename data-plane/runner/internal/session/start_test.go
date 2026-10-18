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

type recordedStarts struct {
	points []protocol.StartingPoint
}

func (s *recordedStarts) RecordStartingPoint(_ context.Context, _ string, point protocol.StartingPoint) error {
	s.points = append(s.points, point)
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

	to := &recordedStarts{}
	run := protocol.Run{ID: "run_1", Attempt: 2, Spec: protocol.Spec{Checkouts: []protocol.Checkout{{Path: "api"}, {Path: "web"}}}}

	if err := recordStart(context.Background(), to, run, dir, "archive_1"); err != nil {
		t.Fatalf("record: %v", err)
	}

	if len(to.points) != 1 {
		t.Fatalf("recorded %d starting points, want one", len(to.points))
	}
	point := to.points[0]
	if point.Attempt != 2 {
		t.Errorf("recorded attempt %d, want the attempt of the run", point.Attempt)
	}
	if point.ArchiveID == nil || *point.ArchiveID != "archive_1" {
		t.Errorf("recorded archive %v, want archive_1", point.ArchiveID)
	}
	want := []protocol.StartedCheckout{{Path: "api", Commit: api}, {Path: "web", Commit: web}}
	if len(point.Checkouts) != 2 || point.Checkouts[0] != want[0] || point.Checkouts[1] != want[1] {
		t.Errorf("recorded checkouts %+v, want %+v", point.Checkouts, want)
	}
	if len(api) != 40 {
		t.Errorf("a commit is named by %q, not its full SHA", api)
	}
}

func TestRecordsARunThatRestoredNothingAsStartingAfresh(t *testing.T) {
	to := &recordedStarts{}

	if err := recordStart(context.Background(), to, protocol.Run{ID: "run_1"}, t.TempDir(), ""); err != nil {
		t.Fatalf("record: %v", err)
	}

	if len(to.points) != 1 || to.points[0].ArchiveID != nil || len(to.points[0].Checkouts) != 0 {
		t.Errorf("recorded %+v, want a start from no archive and no checkouts", to.points)
	}
}

func TestTellsNothingWhenACheckoutHasNoCommitToName(t *testing.T) {
	if _, err := exec.LookPath("git"); err != nil {
		t.Skip("git is not installed")
	}

	dir := t.TempDir()
	committed(t, dir, "api")
	to := &recordedStarts{}
	run := protocol.Run{ID: "run_1", Spec: protocol.Spec{Checkouts: []protocol.Checkout{{Path: "api"}, {Path: "missing"}}}}

	err := recordStart(context.Background(), to, run, dir, "")

	if err == nil || !strings.Contains(err.Error(), "missing") {
		t.Errorf("recording a checkout that is not there said %v", err)
	}
	if len(to.points) != 0 {
		t.Errorf("recorded %+v, want nothing", to.points)
	}
}
