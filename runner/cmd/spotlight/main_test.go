package main

import (
	"bytes"
	"strings"
	"testing"

	"usespotlight.ai/runner/internal/declare"
)

func inARun(t *testing.T) *declare.Server {
	t.Helper()

	server, err := declare.Serve([]string{"Spec", "review"}, 0, nil)
	if err != nil {
		t.Fatalf("serve: %v", err)
	}
	t.Cleanup(func() { _ = server.Close() })

	t.Setenv(declare.URLVar, server.URL())
	t.Setenv(declare.TokenVar, server.Token())

	return server
}

func TestHandsOver(t *testing.T) {
	server := inARun(t)
	out := new(bytes.Buffer)

	args := []string{"handover", "--next", "Spec", "--note", "the queue drains twice"}
	if err := run(args, strings.NewReader(""), out); err != nil {
		t.Fatalf("run: %v", err)
	}

	declared := server.Declared()
	if declared == nil || declared.Next != "Spec" || declared.Note != "the queue drains twice" {
		t.Fatalf("got %+v", declared)
	}

	if !strings.Contains(out.String(), "Spec") {
		t.Fatalf("said nothing useful: %q", out)
	}
}

// A note is prose, and prose through shell quoting is where agents come
// unstuck, so it may be piped instead.
func TestTakesTheNoteFromStandardInput(t *testing.T) {
	server := inARun(t)

	piped := strings.NewReader("first line\nsecond line\n")
	if err := run([]string{"handover", "--next", "review"}, piped, new(bytes.Buffer)); err != nil {
		t.Fatalf("run: %v", err)
	}

	if note := server.Declared().Note; note != "first line\nsecond line" {
		t.Fatalf("got %q", note)
	}
}

// The reason this is a command and not a file: the agent is told, in its own
// terminal, that it got the name wrong, and can try again.
func TestSaysWhatWouldHaveWorked(t *testing.T) {
	inARun(t)

	err := run([]string{"handover", "--next", "Deployment"}, strings.NewReader(""), new(bytes.Buffer))
	if err == nil {
		t.Fatal("expected a refusal")
	}

	for _, wanted := range []string{"Deployment", "Spec", "review"} {
		if !strings.Contains(err.Error(), wanted) {
			t.Fatalf("refusal %q never mentions %q", err, wanted)
		}
	}
}

func TestNextIsRequired(t *testing.T) {
	inARun(t)

	err := run([]string{"handover", "--note", "orphaned"}, strings.NewReader(""), new(bytes.Buffer))
	if err == nil || !strings.Contains(err.Error(), "--next") {
		t.Fatalf("got %v", err)
	}
}

func TestOutsideARunItSaysSo(t *testing.T) {
	t.Setenv(declare.URLVar, "")
	t.Setenv(declare.TokenVar, "")

	err := run([]string{"handover", "--next", "Spec"}, strings.NewReader(""), new(bytes.Buffer))
	if err == nil || !strings.Contains(err.Error(), "no run") {
		t.Fatalf("got %v", err)
	}
}

func TestUnknownCommandShowsUsage(t *testing.T) {
	err := run([]string{"deploy"}, strings.NewReader(""), new(bytes.Buffer))
	if err == nil || !strings.Contains(err.Error(), "handover") {
		t.Fatalf("got %v", err)
	}
}

func TestPuttingItToAPersonDoesNotSoundLikeAStation(t *testing.T) {
	inARun(t)
	out := new(bytes.Buffer)

	if err := run(
		[]string{"handover", "--next", "review", "--note", "needs a decision"},
		strings.NewReader(""),
		out,
	); err != nil {
		t.Fatalf("run: %v", err)
	}

	said := out.String()

	if !strings.Contains(said, "person") {
		t.Errorf("did not say who it went to: %q", said)
	}
	if strings.Contains(said, "Handed over") {
		t.Errorf("read as a station handover: %q", said)
	}
}
