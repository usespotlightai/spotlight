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

	"usespotlight.ai/data-plane/control"
	"usespotlight.ai/data-plane/host/internal/images"
	"usespotlight.ai/data-plane/host/internal/sandbox"
	"usespotlight.ai/data-plane/host/internal/serve"
	"usespotlight.ai/data-plane/protocol"
)

var quiet = slog.New(slog.NewTextHandler(io.Discard, nil))

const leastRelease = "20260925-01"

type fakeEngine struct {
	mu        sync.Mutex
	next      int
	started   map[string]sandbox.Spec
	exits     map[string]chan int
	destroyed []string
	stopped   []string
	left      []string
	found     []protocol.HarnessReport
	release   string
	images    map[string]sandbox.Image
	pullTo    map[string]sandbox.Image
	pulls     []string
	auths     []string
	failStart bool
	failProbe bool
	failPull  bool
	pullTakes time.Duration
	waitFails int
	starts    int
	probes    int
}

func newEngine() *fakeEngine {
	return &fakeEngine{
		started: map[string]sandbox.Spec{},
		exits:   map[string]chan int{},
		release: leastRelease,
		images:  map[string]sandbox.Image{},
		pullTo:  map[string]sandbox.Image{},
	}
}

func imageAt(name, hex string) sandbox.Image {
	return sandbox.Image{ID: "sha256:" + hex, Digests: []string{name + "@sha256:" + hex}}
}

func (e *fakeEngine) Describe(context.Context) (string, error) { return "fake engine", nil }

func (e *fakeEngine) Inspect(_ context.Context, image string) (sandbox.Image, error) {
	e.mu.Lock()
	defer e.mu.Unlock()

	found, ok := e.images[image]
	if !ok {
		return sandbox.Image{}, sandbox.ErrNoImage
	}
	return found, nil
}

func (e *fakeEngine) Pull(_ context.Context, image, auth string) error {
	e.mu.Lock()
	takes := e.pullTakes
	e.mu.Unlock()
	time.Sleep(takes)

	e.mu.Lock()
	defer e.mu.Unlock()

	e.pulls = append(e.pulls, image)
	e.auths = append(e.auths, auth)
	if e.failPull {
		return errors.New("the registry is down")
	}

	pulled, ok := e.pullTo[image]
	if !ok {
		name, _, _ := strings.Cut(image, ":")
		pulled = imageAt(name, strings.Repeat("a", 64))
	}
	e.images[image] = pulled
	return nil
}

func (e *fakeEngine) Start(_ context.Context, spec sandbox.Spec) (string, error) {
	e.mu.Lock()
	defer e.mu.Unlock()

	if len(spec.Args) > 0 {
		e.probes++
		if e.failProbe {
			return "", errors.New("the image will not run")
		}
	}
	if len(spec.Args) == 0 {
		e.starts++
		if e.failStart {
			return "", errors.New("no such image")
		}
	}

	e.next++
	id := fmt.Sprintf("sandbox_%d", e.next)
	e.started[id] = spec
	e.exits[id] = make(chan int, 1)
	if len(spec.Args) > 0 && spec.Args[0] == "harnesses" {
		e.exits[id] <- 0
	}

	return id, nil
}

func (e *fakeEngine) Follow(_ context.Context, id string, out io.Writer) error {
	e.mu.Lock()
	spec := e.started[id]
	reported := protocol.Registration{Release: e.release, Harnesses: e.found}
	e.mu.Unlock()

	if len(spec.Args) > 0 && spec.Args[0] == "harnesses" {
		return json.NewEncoder(out).Encode(reported)
	}

	return nil
}

func (e *fakeEngine) Wait(ctx context.Context, id string) (int, error) {
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

func (e *fakeEngine) Stop(_ context.Context, id string, _ time.Duration) error {
	e.mu.Lock()
	defer e.mu.Unlock()

	e.stopped = append(e.stopped, id)
	select {
	case e.exits[id] <- 143:
	default:
	}

	return nil
}

func (e *fakeEngine) Destroy(_ context.Context, id string) error {
	e.mu.Lock()
	defer e.mu.Unlock()

	e.destroyed = append(e.destroyed, id)
	return nil
}

func (e *fakeEngine) Labelled(context.Context, string, string) ([]string, error) {
	return e.left, nil
}

func (e *fakeEngine) set(apply func(e *fakeEngine)) {
	e.mu.Lock()
	defer e.mu.Unlock()
	apply(e)
}

func (e *fakeEngine) finish(id string) {
	e.mu.Lock()
	defer e.mu.Unlock()
	e.exits[id] <- 0
}

func (e *fakeEngine) workSandboxes() []string {
	e.mu.Lock()
	defer e.mu.Unlock()

	var ids []string
	for id, spec := range e.started {
		if len(spec.Args) == 0 {
			ids = append(ids, id)
		}
	}
	slices.Sort(ids)
	return ids
}

func (e *fakeEngine) sandbox(id string) sandbox.Spec {
	e.mu.Lock()
	defer e.mu.Unlock()
	return e.started[id]
}

func (e *fakeEngine) wasDestroyed(id string) bool {
	e.mu.Lock()
	defer e.mu.Unlock()
	return slices.Contains(e.destroyed, id)
}

func (e *fakeEngine) pulled() []string {
	e.mu.Lock()
	defer e.mu.Unlock()
	return slices.Clone(e.pulls)
}

type worker struct {
	mu        sync.Mutex
	renewed   []string
	images    map[string]string
	completed map[string]protocol.Completion
	checked   map[string]protocol.StackChecked
}

func (w *worker) RenewLease(_ context.Context, runID string) (bool, error) {
	w.mu.Lock()
	defer w.mu.Unlock()
	w.renewed = append(w.renewed, runID)
	return false, nil
}

func (w *worker) RecordImage(_ context.Context, runID, image string) error {
	w.mu.Lock()
	defer w.mu.Unlock()
	w.images[runID] = image
	return nil
}

func (w *worker) Complete(_ context.Context, runID string, done protocol.Completion) error {
	w.mu.Lock()
	defer w.mu.Unlock()
	w.completed[runID] = done
	return nil
}

func (w *worker) RecordChangeStackCheck(_ context.Context, _, stackID string, checked protocol.StackChecked) error {
	w.mu.Lock()
	defer w.mu.Unlock()
	w.checked[stackID] = checked
	return nil
}

func (w *worker) imageOf(runID string) string {
	w.mu.Lock()
	defer w.mu.Unlock()
	return w.images[runID]
}

func (w *worker) completion(runID string) (protocol.Completion, bool) {
	w.mu.Lock()
	defer w.mu.Unlock()
	done, ok := w.completed[runID]
	return done, ok
}

func (w *worker) check(stackID string) (protocol.StackChecked, bool) {
	w.mu.Lock()
	defer w.mu.Unlock()
	checked, ok := w.checked[stackID]
	return checked, ok
}

type pool struct {
	instant  bool
	claims   int
	taken    bool
	work     chan protocol.Handed
	refuse   chan struct{}
	offered  chan protocol.HostClaim
	named    []string
	atLeast  string
	unoffer  bool
	worker   *worker
	mu       sync.Mutex
	presence []protocol.HostPresence
	left     bool
}

func newPool() *pool {
	return &pool{
		work:    make(chan protocol.Handed, 8),
		refuse:  make(chan struct{}),
		offered: make(chan protocol.HostClaim, 256),
		worker: &worker{
			images:    map[string]string{},
			completed: map[string]protocol.Completion{},
			checked:   map[string]protocol.StackChecked{},
		},
	}
}

func (p *pool) Requirements(context.Context) (protocol.HostRequirements, error) {
	p.mu.Lock()
	defer p.mu.Unlock()

	return protocol.HostRequirements{
		Runner:    protocol.RunnerRequirement{AtLeast: p.atLeastOr()},
		Harnesses: []protocol.Installable{{ID: "claude-code", Executable: "claude"}},
		Images:    slices.Clone(p.named),
	}, nil
}

func (p *pool) atLeastOr() string {
	if p.atLeast != "" {
		return p.atLeast
	}
	return leastRelease
}

func (p *pool) need(release string) {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.atLeast = release
}

func (p *pool) name(images ...string) {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.named = images
}

func (p *pool) Claim(ctx context.Context, offer protocol.HostClaim) (*protocol.Handed, error) {
	p.mu.Lock()
	p.claims++
	instant := p.instant
	unoffer := p.unoffer
	p.mu.Unlock()

	if unoffer {
		return nil, fmt.Errorf("claim: %w",
			&control.Rejection{Status: 409, Reason: "image-unreported", Err: errors.New("unreported")})
	}

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

func (p *pool) Seat(protocol.Handed) (serve.Worker, error) {
	return p.worker, nil
}

func (p *pool) lastPresence() protocol.HostPresence {
	p.mu.Lock()
	defer p.mu.Unlock()
	if len(p.presence) == 0 {
		return protocol.HostPresence{}
	}
	return p.presence[len(p.presence)-1]
}

func (p *pool) reported(image string) (protocol.HostImage, bool) {
	for _, each := range p.lastPresence().Images {
		if each.Image == image {
			return each, true
		}
	}
	return protocol.HostImage{}, false
}

type registry struct{}

func (registry) For(image string) (string, error) { return "auth-for-" + image, nil }

func handed(runner string) protocol.Handed {
	return protocol.Handed{
		RunnerID: runner,
		Token:    "one-run-" + runner,
		Work: protocol.Claimed{Kind: protocol.ClaimedRun, Run: &protocol.Run{
			ID: "run-" + runner, Harness: "claude-code",
		}},
	}
}

func allowed(t *testing.T, entries ...string) images.Allowed {
	t.Helper()

	parsed, err := images.Parse(entries, "runner:default")
	if err != nil {
		t.Fatal(err)
	}
	return parsed
}

func options(t *testing.T) serve.Options {
	return serve.Options{
		HostID:       "host_1",
		Name:         "build-box",
		Images:       allowed(t, "runner:1"),
		Registry:     registry{},
		RefreshEvery: 50 * time.Millisecond,
		Capacity:     1,
		RunTimeout:   time.Minute,
		ControlURL:   "https://spotlight.test",
		SandboxURL:   "https://spotlight.test",
		SandboxEnv:   []string{"ANTHROPIC_API_KEY=sk-test"},
	}
}

func harnessed() *fakeEngine {
	engine := newEngine()
	engine.found = []protocol.HarnessReport{{ID: "claude-code", Version: "2.1.0"}}
	return engine
}

func serving(t *testing.T, opts serve.Options, engine *fakeEngine, pool *pool) (context.CancelFunc, func() error) {
	return servingWithin(t, context.Background(), opts, engine, pool)
}

func servingWithin(t *testing.T, parent context.Context, opts serve.Options, engine *fakeEngine, pool *pool) (context.CancelFunc, func() error) {
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
	engine, pool := harnessed(), newPool()
	opts := options(t)
	opts.Capacity = 2
	serving(t, opts, engine, pool)

	pool.work <- handed("runner_1")
	pool.work <- handed("runner_2")
	eventually(t, "two sandboxes", func() bool { return len(engine.workSandboxes()) == 2 })

	ids := engine.workSandboxes()
	for _, id := range ids {
		spec := engine.sandbox(id)

		if len(spec.Files) != 1 || spec.Files[0].Path != serve.HandedPath || spec.Files[0].Mode != 0o400 {
			t.Fatalf("%s was handed %+v", id, spec.Files)
		}
		var given protocol.Handed
		if err := json.Unmarshal(spec.Files[0].Body, &given); err != nil || !strings.HasPrefix(given.Token, "one-run-") {
			t.Errorf("%s was handed %+v (%v)", id, given, err)
		}
		if !slices.Contains(spec.Env, "ANTHROPIC_API_KEY=sk-test") {
			t.Errorf("%s lacks the sandbox environment: %v", id, spec.Env)
		}
		if spec.Labels[serve.LabelHost] != "host_1" {
			t.Errorf("%s is not labelled with its host: %v", id, spec.Labels)
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
	engine, pool := harnessed(), newPool()
	serving(t, options(t), engine, pool)

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
	engine, pool := harnessed(), newPool()
	engine.left = []string{"orphan_1"}
	serving(t, options(t), engine, pool)

	eventually(t, "the orphan destroyed", func() bool { return engine.wasDestroyed("orphan_1") })
}

func TestStoppingTheHostStopsAndDestroysItsSandboxes(t *testing.T) {
	engine, pool := harnessed(), newPool()
	cancel, stopped := serving(t, options(t), engine, pool)

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
	engine, pool := harnessed(), newPool()
	opts := options(t)
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

func TestReportsAnImageBeforeClaimingForIt(t *testing.T) {
	engine, pool := harnessed(), newPool()
	engine.found = []protocol.HarnessReport{{ID: "claude-code", Version: "2.1.0"}}
	serving(t, options(t), engine, pool)

	offer := <-pool.offered
	if offer.Image != "runner:1" {
		t.Fatalf("offered %+v", offer)
	}

	pool.mu.Lock()
	defer pool.mu.Unlock()
	reported := false
	for _, each := range pool.presence {
		for _, image := range each.Images {
			if image.Image == "runner:1" && image.Usual && len(image.Harnesses) == 1 && image.Harnesses[0].Version == "2.1.0" {
				reported = true
			}
		}
	}
	if !reported {
		t.Error("claimed for an image it had not reported serving")
	}
}

func TestAHostWhoseCredentialIsRefusedStops(t *testing.T) {
	engine, pool := harnessed(), newPool()
	_, stopped := serving(t, options(t), engine, pool)

	close(pool.refuse)

	if err := stopped(); !errors.Is(err, control.ErrRefused) {
		t.Fatalf("stopped with %v", err)
	}
}

func TestReportsWhatItIsRunning(t *testing.T) {
	engine, pool := harnessed(), newPool()
	serving(t, options(t), engine, pool)

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
	engine, pool := harnessed(), newPool()
	engine.found = []protocol.HarnessReport{{ID: "claude-code", Models: []string{"opus"}, Version: "2.1.0"}}
	opts := options(t)
	opts.Images = allowed(t, "runner:1", "runner:2")
	pool.name("runner:2")
	serving(t, opts, engine, pool)

	eventually(t, "a report with each image's harnesses", func() bool {
		reported := pool.lastPresence().Images
		return len(reported) == 2 && reported[0].Image == "runner:1" && reported[0].Usual &&
			reported[1].Image == "runner:2" && !reported[1].Usual &&
			len(reported[1].Harnesses) == 1 && reported[1].Harnesses[0].Models[0] == "opus" &&
			reported[1].Release == leastRelease
	})
}

func TestAHostStoppedBySignalStopsCleanly(t *testing.T) {
	engine, pool := harnessed(), newPool()
	signalled, signal := context.WithCancelCause(context.Background())
	_, stopped := servingWithin(t, signalled, options(t), engine, pool)

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
	engine, pool := harnessed(), newPool()
	engine.failStart = true
	serving(t, options(t), engine, pool)

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
}

func TestDoesNotSpinOnAQueueThatAnswersAtOnce(t *testing.T) {
	engine, pool := harnessed(), newPool()
	pool.instant = true
	serving(t, options(t), engine, pool)

	time.Sleep(time.Second)

	pool.mu.Lock()
	defer pool.mu.Unlock()
	if pool.claims > 5 {
		t.Errorf("claimed %d times in a second from a queue that answered at once", pool.claims)
	}
}

func TestAHostWhoseIDServesAnotherWayInStops(t *testing.T) {
	engine, pool := harnessed(), newPool()
	engine.left = []string{"someone_elses"}
	pool.taken = true
	_, stopped := serving(t, options(t), engine, pool)

	if err := stopped(); !control.Rejected(err, "host-taken") {
		t.Fatalf("stopped with %v", err)
	}
	if engine.wasDestroyed("someone_elses") {
		t.Error("reaped sandboxes before the control plane owned it as this host")
	}
}

func TestKeepsWaitingOnASandboxItLostSightOf(t *testing.T) {
	engine, pool := harnessed(), newPool()
	engine.waitFails = 1
	serving(t, options(t), engine, pool)

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
	engine, pool := harnessed(), newPool()
	opts := options(t)
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

func TestStartsEachRunFromTheDigestItPulledForIt(t *testing.T) {
	engine, pool := harnessed(), newPool()
	serving(t, options(t), engine, pool)

	pool.work <- handed("runner_1")
	eventually(t, "a sandbox", func() bool { return len(engine.workSandboxes()) == 1 })

	digest := "runner@sha256:" + strings.Repeat("a", 64)
	if got := engine.sandbox(engine.workSandboxes()[0]).Image; got != "sha256:"+strings.Repeat("a", 64) {
		t.Errorf("started from %q, not the image it pulled", got)
	}
	if got := pool.worker.imageOf("run-runner_1"); got != digest {
		t.Errorf("recorded %q on the run", got)
	}
	if pulls := engine.pulled(); len(pulls) < 2 {
		t.Errorf("pulled %v: once to look inside, and again for the run", pulls)
	}
	engine.mu.Lock()
	defer engine.mu.Unlock()
	if !slices.Contains(engine.auths, "auth-for-runner:1") {
		t.Errorf("pulled with %v, not the host's registry credentials", engine.auths)
	}
}

func TestLooksInsideAgainWhenATagMovesAndFailsARunItsHarnessLeft(t *testing.T) {
	engine, pool := harnessed(), newPool()
	serving(t, options(t), engine, pool)

	eventually(t, "the image served", func() bool {
		each, ok := pool.reported("runner:1")
		return ok && len(each.Harnesses) == 1
	})

	engine.set(func(e *fakeEngine) {
		e.pullTo["runner:1"] = imageAt("runner", strings.Repeat("b", 64))
		e.found = []protocol.HarnessReport{{ID: "codex"}}
	})
	pool.work <- handed("runner_1")

	eventually(t, "the run failed", func() bool {
		_, ok := pool.worker.completion("run-runner_1")
		return ok
	})

	done, _ := pool.worker.completion("run-runner_1")
	if !done.Failed || !strings.Contains(done.Message, "no longer holds claude-code") {
		t.Errorf("completed %+v", done)
	}
	if got := len(engine.workSandboxes()); got != 0 {
		t.Errorf("started %d sandboxes for a run its image cannot do", got)
	}
	eventually(t, "the new harnesses reported", func() bool {
		each, _ := pool.reported("runner:1")
		return len(each.Harnesses) == 1 && each.Harnesses[0].ID == "codex" &&
			each.Digest == "runner@sha256:"+strings.Repeat("b", 64)
	})
}

func TestRunsTheCopyItHasWhenAPullFails(t *testing.T) {
	engine, pool := harnessed(), newPool()
	serving(t, options(t), engine, pool)

	eventually(t, "the image served", func() bool {
		_, ok := pool.reported("runner:1")
		return ok
	})
	engine.set(func(e *fakeEngine) { e.failPull = true })

	pool.work <- handed("runner_1")
	eventually(t, "a sandbox", func() bool { return len(engine.workSandboxes()) == 1 })
}

func TestGivesUpACheckWhenThereIsNoImageAtAll(t *testing.T) {
	engine, pool := harnessed(), newPool()
	serving(t, options(t), engine, pool)

	eventually(t, "the image served", func() bool {
		each, ok := pool.reported("runner:1")
		return ok && each.Refused == ""
	})

	engine.set(func(e *fakeEngine) {
		e.failPull = true
		delete(e.images, "runner:1")
	})

	pool.work <- protocol.Handed{
		RunnerID: "runner_1",
		Token:    "one-run",
		Work: protocol.Claimed{Kind: protocol.ClaimedCheck, Check: &protocol.StackCheck{
			StackID: "stack_1", RunID: "run_1",
		}},
	}

	eventually(t, "the check skipped", func() bool {
		_, ok := pool.worker.check("stack_1")
		return ok
	})
	checked, _ := pool.worker.check("stack_1")
	if checked.Skipped == nil || checked.Skipped.Code != protocol.SkipNoImage {
		t.Errorf("checked %+v", checked)
	}
	eventually(t, "the image refused until it can be pulled", func() bool {
		each, _ := pool.reported("runner:1")
		return strings.Contains(each.Refused, "could not pull")
	})
}

func TestDoesNotPullADigestItAlreadyHas(t *testing.T) {
	engine, pool := harnessed(), newPool()
	pinned := "runner@sha256:" + strings.Repeat("c", 64)
	engine.images[pinned] = imageAt("runner", strings.Repeat("c", 64))
	opts := options(t)
	opts.Images = allowed(t, pinned)
	serving(t, opts, engine, pool)

	pool.work <- handed("runner_1")
	eventually(t, "a sandbox", func() bool { return len(engine.workSandboxes()) == 1 })

	if pulls := engine.pulled(); len(pulls) != 0 {
		t.Errorf("pulled %v though it held the digest", pulls)
	}
}

func TestServesTheImagesLinesNameThatItsAllowListAdmits(t *testing.T) {
	engine, pool := harnessed(), newPool()
	opts := options(t)
	opts.Images = allowed(t, "runner:1", "ghcr.io/acme/*")
	pool.name("ghcr.io/acme/api:main", "ghcr.io/someone-else/runner:main")
	serving(t, opts, engine, pool)

	seen := map[string]bool{}
	eventually(t, "claims from both images", func() bool {
		select {
		case offer := <-pool.offered:
			seen[offer.Image] = true
		default:
		}
		return seen["runner:1"] && seen["ghcr.io/acme/api:main"]
	})

	if seen["ghcr.io/someone-else/runner:main"] {
		t.Error("claimed for an image its allow-list does not admit")
	}
	eventually(t, "the refusal reported", func() bool {
		each, ok := pool.reported("ghcr.io/someone-else/runner:main")
		return ok && strings.Contains(each.Refused, "does not admit")
	})
}

func TestStopsServingAnImageNoLineNamesAnyMore(t *testing.T) {
	engine, pool := harnessed(), newPool()
	opts := options(t)
	opts.Images = allowed(t, "runner:1", "ghcr.io/acme/*")
	pool.name("ghcr.io/acme/api:main")
	serving(t, opts, engine, pool)

	eventually(t, "the named image served", func() bool {
		_, ok := pool.reported("ghcr.io/acme/api:main")
		return ok
	})

	pool.name()
	eventually(t, "the named image dropped", func() bool {
		_, ok := pool.reported("ghcr.io/acme/api:main")
		return !ok
	})

	time.Sleep(50 * time.Millisecond)
	for len(pool.offered) > 0 {
		<-pool.offered
	}
	time.Sleep(100 * time.Millisecond)
	for len(pool.offered) > 0 {
		if offer := <-pool.offered; offer.Image == "ghcr.io/acme/api:main" {
			t.Fatal("still claims for an image no line names")
		}
	}
}

func TestRefusesAnImageWhoseRunnerIsTooOld(t *testing.T) {
	engine, pool := harnessed(), newPool()
	engine.release = "20260101-01"
	serving(t, options(t), engine, pool)

	eventually(t, "the refusal reported", func() bool {
		each, ok := pool.reported("runner:1")
		return ok && strings.Contains(each.Refused, "older than the "+leastRelease)
	})

	time.Sleep(100 * time.Millisecond)
	if len(pool.offered) > 0 {
		t.Error("claimed work for an image whose runner is too old")
	}
}

func TestAnImageItCannotLookInsideIsRefusedAndTheHostKeepsServing(t *testing.T) {
	engine, pool := harnessed(), newPool()
	engine.failProbe = true
	serving(t, options(t), engine, pool)

	eventually(t, "the refusal reported", func() bool {
		each, ok := pool.reported("runner:1")
		return ok && strings.Contains(each.Refused, "could not look inside")
	})

	engine.set(func(e *fakeEngine) { e.failProbe = false })
	eventually(t, "served once it can look inside", func() bool {
		each, ok := pool.reported("runner:1")
		return ok && each.Refused == "" && len(each.Harnesses) == 1
	})

	engine.mu.Lock()
	defer engine.mu.Unlock()
	if engine.starts != 0 {
		t.Errorf("started %d sandboxes while it could not look inside the image", engine.starts)
	}
}

func TestKeepsTheRunLeasedWhileItPullsAndStarts(t *testing.T) {
	engine, pool := harnessed(), newPool()
	opts := options(t)
	opts.LeaseEvery = 20 * time.Millisecond
	serving(t, opts, engine, pool)

	eventually(t, "the image served", func() bool {
		_, ok := pool.reported("runner:1")
		return ok
	})
	engine.set(func(e *fakeEngine) { e.pullTakes = 200 * time.Millisecond })

	pool.work <- handed("runner_1")
	eventually(t, "a sandbox", func() bool { return len(engine.workSandboxes()) == 1 })

	pool.worker.mu.Lock()
	renewed := slices.Clone(pool.worker.renewed)
	pool.worker.mu.Unlock()
	if len(renewed) < 3 || !slices.Contains(renewed, "run-runner_1") {
		t.Errorf("renewed %v while pulling for 200ms", renewed)
	}
}

func TestAClaimForAnImageNotYetReportedBacksOffWithoutStopping(t *testing.T) {
	engine, pool := harnessed(), newPool()
	pool.unoffer = true
	serving(t, options(t), engine, pool)

	time.Sleep(500 * time.Millisecond)

	pool.mu.Lock()
	claims := pool.claims
	pool.unoffer = false
	pool.mu.Unlock()
	if claims > 3 {
		t.Errorf("claimed %d times in half a second while the image went unreported", claims)
	}

	pool.work <- handed("runner_1")
	eventually(t, "a sandbox once the image is reported", func() bool { return len(engine.workSandboxes()) == 1 })
}

func TestJudgesAnImageAgainWhenTheControlPlaneNeedsANewerRunner(t *testing.T) {
	engine, pool := harnessed(), newPool()
	serving(t, options(t), engine, pool)

	eventually(t, "the image served", func() bool {
		each, ok := pool.reported("runner:1")
		return ok && each.Refused == ""
	})

	pool.need("20261001-01")
	eventually(t, "the image refused as too old", func() bool {
		each, _ := pool.reported("runner:1")
		return strings.Contains(each.Refused, "older than the 20261001-01")
	})
}
