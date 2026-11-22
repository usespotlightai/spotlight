package serve_test

import (
	"encoding/json"
	"errors"
	"slices"
	"strings"
	"testing"
	"time"

	"usespotlight.ai/data-plane/host/internal/sandbox"
	"usespotlight.ai/data-plane/host/internal/serve"
	"usespotlight.ai/data-plane/protocol"
)

func withServices(each protocol.Assignment, services ...protocol.Service) protocol.Assignment {
	run := *each.Work.Run
	run.Spec.Services = services
	each.Work.Run = &run
	return each
}

var (
	postgres = protocol.Service{
		Name: "db", Image: "postgres:17", From: "app/compose.yml",
		Env:    []protocol.EnvVariable{{Name: "POSTGRES_PASSWORD", Value: "local"}},
		Health: &protocol.ServiceHealth{Test: []string{"CMD-SHELL", "pg_isready"}, IntervalMs: 1000, Retries: 3},
	}
	worker = protocol.Service{Name: "worker", Image: "worker:1", From: "app/compose.yml", DependsOn: []string{"db"}}
)

func servicesStartedIn(t *testing.T, engine *fakeEngine, id string) (protocol.ServicesStarted, bool) {
	t.Helper()

	file, ok := engine.putIn(id, protocol.ServicesPath)
	if !ok {
		return protocol.ServicesStarted{}, false
	}
	var started protocol.ServicesStarted
	if err := json.Unmarshal(file.Body, &started); err != nil {
		t.Fatalf("the services file %s: %v", file.Body, err)
	}
	return started, true
}

func TestStartsARunsServicesOnItsSandboxNetworkAndTellsTheSandboxOnceTheyAreReady(t *testing.T) {
	engine, pool := harnessed(), newPool()
	serving(t, options(t), engine, pool)

	pool.work <- withServices(inSandbox("runner_1", "sandbox_a"), postgres, worker)
	eventually(t, "a sandbox", func() bool { return len(engine.workSandboxes()) == 1 })
	id := engine.workSandboxes()[0]
	eventually(t, "the services' outcome in the sandbox", func() bool {
		_, ok := servicesStartedIn(t, engine, id)
		return ok
	})

	started, _ := servicesStartedIn(t, engine, id)
	if started.Run != "run-runner_1" || len(started.Services) != 2 ||
		!started.Services[0].Ready || !started.Services[1].Ready || started.Services[0].From != "app/compose.yml" {
		t.Errorf("the sandbox was told %+v", started)
	}

	if !slices.Contains(engine.sandbox(id).Env, protocol.ServicesVar+"=1") {
		t.Error("the sandbox is not told that its host starts services, so its runner would not wait for them")
	}
	sandboxNetwork := engine.sandbox(id).Network
	services := engine.liveServices()
	db := services["db"]
	if db.Network != sandboxNetwork || db.Image != "postgres:17" || !slices.Contains(db.Env, "POSTGRES_PASSWORD=local") {
		t.Errorf("db started as %+v on %s", db, sandboxNetwork)
	}
	if db.Health == nil || !slices.Equal(db.Health.Test, []string{"CMD-SHELL", "pg_isready"}) {
		t.Errorf("db has no health check of its own: %+v", db.Health)
	}
	if want := engine.sandbox(id).Limits; db.Limits != want || db.Limits.OOMScoreAdj == 0 {
		t.Errorf("db runs with limits %+v, want the sandbox's %+v", db.Limits, want)
	}
	if db.Labels[serve.LabelService] == "" || db.Labels[serve.LabelHost] == "" {
		t.Errorf("db is not labelled as a service of this host: %v", db.Labels)
	}
	if starts := engine.serviceStartOrder(); !slices.Equal(starts, []string{"db", "worker"}) {
		t.Errorf("started %v, want db before the worker that depends on it", starts)
	}
}

func TestAServiceThatFailsIsReportedAndTheOnesThatDependOnItDoNotStart(t *testing.T) {
	engine, pool := harnessed(), newPool()
	engine.serviceStates["db"] = sandbox.State{Running: false, ExitCode: 1}
	serving(t, options(t), engine, pool)

	pool.work <- withServices(inSandbox("runner_1", "sandbox_a"), postgres, worker)
	eventually(t, "a sandbox", func() bool { return len(engine.workSandboxes()) == 1 })
	id := engine.workSandboxes()[0]
	eventually(t, "the services' outcome in the sandbox", func() bool {
		_, ok := servicesStartedIn(t, engine, id)
		return ok
	})

	started, _ := servicesStartedIn(t, engine, id)
	db, dependent := started.Services[0], started.Services[1]
	if db.Ready || !strings.Contains(db.Problem, "exited with code 1") {
		t.Errorf("db: %+v", db)
	}
	if dependent.Ready || !strings.Contains(dependent.Problem, "db, which it depends on, did not start") {
		t.Errorf("worker: %+v", dependent)
	}
	if slices.Contains(engine.serviceStartOrder(), "worker") {
		t.Error("the worker started though db did not")
	}
}

func TestEachRunInASandboxGetsFreshServicesAndTheyGoWithTheSandbox(t *testing.T) {
	engine, pool := harnessed(), newPool()
	serving(t, options(t), engine, pool)

	pool.work <- withServices(inSandbox("runner_1", "sandbox_a"), postgres)
	eventually(t, "a sandbox", func() bool { return len(engine.workSandboxes()) == 1 })
	id := engine.workSandboxes()[0]
	eventually(t, "the first run's db", func() bool { return len(engine.liveServices()) == 1 })
	first := engine.serviceIDs()

	pool.into <- withServices(reused("runner_2", "sandbox_a"), postgres)
	eventually(t, "the second run's services in the sandbox", func() bool {
		started, ok := servicesStartedIn(t, engine, id)
		return ok && started.Run == "run-runner_2"
	})
	if !engine.wasDestroyed(first[0]) {
		t.Error("the first run's db is still there for the second run")
	}
	if live := engine.liveServices(); len(live) != 1 {
		t.Errorf("services %v, want one db", live)
	}

	pool.into <- reused("runner_3", "sandbox_a")
	eventually(t, "no services for a run that names none", func() bool { return len(engine.liveServices()) == 0 })

	pool.into <- withServices(reused("runner_4", "sandbox_a"), postgres)
	eventually(t, "the fourth run's db", func() bool { return len(engine.liveServices()) == 1 })
	engine.finish(id)
	eventually(t, "the services destroyed with the sandbox", func() bool {
		return engine.wasDestroyed(id) && len(engine.liveServices()) == 0
	})
}

func TestTheRestartedHostKeepsTheServicesOfASandboxItTookOver(t *testing.T) {
	engine, pool := harnessed(), newPool()
	opts := updating(t, &updates{}, false)
	binary := &updates{}
	opts.Updates = binary
	_, stopped := serving(t, opts, engine, pool)

	pool.work <- withServices(inSandbox("runner_1", "sandbox_a"), postgres)
	eventually(t, "a sandbox", func() bool { return len(engine.workSandboxes()) == 1 })
	id := engine.workSandboxes()[0]
	eventually(t, "its db ready", func() bool {
		_, ok := servicesStartedIn(t, engine, id)
		return ok
	})
	db := engine.serviceIDs()

	binary.mu.Lock()
	binary.replaced = true
	binary.mu.Unlock()
	if err := stopped(); !errors.Is(err, serve.ErrRestart) {
		t.Fatalf("stopped with %v", err)
	}
	restarted(t, opts, engine, pool)
	eventually(t, "the sandbox taken over", func() bool {
		beats := pool.heartbeatsSent()
		return len(beats) > 0 && len(beats[len(beats)-1].Sandboxes) == 1
	})
	time.Sleep(50 * time.Millisecond)

	if engine.wasDestroyed(db[0]) {
		t.Fatal("the restarted host destroyed the db of the run it took over")
	}
	engine.finish(id)
	eventually(t, "the db destroyed with the sandbox", func() bool { return engine.wasDestroyed(db[0]) })
}

// turnOf is the next turn of run-runner_1, which a new runner takes up in the same sandbox.
func turnOf(runner string) protocol.Assignment {
	next := withServices(reused(runner, "sandbox_a"), postgres)
	next.Work.Run.ID = "run-runner_1"
	return next
}

func TestTheNextTurnOfARunKeepsItsServicesWithWhatItLeftInThem(t *testing.T) {
	engine, pool := harnessed(), newPool()
	serving(t, options(t), engine, pool)

	pool.work <- withServices(inSandbox("runner_1", "sandbox_a"), postgres)
	eventually(t, "a sandbox", func() bool { return len(engine.workSandboxes()) == 1 })
	id := engine.workSandboxes()[0]
	eventually(t, "its db ready", func() bool {
		_, ok := servicesStartedIn(t, engine, id)
		return ok
	})
	db := engine.serviceIDs()

	pool.into <- turnOf("runner_2")
	eventually(t, "the next turn delivered", func() bool {
		return slices.Equal(pool.lastHeartbeat().Running, []string{"runner_2"})
	})
	time.Sleep(50 * time.Millisecond)

	if engine.wasDestroyed(db[0]) || !slices.Equal(engine.serviceIDs(), db) {
		t.Errorf("services %v after the next turn, want the run's db %v kept", engine.serviceIDs(), db)
	}
	if started, ok := servicesStartedIn(t, engine, id); !ok || started.Run != "run-runner_1" {
		t.Errorf("the sandbox no longer says how the run's services started: %+v", started)
	}

	pool.into <- withServices(reused("runner_3", "sandbox_a"), postgres)
	eventually(t, "another run's own db", func() bool {
		return engine.wasDestroyed(db[0]) && len(engine.liveServices()) == 1
	})
}

func TestTheNextTurnOfARunKeepsItsServicesAfterTheHostRestarted(t *testing.T) {
	engine, pool := harnessed(), newPool()
	opts := updating(t, &updates{}, false)
	binary := &updates{}
	opts.Updates = binary
	_, stopped := serving(t, opts, engine, pool)

	pool.work <- withServices(inSandbox("runner_1", "sandbox_a"), postgres)
	eventually(t, "a sandbox", func() bool { return len(engine.workSandboxes()) == 1 })
	id := engine.workSandboxes()[0]
	eventually(t, "its db ready", func() bool {
		_, ok := servicesStartedIn(t, engine, id)
		return ok
	})
	db := engine.serviceIDs()

	binary.mu.Lock()
	binary.replaced = true
	binary.mu.Unlock()
	if err := stopped(); !errors.Is(err, serve.ErrRestart) {
		t.Fatalf("stopped with %v", err)
	}
	restarted(t, opts, engine, pool)
	pool.into <- turnOf("runner_2")
	eventually(t, "the next turn delivered", func() bool {
		return slices.Contains(engine.signalled(id), "SIGUSR1")
	})
	time.Sleep(50 * time.Millisecond)

	if engine.wasDestroyed(db[0]) {
		t.Error("the restarted host replaced the run's db for its next turn")
	}
}

func TestAServiceWithNoHealthCheckThatExitsSoonAfterItStartsIsNotReady(t *testing.T) {
	engine, pool := harnessed(), newPool()
	running := sandbox.State{Running: true, Health: sandbox.HealthNone}
	engine.serviceSequences["cache"] = []sandbox.State{running, running, {Running: false, ExitCode: 1}}
	engine.serviceStates["steady"] = running
	serving(t, options(t), engine, pool)

	pool.work <- withServices(inSandbox("runner_1", "sandbox_a"),
		protocol.Service{Name: "cache", Image: "redis:7", From: "compose.yml"},
		protocol.Service{Name: "steady", Image: "redis:7", From: "compose.yml"},
	)
	eventually(t, "a sandbox", func() bool { return len(engine.workSandboxes()) == 1 })
	id := engine.workSandboxes()[0]
	eventually(t, "the services' outcome in the sandbox", func() bool {
		_, ok := servicesStartedIn(t, engine, id)
		return ok
	})

	started, _ := servicesStartedIn(t, engine, id)
	if cache := started.Services[0]; cache.Ready || !strings.Contains(cache.Problem, "exited with code 1") {
		t.Errorf("cache: %+v, want it not ready", cache)
	}
	if steady := started.Services[1]; !steady.Ready {
		t.Errorf("steady: %+v, want it ready once it kept running", steady)
	}
}
