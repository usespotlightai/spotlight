package serve_test

import (
	"context"
	"encoding/json"
	"slices"
	"strings"
	"testing"
	"time"

	"usespotlight.ai/data-plane/host/internal/sandbox"
	"usespotlight.ai/data-plane/host/internal/serve"
	"usespotlight.ai/data-plane/protocol"
)

func warmSandbox(sandboxID, setup string) protocol.Assignment {
	each := sandboxOnly(sandboxID)
	each.Work.Warm = &protocol.WarmSandbox{Line: "line_1", Checkouts: []protocol.WarmCheckout{{Path: "web", Setup: setup}}}
	return each
}

func runWithSetup(runner, setup string) protocol.Assignment {
	each := assignment(runner)
	each.Work.Run.Spec.Checkouts = []protocol.Checkout{{Path: "web", Setup: setup}}
	return each
}

func (p *pool) sandboxClaims() []time.Time {
	p.mu.Lock()
	defer p.mu.Unlock()
	var at []time.Time
	for _, each := range p.intoClaims {
		at = append(at, each.at)
	}
	return at
}

func (p *pool) claimedFor() []string {
	p.mu.Lock()
	defer p.mu.Unlock()
	var sandboxes []string
	for _, each := range p.intoClaims {
		sandboxes = append(sandboxes, each.sandbox)
	}
	return sandboxes
}

func opened(t *testing.T, engine *fakeEngine, id string, record protocol.SetupRecord) {
	t.Helper()
	body, err := json.Marshal(record)
	if err != nil {
		t.Fatal(err)
	}
	engine.Put(context.Background(), id, sandbox.File{Path: protocol.SetupRecordPath, Mode: 0o644, Body: body})
	engine.Put(context.Background(), id, sandbox.File{Path: protocol.SandboxWorkspaceOpen, Mode: 0o644})
}

func setUp() protocol.SetupRecord {
	return protocol.SetupRecord{Checkouts: map[string]string{"web": "inputs"}, Complete: true, Ran: true}
}

func warmed(t *testing.T, opts serve.Options) (*fakeEngine, *pool, string) {
	t.Helper()
	engine, pool := harnessed(), newPool()
	opts.Capacity = 3
	serving(t, opts, engine, pool)

	pool.work <- warmSandbox("sandbox_w", "npm ci")
	eventually(t, "the warm sandbox", func() bool { return len(engine.workSandboxes()) == 1 })
	return engine, pool, engine.workSandboxes()[0]
}

func TestAWarmSandboxTakesNoRunUntilItsSetupImageIsCommitted(t *testing.T) {
	engine, pool, id := warmed(t, options(t))

	time.Sleep(100 * time.Millisecond)
	if claims := pool.sandboxClaims(); len(claims) > 0 {
		t.Fatal("the warm sandbox claimed a run before its setup finished")
	}

	opened(t, engine, id, setUp())
	eventually(t, "a setup image", func() bool { return len(engine.committedImages()) == 1 })
	eventually(t, "the sandbox claims runs", func() bool { return len(pool.sandboxClaims()) > 0 })

	made := engine.committedImages()[0]
	if first := pool.sandboxClaims()[0]; first.Before(made.at) {
		t.Error("the sandbox claimed a run before the commit")
	}
	base := engine.sandbox(id).Image
	key := made.commit.Labels[serve.LabelSetupKey]
	if made.sandbox != id || made.commit.ConfigFrom != base || made.commit.Repository != serve.SetupRepository ||
		len(key) != 64 || made.commit.Tag != key[:16] || made.commit.Labels[serve.LabelBaseDigest] == "" {
		t.Errorf("committed %+v from a sandbox of %s", made, base)
	}
	if _, ok := engine.putIn(id, protocol.SandboxWorkspaceOpen); !ok {
		t.Error("the workspace-open marker was not put back after the commit")
	}
}

func TestASandboxWithTheSameSetupStartsFromTheSetupImage(t *testing.T) {
	engine, pool, id := warmed(t, options(t))
	base := engine.sandbox(id).Image
	opened(t, engine, id, setUp())
	eventually(t, "a setup image", func() bool { return len(engine.committedImages()) == 1 })
	image := engine.committedImages()[0].image

	pool.work <- runWithSetup("runner_1", "  npm ci\n")
	eventually(t, "the run's sandbox", func() bool { return len(engine.workSandboxes()) == 2 })
	if got := engine.sandbox(engine.workSandboxes()[1]).Image; got != image {
		t.Errorf("a run with the same setup started from %s, not the setup image %s", got, image)
	}
	if recorded := pool.runClient.imageOf("run-runner_1"); recorded == "" || recorded == image {
		t.Errorf("the run recorded image %q, want the runner image's digest", recorded)
	}

	pool.work <- runWithSetup("runner_2", "npm install")
	eventually(t, "the other run's sandbox", func() bool { return len(engine.workSandboxes()) == 3 })
	if got := engine.sandbox(engine.workSandboxes()[2]).Image; got != base {
		t.Errorf("a run with another setup started from %s, not the runner image %s", got, base)
	}
}

func TestAWarmSandboxFromAnUpToDateSetupImageCommitsNothing(t *testing.T) {
	engine, pool, id := warmed(t, options(t))
	opened(t, engine, id, setUp())
	eventually(t, "a setup image", func() bool { return len(engine.committedImages()) == 1 })

	pool.work <- warmSandbox("sandbox_x", "npm ci")
	eventually(t, "the second warm sandbox", func() bool { return len(engine.workSandboxes()) == 2 })
	second := engine.workSandboxes()[1]
	if got := engine.sandbox(second).Image; got != engine.committedImages()[0].image {
		t.Fatalf("the second warm sandbox started from %s", got)
	}

	opened(t, engine, second, protocol.SetupRecord{Checkouts: map[string]string{"web": "inputs"}, Complete: true})
	eventually(t, "the second sandbox claims runs", func() bool { return slices.Contains(pool.claimedFor(), "sandbox_x") })
	if made := engine.committedImages(); len(made) != 1 {
		t.Errorf("committed %d setup images, want 1", len(made))
	}
}

func TestNoSetupImageIsMadeWhenTheSandboxIsNotFitForOne(t *testing.T) {
	for name, each := range map[string]struct {
		record  protocol.SetupRecord
		changes []sandbox.Change
		floor   int64
	}{
		"a setup failed":           {record: protocol.SetupRecord{Checkouts: map[string]string{}, Ran: true}},
		"a change outside setup":   {record: setUp(), changes: []sandbox.Change{{Path: "/workspace/web", Kind: sandbox.Added}, {Path: "/etc/passwd", Kind: sandbox.Modified}}},
		"a file left in /tmp":      {record: setUp(), changes: []sandbox.Change{{Path: "/tmp", Kind: sandbox.Modified}, {Path: "/tmp/token", Kind: sandbox.Added}}},
		"the disk under the floor": {record: setUp(), floor: 1 << 50},
	} {
		t.Run(name, func(t *testing.T) {
			opts := options(t)
			opts.SetupImageFloor = each.floor
			engine, pool, id := warmed(t, opts)
			if each.changes != nil {
				engine.set(func(e *fakeEngine) { e.changes[id] = each.changes })
			}

			opened(t, engine, id, each.record)
			eventually(t, "the sandbox claims runs", func() bool { return len(pool.sandboxClaims()) > 0 })
			if made := engine.committedImages(); len(made) > 0 {
				t.Errorf("committed %+v", made)
			}
			if _, ok := engine.putIn(id, protocol.SandboxWorkspaceOpen); !ok {
				t.Error("the workspace-open marker is gone")
			}
		})
	}
}

func TestASandboxThatNeverOpensItsWorkspaceIsStillStoppedOnDrain(t *testing.T) {
	engine, pool, id := warmed(t, options(t))
	pool.drainSandboxes("sandbox_w")
	eventually(t, "the warm sandbox stopped", func() bool { return engine.wasDestroyed(id) })
	if made := engine.committedImages(); len(made) > 0 {
		t.Errorf("committed %+v", made)
	}
}

func TestASetupImageDoesNotTrustTheWarmSandboxsAuthorities(t *testing.T) {
	engine, pool, id := warmed(t, options(t))
	authority := []byte("-----BEGIN CERTIFICATE-----\nrun\n-----END CERTIFICATE-----\n")
	system := []byte("-----BEGIN CERTIFICATE-----\nbase\n-----END CERTIFICATE-----\n")
	trusting := append(append([]byte{}, system...), authority...)
	engine.Put(context.Background(), id, sandbox.File{Path: serve.AuthorityPath, Body: authority})
	engine.Put(context.Background(), id, sandbox.File{Path: "/etc/ssl/certs/ca-certificates.crt", Body: trusting})

	opened(t, engine, id, setUp())
	eventually(t, "a setup image", func() bool { return len(engine.committedImages()) == 1 })
	eventually(t, "the sandbox claims runs", func() bool { return len(pool.sandboxClaims()) > 0 })

	made := engine.committedImages()[0]
	if got := string(made.files["/etc/ssl/certs/ca-certificates.crt"]); got != string(system) {
		t.Errorf("the image trusts %q", got)
	}
	if _, ok := made.files[serve.AuthorityPath]; ok {
		t.Error("the image holds the run's authority")
	}
	if got, _ := engine.putIn(id, "/etc/ssl/certs/ca-certificates.crt"); string(got.Body) != string(trusting) {
		t.Errorf("the sandbox no longer trusts its authority: %q", got.Body)
	}
	if got, _ := engine.putIn(id, serve.AuthorityPath); string(got.Body) != string(authority) {
		t.Error("the sandbox lost its authority file")
	}
}

func TestARunnerImageWithAVolumeOnTheWorkspaceGetsNoSetupImage(t *testing.T) {
	engine, pool := harnessed(), newPool()
	base := imageAt("runner", strings.Repeat("a", 64))
	base.Volumes = []string{"/workspace"}
	engine.pullTo["runner:1"] = base
	opts := options(t)
	opts.Capacity = 3
	serving(t, opts, engine, pool)
	pool.work <- warmSandbox("sandbox_w", "npm ci")
	eventually(t, "the warm sandbox", func() bool { return len(engine.workSandboxes()) == 1 })

	opened(t, engine, engine.workSandboxes()[0], setUp())
	eventually(t, "the sandbox claims runs", func() bool { return len(pool.sandboxClaims()) > 0 })
	if made := engine.committedImages(); len(made) > 0 {
		t.Errorf("committed %+v", made)
	}
}

func TestASandboxWhoseSetupImageWillNotStartStartsFromTheRunnerImage(t *testing.T) {
	engine, pool, id := warmed(t, options(t))
	base := engine.sandbox(id).Image
	opened(t, engine, id, setUp())
	eventually(t, "a setup image", func() bool { return len(engine.committedImages()) == 1 })
	engine.set(func(e *fakeEngine) { e.failImage = e.commits[0].image })

	pool.work <- runWithSetup("runner_1", "npm ci")
	eventually(t, "the run's sandbox", func() bool { return len(engine.workSandboxes()) == 2 })
	if got := engine.sandbox(engine.workSandboxes()[1]).Image; got != base {
		t.Errorf("started from %s, want the runner image %s", got, base)
	}
}
