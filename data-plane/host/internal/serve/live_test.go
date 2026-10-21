package serve_test

import (
	"context"
	"errors"
	"testing"
	"time"

	"usespotlight.ai/data-plane/host/internal/serve"
)

func live(t *testing.T, opts serve.Options, engine *fakeEngine, pool *pool) (*serve.Host, func() error) {
	t.Helper()

	ctx, cancel := context.WithCancel(context.Background())
	host := serve.New(opts, pool, engine, nil, quiet)
	done := make(chan error, 1)
	go func() { done <- host.Serve(ctx) }()

	var served error
	finished := false
	stopped := func() error {
		if finished {
			return served
		}
		select {
		case served = <-done:
			finished = true
		case <-time.After(5 * time.Second):
			t.Error("the host did not stop")
		}
		return served
	}
	t.Cleanup(func() {
		cancel()
		stopped()
	})

	return host, stopped
}

func settingsOf(opts serve.Options) serve.Settings {
	return serve.Settings{
		Name: opts.Name, Images: opts.Images, Capacity: opts.Capacity, RunTimeout: opts.RunTimeout,
		AnswerWait: opts.AnswerWait, SandboxURL: opts.SandboxURL, SandboxEnv: opts.SandboxEnv, Egress: opts.Egress,
		Network: opts.Network, ExtraHosts: opts.ExtraHosts, AutoUpdate: opts.AutoUpdate,
	}
}

func TestAReloadedCapacityTakesMoreWorkWithoutARestart(t *testing.T) {
	engine, pool := harnessed(), newPool()
	opts := options(t)
	host, _ := live(t, opts, engine, pool)

	pool.work <- assignment("runner_1")
	pool.work <- assignment("runner_2")
	eventually(t, "one sandbox", func() bool { return len(engine.workSandboxes()) == 1 })

	reloaded := settingsOf(opts)
	reloaded.Capacity = 2
	host.Reload(reloaded)

	eventually(t, "the second sandbox", func() bool { return len(engine.workSandboxes()) == 2 })
	if engine.wasDestroyed(engine.workSandboxes()[0]) {
		t.Error("the reload stopped a running sandbox")
	}
}

func TestALowerCapacityLetsTheRunningSandboxesFinish(t *testing.T) {
	engine, pool := harnessed(), newPool()
	opts := options(t)
	opts.Capacity = 2
	host, _ := live(t, opts, engine, pool)

	pool.work <- assignment("runner_1")
	pool.work <- assignment("runner_2")
	eventually(t, "two sandboxes", func() bool { return len(engine.workSandboxes()) == 2 })

	reloaded := settingsOf(opts)
	reloaded.Capacity = 1
	host.Reload(reloaded)

	pool.work <- assignment("runner_3")
	first := engine.workSandboxes()[0]
	engine.finish(first)
	time.Sleep(200 * time.Millisecond)
	if got := len(engine.workSandboxes()); got != 2 {
		t.Fatalf("started %d sandboxes, though one still runs at a capacity of one", got)
	}
	if engine.wasDestroyed(engine.workSandboxes()[1]) {
		t.Error("the reload stopped a running sandbox")
	}

	engine.finish(engine.workSandboxes()[1])
	eventually(t, "the third sandbox", func() bool { return len(engine.workSandboxes()) == 3 })
}

func TestARestartWaitsForTheRunningSandboxes(t *testing.T) {
	engine, pool := harnessed(), newPool()
	host, stopped := live(t, options(t), engine, pool)

	pool.work <- assignment("runner_1")
	eventually(t, "a sandbox", func() bool { return len(engine.workSandboxes()) == 1 })
	id := engine.workSandboxes()[0]

	host.Restart()
	pool.work <- assignment("runner_2")
	time.Sleep(200 * time.Millisecond)
	if engine.wasDestroyed(id) {
		t.Fatal("the restart stopped a running sandbox")
	}

	engine.finish(id)
	if err := stopped(); !errors.Is(err, serve.ErrRestart) {
		t.Fatalf("stopped with %v", err)
	}
	if got := len(engine.workSandboxes()); got != 1 {
		t.Errorf("claimed more work while it restarted: %d sandboxes", got)
	}
}
