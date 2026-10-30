package serve_test

import (
	"context"
	"errors"
	"sync"
	"testing"
	"time"

	"usespotlight.ai/data-plane/host/internal/serve"
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

func TestUpdatesToTheControlPlanesReleaseAndRestartsWhenItsSandboxesFinish(t *testing.T) {
	engine, pool, binary := harnessed(), newPool(), &updates{}
	_, stopped := serving(t, updating(t, binary, true), engine, pool)

	pool.work <- assignment("runner_1")
	eventually(t, "a sandbox", func() bool { return len(engine.workSandboxes()) == 1 })
	id := engine.workSandboxes()[0]

	pool.mu.Lock()
	pool.release = "v0.7.0"
	pool.mu.Unlock()
	eventually(t, "an update", func() bool { return len(binary.releases()) == 1 })

	pool.work <- assignment("runner_2")
	time.Sleep(200 * time.Millisecond)
	if engine.wasDestroyed(id) {
		t.Fatal("the update stopped a running sandbox")
	}
	if got := len(engine.workSandboxes()); got != 1 {
		t.Fatalf("claimed more work after it updated: %d sandboxes", got)
	}

	engine.finish(id)
	if err := stopped(); !errors.Is(err, serve.ErrRestart) {
		t.Fatalf("stopped with %v", err)
	}
	if got := binary.releases(); got[0] != "v0.7.0" {
		t.Errorf("updated to %v", got)
	}
}

func TestAnUpdatingHostKeepsReportingItsSandboxesUntilTheControlPlaneDrainsThem(t *testing.T) {
	engine, pool, binary := harnessed(), newPool(), &updates{}
	opts := updating(t, binary, true)
	opts.HeartbeatEvery = 10 * time.Millisecond
	_, stopped := serving(t, opts, engine, pool)

	pool.work <- inSandbox("runner_1", "sandbox_a")
	eventually(t, "a sandbox", func() bool { return len(engine.workSandboxes()) == 1 })
	id := engine.workSandboxes()[0]

	pool.mu.Lock()
	pool.release = "v0.7.0"
	pool.mu.Unlock()
	eventually(t, "a heartbeat that says the host stops", func() bool {
		last := pool.lastHeartbeat()
		return last.Stopping && len(last.Sandboxes) == 1 && last.Sandboxes[0].ID == "sandbox_a"
	})

	pool.into <- reused("runner_2", "sandbox_a")
	time.Sleep(100 * time.Millisecond)
	if _, ok := engine.putIn(id, serve.AssignmentPath); ok {
		t.Error("a stopping host delivered the next run into its sandbox")
	}
	beats := len(pool.heartbeatsSent())
	time.Sleep(50 * time.Millisecond)
	if len(pool.heartbeatsSent()) == beats {
		t.Fatal("the host stopped its heartbeats while a sandbox lives")
	}

	pool.drainSandboxes("sandbox_a")
	if err := stopped(); !errors.Is(err, serve.ErrRestart) {
		t.Fatalf("stopped with %v", err)
	}
	if !engine.wasDestroyed(id) {
		t.Error("restarted before the drained sandbox was destroyed")
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
