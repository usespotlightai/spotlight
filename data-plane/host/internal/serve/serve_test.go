package serve_test

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"slices"
	"strings"
	"sync"
	"testing"
	"time"

	"usespotlight.ai/data-plane/host/internal/executor"
	"usespotlight.ai/data-plane/host/internal/serve"
	"usespotlight.ai/data-plane/internal/control"
	"usespotlight.ai/data-plane/internal/protocol"
)

var quiet = slog.New(slog.NewTextHandler(io.Discard, nil))

type engine struct {
	mu        sync.Mutex
	next      int
	started   map[string]executor.Sandbox
	exits     map[string]chan int
	destroyed []string
	stopped   []string
	left      []string
	found     []protocol.HarnessReport
	failStart bool
	failProbe bool
	waitFails int
	ensured   int
	starts    int
}

func newEngine() *engine {
	return &engine{started: map[string]executor.Sandbox{}, exits: map[string]chan int{}}
}

func (e *engine) Describe(context.Context) (string, error) { return "fake engine", nil }
func (e *engine) Ensure(context.Context, string) error {
	e.mu.Lock()
	defer e.mu.Unlock()
	e.ensured++
	return nil
}

func (e *engine) Start(_ context.Context, sandbox executor.Sandbox) (string, error) {
	e.mu.Lock()
	defer e.mu.Unlock()

	if e.failProbe && len(sandbox.Args) > 0 {
		return "", errors.New("the image will not run")
	}
	if len(sandbox.Args) == 0 {
		e.starts++
		if e.failStart {
			return "", errors.New("no such image")
		}
	}

	e.next++
	id := fmt.Sprintf("sandbox_%d", e.next)
	e.started[id] = sandbox
	e.exits[id] = make(chan int, 1)
	if len(sandbox.Args) > 0 && sandbox.Args[0] == "harnesses" {
		e.exits[id] <- 0
	}

	return id, nil
}

func (e *engine) Follow(_ context.Context, id string, out io.Writer) error {
	e.mu.Lock()
	sandbox := e.started[id]
	e.mu.Unlock()

	if len(sandbox.Args) > 0 && sandbox.Args[0] == "harnesses" {
		return json.NewEncoder(out).Encode(protocol.Registration{Harnesses: e.found})
	}

	return nil
}

func (e *engine) Wait(ctx context.Context, id string) (int, error) {
	e.mu.Lock()
	exit := e.exits[id]
	if e.waitFails > 0 && len(e.started[id].Args) == 0 {
		e.waitFails--
		e.mu.Unlock()
		return -1, errors.New("the engine hung up")
	}
	e.mu.Unlock()

	select {
	case code := <-exit:
		exit <- code
		return code, nil
	case <-ctx.Done():
		return -1, ctx.Err()
	}
}

func (e *engine) Stop(_ context.Context, id string, _ time.Duration) error {
	e.mu.Lock()
	defer e.mu.Unlock()

	e.stopped = append(e.stopped, id)
	select {
	case e.exits[id] <- 143:
	default:
	}

	return nil
}

func (e *engine) Destroy(_ context.Context, id string) error {
	e.mu.Lock()
	defer e.mu.Unlock()

	e.destroyed = append(e.destroyed, id)
	return nil
}

func (e *engine) Labelled(context.Context, string, string) ([]string, error) {
	return e.left, nil
}

func (e *engine) finish(id string) {
	e.mu.Lock()
	defer e.mu.Unlock()
	e.exits[id] <- 0
}

func (e *engine) workSandboxes() []string {
	e.mu.Lock()
	defer e.mu.Unlock()

	var ids []string
	for id, sandbox := range e.started {
		if len(sandbox.Args) == 0 {
			ids = append(ids, id)
		}
	}
	slices.Sort(ids)
	return ids
}

func (e *engine) sandbox(id string) executor.Sandbox {
	e.mu.Lock()
	defer e.mu.Unlock()
	return e.started[id]
}

func (e *engine) wasDestroyed(id string) bool {
	e.mu.Lock()
	defer e.mu.Unlock()
	return slices.Contains(e.destroyed, id)
}

type pool struct {
	instant  bool
	claims   int
	taken    bool
	work     chan protocol.Handed
	refuse   chan struct{}
	offered  chan []protocol.HarnessReport
	mu       sync.Mutex
	presence []protocol.HostPresence
	left     bool
}

func newPool() *pool {
	return &pool{
		work:    make(chan protocol.Handed, 8),
		refuse:  make(chan struct{}),
		offered: make(chan []protocol.HarnessReport, 64),
	}
}

func (p *pool) Harnesses(context.Context) ([]protocol.Installable, error) {
	return []protocol.Installable{{ID: "claude-code", Executable: "claude"}}, nil
}

func (p *pool) Claim(ctx context.Context, offer []protocol.HarnessReport) (*protocol.Handed, error) {
	p.mu.Lock()
	p.claims++
	instant := p.instant
	p.mu.Unlock()

	select {
	case p.offered <- offer:
	default:
	}

	if instant {
		select {
		case handed := <-p.work:
			return &handed, nil
		default:
			return nil, nil
		}
	}

	select {
	case handed := <-p.work:
		return &handed, nil
	case <-p.refuse:
		return nil, fmt.Errorf("claim: %w", control.ErrRefused)
	case <-time.After(20 * time.Millisecond):
		return nil, nil
	case <-ctx.Done():
		return nil, ctx.Err()
	}
}

func (p *pool) Present(_ context.Context, presence protocol.HostPresence) (protocol.HostStanding, error) {
	p.mu.Lock()
	defer p.mu.Unlock()
	if p.taken {
		return protocol.HostStanding{}, fmt.Errorf("report presence: %w",
			&control.Rejection{Status: 409, Reason: "host-taken", Err: errors.New("taken")})
	}
	p.presence = append(p.presence, presence)
	return protocol.HostStanding{Workspace: "workspace_1"}, nil
}

func (p *pool) Leave(context.Context) error {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.left = true
	return nil
}

func handed(runner string) protocol.Handed {
	return protocol.Handed{
		RunnerID: runner,
		Token:    "one-run-" + runner,
		Work:     protocol.Claimed{Kind: protocol.ClaimedRun, Run: &protocol.Run{ID: "run-" + runner}},
	}
}

func options() serve.Options {
	return serve.Options{
		HostID:     "host_1",
		Name:       "build-box",
		Images:     []string{"runner:1"},
		Capacity:   1,
		RunTimeout: time.Minute,
		ControlURL: "https://spotlight.test",
		SandboxURL: "https://spotlight.test",
		SandboxEnv: []string{"ANTHROPIC_API_KEY=sk-test"},
	}
}

func serving(t *testing.T, opts serve.Options, engine *engine, pool *pool) (context.CancelFunc, func() error) {
	return servingWithin(t, context.Background(), opts, engine, pool)
}

func servingWithin(t *testing.T, parent context.Context, opts serve.Options, engine *engine, pool *pool) (context.CancelFunc, func() error) {
	t.Helper()

	ctx, cancel := context.WithCancel(parent)
	done := make(chan struct{})
	var served error
	go func() {
		served = serve.New(opts, pool, engine, nil, quiet).Serve(ctx)
		close(done)
	}()

	stopped := func() error {
		select {
		case <-done:
			return served
		case <-time.After(5 * time.Second):
			t.Error("the host did not stop")
			return nil
		}
	}

	t.Cleanup(func() {
		cancel()
		stopped()
	})

	return cancel, stopped
}

func eventually(t *testing.T, what string, holds func() bool) {
	t.Helper()

	deadline := time.Now().Add(3 * time.Second)
	for !holds() {
		if time.Now().After(deadline) {
			t.Fatalf("never saw: %s", what)
		}
		time.Sleep(5 * time.Millisecond)
	}
}

func TestEveryPieceOfWorkGetsAFreshSandboxThatIsDestroyedAfterwards(t *testing.T) {
	engine, pool := newEngine(), newPool()
	opts := options()
	opts.Capacity = 2
	serving(t, opts, engine, pool)

	pool.work <- handed("runner_1")
	pool.work <- handed("runner_2")
	eventually(t, "two sandboxes", func() bool { return len(engine.workSandboxes()) == 2 })

	ids := engine.workSandboxes()
	for _, id := range ids {
		sandbox := engine.sandbox(id)

		if len(sandbox.Files) != 1 || sandbox.Files[0].Path != serve.HandedPath || sandbox.Files[0].Mode != 0o400 {
			t.Fatalf("%s was handed %+v", id, sandbox.Files)
		}
		var given protocol.Handed
		if err := json.Unmarshal(sandbox.Files[0].Body, &given); err != nil || !strings.HasPrefix(given.Token, "one-run-") {
			t.Errorf("%s was handed %+v (%v)", id, given, err)
		}
		if !slices.Contains(sandbox.Env, "ANTHROPIC_API_KEY=sk-test") {
			t.Errorf("%s lacks the sandbox environment: %v", id, sandbox.Env)
		}
		if sandbox.Labels[serve.LabelHost] != "host_1" {
			t.Errorf("%s is not labelled with its host: %v", id, sandbox.Labels)
		}
	}
	if engine.sandbox(ids[0]).Labels[serve.LabelRunner] == engine.sandbox(ids[1]).Labels[serve.LabelRunner] {
		t.Error("two runs shared a runner")
	}

	for _, id := range ids {
		engine.finish(id)
	}
	eventually(t, "both destroyed", func() bool {
		return engine.wasDestroyed(ids[0]) && engine.wasDestroyed(ids[1])
	})
}

func TestTakesNoMoreWorkThanItsCapacity(t *testing.T) {
	engine, pool := newEngine(), newPool()
	serving(t, options(), engine, pool)

	pool.work <- handed("runner_1")
	pool.work <- handed("runner_2")
	eventually(t, "one sandbox", func() bool { return len(engine.workSandboxes()) == 1 })

	time.Sleep(100 * time.Millisecond)
	if got := len(engine.workSandboxes()); got != 1 {
		t.Fatalf("started %d sandboxes with room for one", got)
	}

	engine.finish(engine.workSandboxes()[0])
	eventually(t, "the second sandbox", func() bool { return len(engine.workSandboxes()) == 2 })
}

func TestDestroysWhatACrashedHostLeftBehindBeforeTakingWork(t *testing.T) {
	engine, pool := newEngine(), newPool()
	engine.left = []string{"orphan_1"}
	serving(t, options(), engine, pool)

	eventually(t, "the orphan destroyed", func() bool { return engine.wasDestroyed("orphan_1") })
}

func TestStoppingTheHostStopsAndDestroysItsSandboxes(t *testing.T) {
	engine, pool := newEngine(), newPool()
	cancel, stopped := serving(t, options(), engine, pool)

	pool.work <- handed("runner_1")
	eventually(t, "a sandbox", func() bool { return len(engine.workSandboxes()) == 1 })
	id := engine.workSandboxes()[0]

	cancel()
	if err := stopped(); err != nil {
		t.Fatalf("serve: %v", err)
	}

	if !slices.Contains(engine.stopped, id) || !engine.wasDestroyed(id) {
		t.Errorf("stopped %v, destroyed %v", engine.stopped, engine.destroyed)
	}
	if !pool.left {
		t.Error("never said it was leaving")
	}
}

func TestASandboxThatRunsPastItsTimeIsStoppedAndDestroyed(t *testing.T) {
	engine, pool := newEngine(), newPool()
	opts := options()
	opts.RunTimeout = 50 * time.Millisecond
	serving(t, opts, engine, pool)

	pool.work <- handed("runner_1")
	eventually(t, "a sandbox", func() bool { return len(engine.workSandboxes()) == 1 })
	id := engine.workSandboxes()[0]

	eventually(t, "destroyed after its time", func() bool { return engine.wasDestroyed(id) })
	if !slices.Contains(engine.stopped, id) {
		t.Errorf("destroyed without being stopped: %v", engine.stopped)
	}
}

func TestOffersEachImageWhatWasFoundInIt(t *testing.T) {
	engine, pool := newEngine(), newPool()
	engine.found = []protocol.HarnessReport{{ID: "claude-code", Version: "2.1.0"}}
	serving(t, options(), engine, pool)

	offer := <-pool.offered
	if len(offer) != 1 || offer[0].ID != "claude-code" || offer[0].Version != "2.1.0" {
		t.Fatalf("offered %+v", offer)
	}
}

func TestAHostWhoseCredentialIsRefusedStops(t *testing.T) {
	engine, pool := newEngine(), newPool()
	_, stopped := serving(t, options(), engine, pool)

	close(pool.refuse)

	if err := stopped(); !errors.Is(err, control.ErrRefused) {
		t.Fatalf("stopped with %v", err)
	}
}

func TestReportsWhatItIsRunning(t *testing.T) {
	engine, pool := newEngine(), newPool()
	serving(t, options(), engine, pool)

	var first protocol.HostPresence
	eventually(t, "a report", func() bool {
		pool.mu.Lock()
		defer pool.mu.Unlock()
		if len(pool.presence) > 0 {
			first = pool.presence[0]
		}
		return len(pool.presence) > 0
	})

	if first.Name != "build-box" || first.Capacity != 1 || first.Executor != "fake engine" {
		t.Errorf("reported %+v", first)
	}

	engine.found = nil
}

func TestReportsTheHarnessesItsImagesOffer(t *testing.T) {
	engine, pool := newEngine(), newPool()
	engine.found = []protocol.HarnessReport{{ID: "claude-code", Models: []string{"opus"}, Version: "2.1.0"}}
	opts := options()
	opts.Images = []string{"runner:1", "runner:2"}
	serving(t, opts, engine, pool)

	eventually(t, "a report with harnesses", func() bool {
		pool.mu.Lock()
		defer pool.mu.Unlock()
		for _, each := range pool.presence {
			if len(each.Harnesses) == 1 && each.Harnesses[0].Models[0] == "opus" {
				return true
			}
		}
		return false
	})
}

func TestAHostStoppedBySignalStopsCleanly(t *testing.T) {
	engine, pool := newEngine(), newPool()
	signalled, signal := context.WithCancelCause(context.Background())
	_, stopped := servingWithin(t, signalled, options(), engine, pool)

	eventually(t, "a report", func() bool {
		pool.mu.Lock()
		defer pool.mu.Unlock()
		return len(pool.presence) > 0
	})
	signal(errors.New("terminated signal received"))

	if err := stopped(); err != nil {
		t.Fatalf("a signal stopped it with %v", err)
	}
}

func TestPausesAnImageWhoseSandboxesWillNotStart(t *testing.T) {
	engine, pool := newEngine(), newPool()
	engine.failStart = true
	serving(t, options(), engine, pool)

	for runner := range 4 {
		pool.work <- handed(fmt.Sprintf("runner_%d", runner))
	}

	eventually(t, "a failed start", func() bool {
		engine.mu.Lock()
		defer engine.mu.Unlock()
		return engine.starts > 0
	})
	time.Sleep(500 * time.Millisecond)

	engine.mu.Lock()
	defer engine.mu.Unlock()
	if engine.starts != 1 {
		t.Errorf("tried %d sandboxes while its image would not start", engine.starts)
	}
	if engine.ensured < 2 {
		t.Errorf("never looked for the image again after the failed start")
	}
}

func TestDoesNotSpinOnAQueueThatAnswersAtOnce(t *testing.T) {
	engine, pool := newEngine(), newPool()
	pool.instant = true
	serving(t, options(), engine, pool)

	time.Sleep(time.Second)

	pool.mu.Lock()
	defer pool.mu.Unlock()
	if pool.claims > 5 {
		t.Errorf("claimed %d times in a second from a queue that answered at once", pool.claims)
	}
}

func TestAHostWhoseIDServesAnotherWayInStops(t *testing.T) {
	engine, pool := newEngine(), newPool()
	engine.left = []string{"someone_elses"}
	pool.taken = true
	_, stopped := serving(t, options(), engine, pool)

	if err := stopped(); !control.Rejected(err, "host-taken") {
		t.Fatalf("stopped with %v", err)
	}
	if engine.wasDestroyed("someone_elses") {
		t.Error("reaped sandboxes before the control plane owned it as this host")
	}
}

func TestKeepsWaitingOnASandboxItLostSightOf(t *testing.T) {
	engine, pool := newEngine(), newPool()
	engine.waitFails = 1
	serving(t, options(), engine, pool)

	pool.work <- handed("runner_1")
	eventually(t, "a sandbox", func() bool { return len(engine.workSandboxes()) == 1 })
	id := engine.workSandboxes()[0]

	time.Sleep(3 * time.Second)
	if engine.wasDestroyed(id) {
		t.Fatal("destroyed a sandbox the engine only hung up on")
	}

	engine.finish(id)
	eventually(t, "destroyed once it finished", func() bool { return engine.wasDestroyed(id) })
}

func TestARefusedCredentialStopsClaimingButLetsRunningSandboxesFinish(t *testing.T) {
	engine, pool := newEngine(), newPool()
	opts := options()
	opts.Capacity = 2
	_, stopped := serving(t, opts, engine, pool)

	pool.work <- handed("runner_1")
	eventually(t, "a sandbox", func() bool { return len(engine.workSandboxes()) == 1 })
	id := engine.workSandboxes()[0]

	close(pool.refuse)
	time.Sleep(300 * time.Millisecond)

	engine.mu.Lock()
	stoppedEarly := slices.Contains(engine.stopped, id)
	engine.mu.Unlock()
	if stoppedEarly || engine.wasDestroyed(id) {
		t.Fatal("a refused credential stopped a sandbox running on its own")
	}

	engine.finish(id)
	if err := stopped(); !errors.Is(err, control.ErrRefused) {
		t.Fatalf("stopped with %v", err)
	}
	if !engine.wasDestroyed(id) {
		t.Error("the finished sandbox was not destroyed")
	}
}

func TestATransientConflictDoesNotStopTheHost(t *testing.T) {
	err := fmt.Errorf("claim: %w", &control.Rejection{Status: 409, Err: errors.New("the runner moved on")})
	if control.Rejected(err, "host-taken") || errors.Is(err, control.ErrRefused) {
		t.Fatal("a plain conflict read as final")
	}
}

func TestAHostWhoseImageCannotBeProbedStopsWithoutHanging(t *testing.T) {
	engine, pool := newEngine(), newPool()
	engine.failProbe = true
	_, stopped := serving(t, options(), engine, pool)

	if err := stopped(); err == nil || !strings.Contains(err.Error(), "look for harnesses") {
		t.Fatalf("stopped with %v", err)
	}
}
