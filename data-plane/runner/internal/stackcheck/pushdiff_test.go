package stackcheck_test

import (
	"context"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"

	"usespotlight.ai/data-plane/protocol"
	"usespotlight.ai/data-plane/runner/internal/stackcheck"
)

type differ struct {
	mu       sync.Mutex
	diffs    []string
	bases    []string
	failures []string
	renewals int
	stop     bool
}

func (d *differ) RenewPushDiffLease(context.Context, string) (bool, error) {
	d.mu.Lock()
	defer d.mu.Unlock()
	d.renewals++
	return d.stop, nil
}

func (d *differ) RecordPushDiff(_ context.Context, _, diff, base string) error {
	d.mu.Lock()
	defer d.mu.Unlock()
	d.diffs = append(d.diffs, diff)
	d.bases = append(d.bases, base)
	return nil
}

func (d *differ) FailPushDiff(_ context.Context, _, reason string) error {
	d.mu.Lock()
	defer d.mu.Unlock()
	d.failures = append(d.failures, reason)
	return nil
}

type pushed struct {
	remote
	branched string
	baseTip  string
	head     string
}

func push(t *testing.T) pushed {
	t.Helper()

	r := setUp(t)
	origin := filepath.Join(r.origin, "widgets")

	lines := make([]string, 20)
	for at := range lines {
		lines[at] = "line " + string(rune('a'+at))
	}
	write(t, filepath.Join(origin, "long.txt"), strings.Join(lines, "\n")+"\n")
	git(t, origin, "add", "--all")
	git(t, origin, "commit", "--quiet", "--message", "long")
	branched := git(t, origin, "rev-parse", "HEAD")

	git(t, origin, "checkout", "--quiet", "-b", "feature")
	lines[10] = "pushed by a person"
	write(t, filepath.Join(origin, "long.txt"), strings.Join(lines, "\n")+"\n")
	git(t, origin, "commit", "--quiet", "--all", "--message", "push")
	head := git(t, origin, "rev-parse", "HEAD")

	git(t, origin, "checkout", "--quiet", "-")
	write(t, filepath.Join(origin, "main.txt"), "landed on the base branch\n")
	git(t, origin, "add", "--all")
	git(t, origin, "commit", "--quiet", "--message", "meanwhile")
	baseTip := git(t, origin, "rev-parse", "HEAD")

	return pushed{remote: r, branched: branched, baseTip: baseTip, head: head}
}

func (p pushed) diff() protocol.PushDiff {
	return protocol.PushDiff{DiffID: "pd_1", Repository: "widgets", BaseTip: p.baseTip, Head: p.head}
}

func TestPerformDiffDiffsAPushFromWhereItBranchedOff(t *testing.T) {
	p := push(t)
	reported := &differ{}

	stackcheck.PerformDiff(context.Background(), reported, p.diff(), p.options())

	if len(reported.failures) != 0 || len(reported.diffs) != 1 {
		t.Fatalf("diffs %q, failures %q", reported.diffs, reported.failures)
	}
	if reported.bases[0] != p.branched {
		t.Errorf("base %q, want the merge base %q", reported.bases[0], p.branched)
	}

	diff := reported.diffs[0]
	for _, want := range []string{"+pushed by a person", " line a", " line t"} {
		if !strings.Contains(diff, want) {
			t.Errorf("diff lacks %q:\n%s", want, diff)
		}
	}
	if strings.Contains(diff, "main.txt") {
		t.Errorf("diff contains what landed on the base branch:\n%s", diff)
	}
	if diff != strings.TrimSpace(diff) {
		t.Errorf("diff is not trimmed: %q", diff)
	}

	if entries, err := os.ReadDir(p.options().Dir); err != nil || len(entries) != 0 {
		t.Errorf("left %v behind in the workspace (%v)", entries, err)
	}
}

func TestPerformDiffSaysWhyAPushCouldNotBeDiffed(t *testing.T) {
	p := push(t)

	for _, spoiled := range []struct {
		name  string
		says  string
		spoil func(*protocol.PushDiff)
	}{
		{"no head", "no repository, base tip or head", func(d *protocol.PushDiff) { d.Head = "" }},
		{"no such commit", "git fetch:", func(d *protocol.PushDiff) { d.Head = "0123456789abcdef0123456789abcdef01234567" }},
		{"no such repository", "git fetch:", func(d *protocol.PushDiff) { d.Repository = "other" }},
	} {
		t.Run(spoiled.name, func(t *testing.T) {
			reported := &differ{}
			diff := p.diff()
			spoiled.spoil(&diff)

			stackcheck.PerformDiff(context.Background(), reported, diff, p.options())

			if len(reported.diffs) != 0 || len(reported.failures) != 1 {
				t.Fatalf("diffs %q, failures %q", reported.diffs, reported.failures)
			}
			if !strings.Contains(reported.failures[0], spoiled.says) {
				t.Errorf("failure %q, want it to say %q", reported.failures[0], spoiled.says)
			}
		})
	}
}

func TestPerformDiffStopsAPushDiffItNoLongerLeases(t *testing.T) {
	stalled := httptest.NewServer(http.HandlerFunc(func(_ http.ResponseWriter, r *http.Request) {
		<-r.Context().Done()
	}))
	t.Cleanup(stalled.Close)

	reported := &differ{stop: true}
	options := stackcheck.Options{
		Dir:    t.TempDir(),
		Remote: stalled.URL,
		Log:    slog.New(slog.NewTextHandler(io.Discard, nil)),
		Renew:  20 * time.Millisecond,
	}

	started := time.Now()
	stackcheck.PerformDiff(context.Background(), reported, protocol.PushDiff{
		DiffID: "pd_1", Repository: "widgets", BaseTip: "abc", Head: "def",
	}, options)

	if took := time.Since(started); took > 10*time.Second {
		t.Errorf("kept diffing for %s once the push diff was gone", took)
	}
	if reported.renewals == 0 || len(reported.diffs) != 0 || len(reported.failures) != 0 {
		t.Errorf("renewed %d times, diffs %q, failures %q", reported.renewals, reported.diffs, reported.failures)
	}
}
