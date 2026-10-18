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
	opts.Version = "20261001-01"
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
	pool.release = "20261018-01"
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
	if err := stopped(); !errors.Is(err, serve.ErrUpdated) {
		t.Fatalf("stopped with %v", err)
	}
	if got := binary.releases(); got[0] != "20261018-01" {
		t.Errorf("updated to %v", got)
	}
}

func TestUpdatesBeforeItClaimsWhenItStartsOnAnotherRelease(t *testing.T) {
	engine, pool, binary := harnessed(), newPool(), &updates{}
	pool.release = "20261018-01"
	_, stopped := serving(t, updating(t, binary, true), engine, pool)

	if err := stopped(); !errors.Is(err, serve.ErrUpdated) {
		t.Fatalf("stopped with %v", err)
	}
	if got := len(engine.workSandboxes()); got != 0 {
		t.Errorf("ran %d sandboxes on the old release", got)
	}
}

func TestDoesNotUpdateWhenItIsOnTheControlPlanesRelease(t *testing.T) {
	engine, pool, binary := harnessed(), newPool(), &updates{}
	pool.release = "20261001-01"
	serving(t, updating(t, binary, true), engine, pool)

	pool.work <- assignment("runner_1")
	eventually(t, "a sandbox", func() bool { return len(engine.workSandboxes()) == 1 })
	if got := binary.releases(); len(got) != 0 {
		t.Errorf("updated to %v", got)
	}
}

func TestWithAutoUpdateOffItOnlyRestartsWhenItsBinaryIsReplaced(t *testing.T) {
	engine, pool, binary := harnessed(), newPool(), &updates{}
	pool.release = "20261018-01"
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

	if err := stopped(); !errors.Is(err, serve.ErrUpdated) {
		t.Fatalf("stopped with %v", err)
	}
}

func TestAFailedUpdateKeepsServingAndWaitsBeforeItTriesAgain(t *testing.T) {
	engine, pool, binary := harnessed(), newPool(), &updates{fails: errors.New("404 Not Found")}
	pool.release = "20261018-01"
	serving(t, updating(t, binary, true), engine, pool)

	pool.work <- assignment("runner_1")
	eventually(t, "a sandbox", func() bool { return len(engine.workSandboxes()) == 1 })
	time.Sleep(200 * time.Millisecond)

	if got := binary.releases(); len(got) != 1 {
		t.Errorf("tried %d times within the retry wait", len(got))
	}
}
