package serve_test

import (
	"context"
	"errors"
	"slices"
	"sync"
	"testing"
	"time"

	"usespotlight.ai/data-plane/host/internal/serve"
	"usespotlight.ai/data-plane/protocol"
)

type updates struct {
	mu       sync.Mutex
	replaced bool
	fails    error
	asked    []string
}

func (u *updates) Replaced() bool {
	u.mu.Lock()
	defer u.mu.Unlock()
	return u.replaced
}

func (u *updates) To(_ context.Context, release string) error {
	u.mu.Lock()
	defer u.mu.Unlock()
	u.asked = append(u.asked, release)
	if u.fails != nil {
		return u.fails
	}
	u.replaced = true
	return nil
}

func (u *updates) releases() []string {
	u.mu.Lock()
	defer u.mu.Unlock()
	return append([]string(nil), u.asked...)
}

func updating(t *testing.T, binary *updates, auto bool) serve.Options {
	opts := options(t)
	opts.Version = "v0.4.0"
	opts.Updates = binary
	opts.AutoUpdate = auto
	return opts
}

func TestUpdatesToTheControlPlanesReleaseAndRestartsAtOnceLeavingItsSandboxesRunning(t *testing.T) {
	engine, pool, binary := harnessed(), newPool(), &updates{}
	opts := updating(t, binary, true)
	opts.HeartbeatEvery = 10 * time.Millisecond
	_, stopped := serving(t, opts, engine, pool)

	pool.work <- assignment("runner_1")
	eventually(t, "a sandbox", func() bool { return len(engine.workSandboxes()) == 1 })
	id := engine.workSandboxes()[0]
	egress, _, _ := engine.egressOf("runner_1")

	pool.mu.Lock()
	pool.release = "v0.7.0"
	pool.mu.Unlock()

	if err := stopped(); !errors.Is(err, serve.ErrRestart) {
		t.Fatalf("stopped with %v", err)
	}
	if got := binary.releases(); len(got) != 1 || got[0] != "v0.7.0" {
		t.Errorf("updated to %v", got)
	}

	engine.mu.Lock()
	defer engine.mu.Unlock()
	if slices.Contains(engine.stopped, id) || slices.Contains(engine.destroyed, id) || slices.Contains(engine.destroyed, egress) {
		t.Errorf("the update stopped %v and destroyed %v", engine.stopped, engine.destroyed)
	}
	if slices.Contains(engine.unnetworked, "spotlight-runner_1") {
		t.Error("the update removed the running sandbox's network")
	}
	if pool.deregistered {
		t.Error("the update deregistered the host, so its sandboxes would count as lost")
	}
	for _, beat := range pool.heartbeatsSent() {
		if beat.Stopping {
			t.Fatal("the update told the control plane that the host stops, so it would drain its idle sandboxes")
		}
	}
	if running := pool.lastHeartbeat().Running; !slices.Equal(running, []string{"runner_1"}) {
		t.Errorf("the last heartbeat before the restart reported %v", running)
	}
}

func restarted(t *testing.T, opts serve.Options, engine *fakeEngine, pool *pool) (context.CancelFunc, func() error) {
	t.Helper()

	opts.Version = "v0.7.0"
	opts.Updates = &updates{}
	return serving(t, opts, engine, pool)
}

func updatedWhileRunning(t *testing.T, opts serve.Options, engine *fakeEngine, pool *pool, work protocol.Assignment) string {
	t.Helper()

	binary := &updates{}
	opts.Updates = binary
	_, stopped := serving(t, opts, engine, pool)

	pool.work <- work
	eventually(t, "a sandbox", func() bool { return len(engine.workSandboxes()) == 1 })

	binary.mu.Lock()
	binary.replaced = true
	binary.mu.Unlock()
	if err := stopped(); !errors.Is(err, serve.ErrRestart) {
		t.Fatalf("stopped with %v", err)
	}

	return engine.workSandboxes()[0]
}

func TestTheRestartedHostTakesOverARunningSandboxAndServesQueuedRunsBesideIt(t *testing.T) {
	engine, pool := harnessed(), newPool()
	opts := updating(t, &updates{}, false)
	opts.Capacity = 2
	id := updatedWhileRunning(t, opts, engine, pool, assignment("runner_1"))
	egress, _, _ := engine.egressOf("runner_1")
	beats := len(pool.heartbeatsSent())

	restarted(t, opts, engine, pool)
	eventually(t, "a heartbeat from the restarted host", func() bool { return len(pool.heartbeatsSent()) > beats })
	if first := pool.heartbeatsSent()[beats]; !slices.Equal(first.Running, []string{"runner_1"}) {
		t.Errorf("the restarted host first reported %v running", first.Running)
	}

	pool.work <- assignment("runner_2")
	pool.work <- assignment("runner_3")
	eventually(t, "a queued run served beside the running one", func() bool { return len(engine.workSandboxes()) == 2 })
	time.Sleep(100 * time.Millisecond)
	if got := len(engine.workSandboxes()); got != 2 {
		t.Fatalf("ran %d sandboxes with capacity 2", got)
	}
	if engine.wasDestroyed(id) {
		t.Fatal("the restarted host destroyed the sandbox it took over")
	}
	engine.mu.Lock()
	since := engine.followed[id]
	engine.mu.Unlock()
	if len(since) != 2 || !since[0].IsZero() || since[1].IsZero() {
		t.Errorf("followed the sandbox's output from %v, so the restarted host logs it again", since)
	}

	engine.finish(id)
	eventually(t, "the finished sandbox destroyed with its egress", func() bool {
		return engine.wasDestroyed(id) && engine.wasDestroyed(egress)
	})
	eventually(t, "the next queued run in the freed slot", func() bool { return len(engine.workSandboxes()) == 3 })
	eventually(t, "the finished sandbox's network removed", func() bool {
		engine.mu.Lock()
		defer engine.mu.Unlock()
		return slices.Contains(engine.unnetworked, "spotlight-runner_1")
	})
}

func TestTheRestartedHostDeliversTheNextRunIntoASandboxItTookOver(t *testing.T) {
	engine, pool := harnessed(), newPool()
	opts := updating(t, &updates{}, false)
	opts.LeaseEvery = 5 * time.Millisecond
	id := updatedWhileRunning(t, opts, engine, pool, inSandbox("runner_1", "sandbox_a"))
	_, first, _ := engine.egressOf("runner_1")
	before := egressTokenOf(t, first)
	beats := len(pool.heartbeatsSent())

	restarted(t, opts, engine, pool)
	eventually(t, "a heartbeat from the restarted host", func() bool { return len(pool.heartbeatsSent()) > beats })
	if first := pool.heartbeatsSent()[beats]; len(first.Sandboxes) != 1 || first.Sandboxes[0].ID != "sandbox_a" {
		t.Fatalf("the restarted host first reported %v, so the control plane would count the sandbox as lost", first.Sandboxes)
	}

	pool.into <- reused("runner_2", "sandbox_a")
	eventually(t, "the next run delivered into the sandbox", func() bool {
		return slices.Contains(engine.signalled(id), "SIGUSR1")
	})
	eventually(t, "the egress re-keyed for the next run", func() bool {
		live := engine.liveEgressesOfSandbox("sandbox_a")
		return len(live) == 1 && egressTokenOf(t, live[0]).Token == "egress-runner_2"
	})
	after := egressTokenOf(t, engine.liveEgressesOfSandbox("sandbox_a")[0])
	if after.Credential != before.Credential {
		t.Error("the re-keyed egress takes another proxy credential than the sandbox has")
	}
	if image := pool.runClient.imageOf("run-runner_2"); image != engine.sandbox(id).Labels[serve.LabelDigest] || image == "" {
		t.Errorf("the next run recorded image %q", image)
	}
	if len(engine.workSandboxes()) != 1 {
		t.Errorf("started %d containers for two runs of one sandbox", len(engine.workSandboxes()))
	}
	eventually(t, "the next run's runner reported", func() bool {
		return slices.Equal(pool.lastHeartbeat().Running, []string{"runner_2"})
	})
}

func TestTheRestartedHostReKeysASandboxItTookOverWithItsCredentialHostsAndHarnessKeys(t *testing.T) {
	engine, pool := harnessed(), newPool()
	opts := updating(t, &updates{}, false)
	opts.LeaseEvery = 5 * time.Millisecond
	id := updatedWhileRunning(t, opts, engine, pool, sandboxOnly("sandbox_a"))
	before := egressTokenOf(t, engine.liveEgressesOfSandbox("sandbox_a")[0])

	restarted(t, opts, engine, pool)
	pool.into <- reused("runner_2", "sandbox_a")
	eventually(t, "the egress re-keyed for the run", func() bool {
		live := engine.liveEgressesOfSandbox("sandbox_a")
		return len(live) == 1 && egressTokenOf(t, live[0]).Token == "egress-runner_2"
	})

	after := egressTokenOf(t, engine.liveEgressesOfSandbox("sandbox_a")[0])
	if after.Credential != before.Credential {
		t.Error("the re-keyed egress takes another proxy credential than the sandbox has")
	}
	if !slices.Equal(after.SandboxHosts, []string{"archives.example.com"}) {
		t.Errorf("the re-keyed egress lets the sandbox reach %v", after.SandboxHosts)
	}
	if !slices.Equal(after.HarnessKeys, before.HarnessKeys) || len(after.HarnessKeys) != 1 {
		t.Errorf("the re-keyed egress wears the harness keys %+v, not %+v", after.HarnessKeys, before.HarnessKeys)
	}
	if engine.wasDestroyed(id) {
		t.Fatal("the restarted host destroyed the sandbox it took over")
	}
}

func TestStopsASandboxItTookOverWhenTheControlPlaneDrainsIt(t *testing.T) {
	engine, pool := harnessed(), newPool()
	opts := updating(t, &updates{}, false)
	id := updatedWhileRunning(t, opts, engine, pool, inSandbox("runner_1", "sandbox_a"))
	egress, _, _ := engine.egressOf("runner_1")

	pool.drainSandboxes("sandbox_a")
	restarted(t, opts, engine, pool)

	eventually(t, "the drained sandbox destroyed with its egress", func() bool {
		return engine.wasDestroyed(id) && engine.wasDestroyed(egress)
	})
	engine.mu.Lock()
	defer engine.mu.Unlock()
	if !slices.Contains(engine.stopped, id) {
		t.Error("destroyed the drained sandbox without stopping it first")
	}
}

func TestStopsASandboxItTookOverOnceItRunsPastItsTime(t *testing.T) {
	engine, pool := harnessed(), newPool()
	opts := updating(t, &updates{}, false)
	id := updatedWhileRunning(t, opts, engine, pool, assignment("runner_1"))

	engine.set(func(e *fakeEngine) { e.created[id] = time.Now().Add(-opts.RunTimeout) })
	restarted(t, opts, engine, pool)

	eventually(t, "the sandbox destroyed at its time", func() bool { return engine.wasDestroyed(id) })
	engine.mu.Lock()
	defer engine.mu.Unlock()
	if !slices.Contains(engine.stopped, id) {
		t.Error("destroyed the sandbox without stopping it first")
	}
}

func TestDestroysASandboxLeftBehindThatFinishedOrLostItsEgress(t *testing.T) {
	engine, pool := harnessed(), newPool()
	opts := updating(t, &updates{}, false)
	opts.Capacity = 2
	binary := &updates{}
	opts.Updates = binary
	_, stopped := serving(t, opts, engine, pool)

	pool.work <- assignment("runner_1")
	pool.work <- assignment("runner_2")
	eventually(t, "two sandboxes", func() bool { return len(engine.workSandboxes()) == 2 })
	binary.mu.Lock()
	binary.replaced = true
	binary.mu.Unlock()
	if err := stopped(); !errors.Is(err, serve.ErrRestart) {
		t.Fatalf("stopped with %v", err)
	}

	finished, egressless := engine.workSandboxes()[0], engine.workSandboxes()[1]
	engine.finish(finished)
	lost, _, _ := engine.egressOf(engine.sandbox(egressless).Labels[serve.LabelRunner])
	engine.set(func(e *fakeEngine) { e.destroyed = append(e.destroyed, lost) })

	restarted(t, opts, engine, pool)
	eventually(t, "both destroyed", func() bool {
		return engine.wasDestroyed(finished) && engine.wasDestroyed(egressless)
	})
	eventually(t, "nothing reported running", func() bool {
		beat := pool.lastHeartbeat()
		return beat.Release == "v0.7.0" && len(beat.Running) == 0
	})
}

func TestAnUpdateLetsTheRunItDeliversTakeItsAssignmentBeforeItRestarts(t *testing.T) {
	engine, pool, binary := harnessed(), newPool(), &updates{}
	engine.keepsFile = true
	opts := updating(t, binary, false)
	opts.LeaseEvery = 5 * time.Millisecond
	_, stopped := serving(t, opts, engine, pool)

	pool.work <- inSandbox("runner_1", "sandbox_a")
	eventually(t, "a sandbox", func() bool { return len(engine.workSandboxes()) == 1 })
	id := engine.workSandboxes()[0]
	pool.into <- reused("runner_2", "sandbox_a")
	eventually(t, "the next run delivered", func() bool { return slices.Contains(engine.signalled(id), "SIGUSR1") })

	binary.mu.Lock()
	binary.replaced = true
	binary.mu.Unlock()
	done := make(chan error, 1)
	go func() { done <- stopped() }()
	select {
	case err := <-done:
		t.Fatalf("restarted with %v before the runner took its assignment", err)
	case <-time.After(200 * time.Millisecond):
	}

	engine.set(func(e *fakeEngine) { e.keepsFile = false })
	if err := <-done; !errors.Is(err, serve.ErrRestart) {
		t.Fatalf("stopped with %v", err)
	}
	if done, ok := pool.runClient.completion("run-runner_2"); ok {
		t.Errorf("the update failed the run it delivered: %+v", done)
	}
	if engine.wasDestroyed(id) {
		t.Error("the update destroyed the sandbox")
	}
}

func TestUpdatesBeforeItClaimsWhenItStartsOnAnotherRelease(t *testing.T) {
	engine, pool, binary := harnessed(), newPool(), &updates{}
	pool.release = "v0.7.0"
	_, stopped := serving(t, updating(t, binary, true), engine, pool)

	if err := stopped(); !errors.Is(err, serve.ErrRestart) {
		t.Fatalf("stopped with %v", err)
	}
	if got := len(engine.workSandboxes()); got != 0 {
		t.Errorf("ran %d sandboxes on the old release", got)
	}
}

func TestDoesNotUpdateWhenItIsOnTheControlPlanesRelease(t *testing.T) {
	engine, pool, binary := harnessed(), newPool(), &updates{}
	pool.release = "v0.4.0"
	serving(t, updating(t, binary, true), engine, pool)

	pool.work <- assignment("runner_1")
	eventually(t, "a sandbox", func() bool { return len(engine.workSandboxes()) == 1 })
	if got := binary.releases(); len(got) != 0 {
		t.Errorf("updated to %v", got)
	}
}

func TestWithAutoUpdateOffItOnlyRestartsWhenItsBinaryIsReplaced(t *testing.T) {
	engine, pool, binary := harnessed(), newPool(), &updates{}
	pool.release = "v0.7.0"
	_, stopped := serving(t, updating(t, binary, false), engine, pool)

	pool.work <- assignment("runner_1")
	eventually(t, "a sandbox", func() bool { return len(engine.workSandboxes()) == 1 })
	engine.finish(engine.workSandboxes()[0])
	if got := binary.releases(); len(got) != 0 {
		t.Fatalf("updated to %v with auto update off", got)
	}

	binary.mu.Lock()
	binary.replaced = true
	binary.mu.Unlock()

	if err := stopped(); !errors.Is(err, serve.ErrRestart) {
		t.Fatalf("stopped with %v", err)
	}
}

func TestAFailedUpdateKeepsServingAndWaitsBeforeItTriesAgain(t *testing.T) {
	engine, pool, binary := harnessed(), newPool(), &updates{fails: errors.New("404 Not Found")}
	pool.release = "v0.7.0"
	serving(t, updating(t, binary, true), engine, pool)

	pool.work <- assignment("runner_1")
	eventually(t, "a sandbox", func() bool { return len(engine.workSandboxes()) == 1 })
	time.Sleep(200 * time.Millisecond)

	if got := binary.releases(); len(got) != 1 {
		t.Errorf("tried %d times within the retry wait", len(got))
	}
}
