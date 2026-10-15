package serve_test

import (
	"context"
	"crypto/ecdsa"
	"crypto/elliptic"
	crand "crypto/rand"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/json"
	"encoding/pem"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"math/big"
	"net/http"
	"os"
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

	egresses    map[string]sandbox.Spec
	networks    map[string]map[string]string
	unnetworked []string
	leftNets    []string
	egressMute  bool
	egressFails bool
	callMute    bool
}

func newEngine() *fakeEngine {
	return &fakeEngine{
		started: map[string]sandbox.Spec{},
		exits:   map[string]chan int{},
		release: leastRelease,
		images:  map[string]sandbox.Image{egressImage: {ID: "sha256:egress"}},
		pullTo:  map[string]sandbox.Image{},

		egresses: map[string]sandbox.Spec{},
		networks: map[string]map[string]string{},
	}
}

const egressImage = "egress:1"

func isEgress(spec sandbox.Spec) bool {
	return slices.Equal(spec.Entrypoint, []string{"spotlight", "egress"})
}

func imageAt(name, hex string) sandbox.Image {
	return sandbox.Image{ID: "sha256:" + hex, Digests: []string{name + "@sha256:" + hex}}
}

func (e *fakeEngine) Describe(context.Context) (string, error) { return "fake engine", nil }

func (e *fakeEngine) Inspect(_ context.Context, image string) (sandbox.Image, error) {
	e.mu.Lock()
	defer e.mu.Unlock()

	if found, ok := e.images[image]; ok {
		return found, nil
	}
	for _, found := range e.images {
		if found.ID == image {
			return found, nil
		}
	}
	return sandbox.Image{}, sandbox.ErrNoImage
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

	if isEgress(spec) {
		if e.egressFails {
			return "", errors.New("the egress image will not run")
		}
		e.next++
		id := fmt.Sprintf("egress_%d", e.next)
		e.egresses[id] = spec
		return id, nil
	}

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

func (e *fakeEngine) Read(_ context.Context, id, path string) ([]byte, error) {
	e.mu.Lock()
	defer e.mu.Unlock()

	spec, ok := e.egresses[id]
	if !ok || (e.egressMute && spec.Labels[serve.LabelRunner] != "") {
		return nil, os.ErrNotExist
	}
	if call := spec.Labels[serve.LabelCall]; call != "" {
		if e.callMute || path != protocol.EgressSendPath {
			return nil, os.ErrNotExist
		}
		return json.Marshal(protocol.HostCallAnswer{Status: 200, Body: "c2VudA==", Ms: 7})
	}
	return authorityFor(id), nil
}

func authorityFor(id string) []byte {
	key, _ := ecdsa.GenerateKey(elliptic.P256(), crand.Reader)
	template := &x509.Certificate{SerialNumber: big.NewInt(1), Subject: pkix.Name{CommonName: id}, NotAfter: time.Now().Add(time.Hour)}
	der, _ := x509.CreateCertificate(crand.Reader, template, template, &key.PublicKey, key)
	return pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: der})
}

func (e *fakeEngine) Network(_ context.Context, name string, labels map[string]string) (string, error) {
	e.mu.Lock()
	defer e.mu.Unlock()

	e.networks[name] = labels
	return name, nil
}

func (e *fakeEngine) Unnetwork(_ context.Context, id string) error {
	e.mu.Lock()
	defer e.mu.Unlock()

	e.unnetworked = append(e.unnetworked, id)
	return nil
}

func (e *fakeEngine) Networks(context.Context, string, string) ([]string, error) {
	return e.leftNets, nil
}

func (e *fakeEngine) egressOf(runner string) (string, sandbox.Spec, bool) {
	e.mu.Lock()
	defer e.mu.Unlock()

	for id, spec := range e.egresses {
		if spec.Labels[serve.LabelRunner] == runner {
			return id, spec, true
		}
	}
	return "", sandbox.Spec{}, false
}

func (e *fakeEngine) egressFor(call string) (string, sandbox.Spec, bool) {
	e.mu.Lock()
	defer e.mu.Unlock()

	for id, spec := range e.egresses {
		if spec.Labels[serve.LabelCall] == call {
			return id, spec, true
		}
	}
	return "", sandbox.Spec{}, false
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
	mu         sync.Mutex
	renewed    []string
	renewedBy  map[string]int
	checksGone bool
	checkLost  error
	images     map[string]string
	completed  map[string]protocol.Completion
	checked    map[string]protocol.StackChecked
}

func (w *worker) RenewLease(_ context.Context, runID string) (bool, error) {
	w.mu.Lock()
	defer w.mu.Unlock()
	w.renewed = append(w.renewed, runID)
	return false, nil
}

func (w *worker) RenewCheckLease(_ context.Context, _, stackID string, _ bool) (bool, error) {
	w.mu.Lock()
	defer w.mu.Unlock()
	w.renewed = append(w.renewed, stackID)
	return w.checksGone, w.checkLost
}

func (w *worker) RecordImage(_ context.Context, runID, image string) error {
	w.mu.Lock()
	defer w.mu.Unlock()
	w.images[runID] = image
	return nil
}

func (w *worker) Complete(_ context.Context, runID string, done protocol.Completion) (protocol.Completed, error) {
	w.mu.Lock()
	defer w.mu.Unlock()
	w.completed[runID] = done
	if w.renewedBy == nil {
		w.renewedBy = map[string]int{}
	}
	w.renewedBy[runID] = len(w.renewed)
	return protocol.Completed{}, nil
}

func (w *worker) RecordChangeStackCheck(_ context.Context, _, stackID string, _ bool, checked protocol.StackChecked) error {
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

	calls       chan protocol.HostCall
	refuseCalls chan struct{}
	answers     map[string]protocol.HostCallAnswer
}

func newPool() *pool {
	return &pool{
		work:    make(chan protocol.Handed, 8),
		refuse:  make(chan struct{}),
		offered: make(chan protocol.HostClaim, 256),

		calls:       make(chan protocol.HostCall, 8),
		refuseCalls: make(chan struct{}),
		answers:     map[string]protocol.HostCallAnswer{},
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

func (p *pool) ClaimCall(ctx context.Context) (*protocol.HostCall, error) {
	select {
	case call := <-p.calls:
		return &call, nil
	case <-p.refuseCalls:
		return nil, fmt.Errorf("claim a call: %w", control.ErrRefused)
	case <-time.After(20 * time.Millisecond):
		return nil, nil
	case <-ctx.Done():
		return nil, ctx.Err()
	}
}

func (p *pool) AnswerCall(_ context.Context, id string, answer protocol.HostCallAnswer) error {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.answers[id] = answer
	return nil
}

func (p *pool) answered(id string) (protocol.HostCallAnswer, bool) {
	p.mu.Lock()
	defer p.mu.Unlock()
	answer, ok := p.answers[id]
	return answer, ok
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
		RunnerID:    runner,
		Token:       "one-run-" + runner,
		EgressToken: "egress-" + runner,
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
		Egress: serve.Egress{
			Image: egressImage,
			Allow: []string{"api.anthropic.com"},
			Reads: []string{"prod/*"},
			Env:   []string{"AWS_REGION=eu-west-1"},
		},
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

		if len(spec.Files) == 0 || spec.Files[0].Path != serve.HandedPath || spec.Files[0].Mode != 0o400 {
			t.Fatalf("%s was handed %+v", id, spec.Files)
		}
		var given protocol.Handed
		if err := json.Unmarshal(spec.Files[0].Body, &given); err != nil || !strings.HasPrefix(given.Token, "one-run-") {
			t.Errorf("%s was handed %+v (%v)", id, given, err)
		}
		if !slices.Contains(spec.Env, "ANTHROPIC_API_KEY=spotlight-egress:ANTHROPIC_API_KEY") {
			t.Errorf("%s lacks the stand-in for the harness key: %v", id, spec.Env)
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

func TestEverySandboxIsToldHowLongToWaitWarmForAnAnswer(t *testing.T) {
	engine, pool := harnessed(), newPool()
	opts := options(t)
	opts.AnswerWait = 90 * time.Second
	serving(t, opts, engine, pool)

	pool.work <- handed("runner_1")
	eventually(t, "a sandbox", func() bool { return len(engine.workSandboxes()) == 1 })

	id := engine.workSandboxes()[0]
	if spec := engine.sandbox(id); !slices.Contains(spec.Env, "SPOTLIGHT_ANSWER_WAIT=1m30s") {
		t.Errorf("the sandbox was not told how long to wait: %v", spec.Env)
	}

	engine.finish(id)
	eventually(t, "destroyed", func() bool { return engine.wasDestroyed(id) })
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

func TestARunWhoseSandboxRanPastItsTimeIsReportedAsTimedOut(t *testing.T) {
	engine, pool := harnessed(), newPool()
	opts := options(t)
	opts.RunTimeout = 50 * time.Millisecond
	serving(t, opts, engine, pool)

	pool.work <- handed("runner_1")
	eventually(t, "the run reported timed out", func() bool {
		done, ok := pool.worker.completion("run-runner_1")
		return ok && done.Failed && done.TimedOut && !done.Unprepared && strings.Contains(done.Message, "time limit")
	})
}

func TestStopsRenewingTheLeaseBeforeSayingTheRunRanOutOfTime(t *testing.T) {
	engine, pool := harnessed(), newPool()
	opts := options(t)
	opts.RunTimeout = 80 * time.Millisecond
	opts.LeaseEvery = 5 * time.Millisecond
	serving(t, opts, engine, pool)

	pool.work <- handed("runner_1")
	eventually(t, "the run reported timed out", func() bool {
		done, ok := pool.worker.completion("run-runner_1")
		return ok && done.TimedOut
	})
	time.Sleep(40 * time.Millisecond)

	pool.worker.mu.Lock()
	defer pool.worker.mu.Unlock()
	atReport := pool.worker.renewedBy["run-runner_1"]
	if len(pool.worker.renewed) != atReport {
		t.Errorf("renewed the lease %d times after saying the run ran out of time", len(pool.worker.renewed)-atReport)
	}
}

func TestARunWhoseSandboxFinishesInTimeIsLeftToItsRunnerToReport(t *testing.T) {
	engine, pool := harnessed(), newPool()
	serving(t, options(t), engine, pool)

	pool.work <- handed("runner_1")
	eventually(t, "a sandbox", func() bool { return len(engine.workSandboxes()) == 1 })
	id := engine.workSandboxes()[0]
	engine.finish(id)

	eventually(t, "destroyed once finished", func() bool { return engine.wasDestroyed(id) })
	if done, ok := pool.worker.completion("run-runner_1"); ok {
		t.Errorf("the host reported the run itself: %+v", done)
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

	if first.Session == "" {
		t.Errorf("reported no session: %+v", first)
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
	if !done.Failed || !done.Unprepared || !strings.Contains(done.Message, "no longer holds the claude-code harness") {
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
		return strings.Contains(each.Refused, "can't be pulled")
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
		return ok && strings.Contains(each.Refused, "doesn't admit")
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
		return ok && strings.Contains(each.Refused, "Minimum version required: "+leastRelease)
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
		return ok && strings.Contains(each.Refused, "can't be inspected")
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

func TestKeepsTheCheckLeasedWhileItPullsAndStarts(t *testing.T) {
	engine, pool := harnessed(), newPool()
	opts := options(t)
	opts.LeaseEvery = 20 * time.Millisecond
	serving(t, opts, engine, pool)

	eventually(t, "the image served", func() bool {
		_, ok := pool.reported("runner:1")
		return ok
	})
	engine.set(func(e *fakeEngine) { e.pullTakes = 200 * time.Millisecond })

	pool.work <- protocol.Handed{
		RunnerID:    "runner_1",
		Token:       "one-run",
		EgressToken: "egress-runner_1",
		Work: protocol.Claimed{Kind: protocol.ClaimedCheck, Check: &protocol.StackCheck{
			StackID: "stack_1", RunID: "run_1",
		}},
	}
	eventually(t, "a sandbox", func() bool { return len(engine.workSandboxes()) == 1 })

	pool.worker.mu.Lock()
	renewed := slices.Clone(pool.worker.renewed)
	pool.worker.mu.Unlock()
	if len(renewed) < 3 || !slices.Contains(renewed, "stack_1") {
		t.Errorf("renewed %v while pulling for 200ms", renewed)
	}
}

func TestStartsNoSandboxForACheckItNoLongerHoldsWhileItPulls(t *testing.T) {
	for name, gone := range map[string]func(w *worker){
		"told to stop": func(w *worker) { w.checksGone = true },
		"refused": func(w *worker) {
			w.checkLost = &control.Rejection{Status: http.StatusNotFound, Err: errors.New("404 Not Found")}
		},
	} {
		t.Run(name, func(t *testing.T) {
			engine, pool := harnessed(), newPool()
			opts := options(t)
			opts.LeaseEvery = 20 * time.Millisecond
			serving(t, opts, engine, pool)

			eventually(t, "the image served", func() bool {
				_, ok := pool.reported("runner:1")
				return ok
			})
			engine.set(func(e *fakeEngine) { e.pullTakes = 200 * time.Millisecond })
			pool.worker.mu.Lock()
			gone(pool.worker)
			pool.worker.mu.Unlock()

			pool.work <- protocol.Handed{
				RunnerID:    "runner_1",
				Token:       "one-run",
				EgressToken: "egress-runner_1",
				Work: protocol.Claimed{Kind: protocol.ClaimedCheck, Check: &protocol.StackCheck{
					StackID: "stack_1", RunID: "run_1",
				}},
			}
			eventually(t, "the check renewed", func() bool {
				pool.worker.mu.Lock()
				defer pool.worker.mu.Unlock()
				return slices.Contains(pool.worker.renewed, "stack_1")
			})

			time.Sleep(400 * time.Millisecond)
			if started := engine.workSandboxes(); len(started) != 0 {
				t.Errorf("started %v for a check it no longer holds", started)
			}
			pool.worker.mu.Lock()
			defer pool.worker.mu.Unlock()
			if len(pool.worker.checked) != 0 {
				t.Errorf("reported %v for a check it no longer holds", pool.worker.checked)
			}
		})
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
		return strings.Contains(each.Refused, "Minimum version required: 20261001-01")
	})
}

func TestEverySandboxGoesOutOnlyThroughAnEgressOfItsOwn(t *testing.T) {
	engine, pool := harnessed(), newPool()
	opts := options(t)
	opts.Network = "spotlight_default"
	opts.ExtraHosts = []string{"app.test:host-gateway"}
	serving(t, opts, engine, pool)

	pool.work <- handed("runner_1")
	eventually(t, "a sandbox", func() bool { return len(engine.workSandboxes()) == 1 })

	egressID, egress, ok := engine.egressOf("runner_1")
	if !ok {
		t.Fatal("no egress was started for the run")
	}
	if egress.Image != "sha256:egress" || egress.Network != "spotlight_default" ||
		!slices.Equal(egress.ExtraHosts, opts.ExtraHosts) || !slices.Equal(egress.Env, []string{"AWS_REGION=eu-west-1"}) {
		t.Errorf("egress started as %+v", egress)
	}
	if len(egress.Joins) != 1 || egress.Joins[0].Network != "spotlight-runner_1" ||
		!slices.Equal(egress.Joins[0].Aliases, []string{serve.EgressAlias}) {
		t.Errorf("egress joined %+v", egress.Joins)
	}

	var told protocol.EgressHanded
	if len(egress.Files) != 1 || egress.Files[0].Path != protocol.EgressHandedPath || egress.Files[0].Mode != 0o400 ||
		json.Unmarshal(egress.Files[0].Body, &told) != nil {
		t.Fatalf("egress was handed %+v", egress.Files)
	}
	if told.Token != "egress-runner_1" || told.URL != opts.SandboxURL || !slices.Equal(told.Allow, []string{"api.anthropic.com"}) ||
		!slices.Equal(told.Reads, []string{"prod/*"}) || len(told.Credential) < 16 {
		t.Errorf("egress was told %+v", told)
	}

	sandboxID := engine.workSandboxes()[0]
	spec := engine.sandbox(sandboxID)
	if spec.Network != "spotlight-runner_1" || len(spec.ExtraHosts) != 0 {
		t.Errorf("the sandbox is on %q with %v, not its egress's network alone", spec.Network, spec.ExtraHosts)
	}

	var given protocol.Handed
	if err := json.Unmarshal(spec.Files[0].Body, &given); err != nil || given.EgressToken != "" ||
		strings.Contains(string(spec.Files[0].Body), "egress-runner_1") {
		t.Errorf("the sandbox was handed egress's credential: %s", spec.Files[0].Body)
	}

	proxy := "http://sandbox:" + told.Credential + "@egress:3128"
	for _, want := range []string{
		"HTTPS_PROXY=" + proxy,
		"https_proxy=" + proxy,
		"HTTP_PROXY=" + proxy,
		"NO_PROXY=localhost,127.0.0.1,::1",
		"SSL_CERT_FILE=" + serve.BundlePath,
		"NODE_EXTRA_CA_CERTS=" + serve.AuthorityPath,
		"GIT_SSL_CAINFO=" + serve.BundlePath,
	} {
		if !slices.Contains(spec.Env, want) {
			t.Errorf("the sandbox lacks %s: %v", want, spec.Env)
		}
	}

	if len(spec.Files) != 2 || spec.Files[1].Path != serve.AuthorityPath || spec.Files[1].Mode != 0o644 ||
		spec.Files[1].DirMode != 0o755 || !strings.Contains(string(spec.Files[1].Body), "BEGIN CERTIFICATE") {
		t.Errorf("the sandbox was handed %+v", spec.Files[1:])
	}

	engine.finish(sandboxID)
	eventually(t, "egress and its network gone", func() bool {
		engine.mu.Lock()
		defer engine.mu.Unlock()
		return slices.Contains(engine.destroyed, egressID) && slices.Contains(engine.unnetworked, "spotlight-runner_1")
	})

	engine.mu.Lock()
	defer engine.mu.Unlock()
	sandboxAt := slices.Index(engine.destroyed, sandboxID)
	egressAt := slices.Index(engine.destroyed, egressID)
	if sandboxAt < 0 || egressAt < sandboxAt {
		t.Errorf("destroyed %v: the sandbox must go before its egress", engine.destroyed)
	}
}

func TestGivesUpTheRunWhenItsEgressIsNeverReady(t *testing.T) {
	engine, pool := harnessed(), newPool()
	engine.egressMute = true
	opts := options(t)
	opts.EgressWait = 100 * time.Millisecond
	serving(t, opts, engine, pool)

	pool.work <- handed("runner_1")
	eventually(t, "the run given up", func() bool {
		done, ok := pool.worker.completion("run-runner_1")
		return ok && done.Failed && done.Unprepared && strings.Contains(done.Message, "egress didn't start")
	})

	if got := len(engine.workSandboxes()); got != 0 {
		t.Errorf("started %d sandboxes with no way out", got)
	}
	egressID, _, _ := engine.egressOf("runner_1")
	eventually(t, "the egress destroyed", func() bool { return engine.wasDestroyed(egressID) })
}

func TestGivesUpTheRunWhenTheControlPlaneHandsNoEgressCredential(t *testing.T) {
	engine, pool := harnessed(), newPool()
	serving(t, options(t), engine, pool)

	work := handed("runner_1")
	work.EgressToken = ""
	pool.work <- work
	eventually(t, "the run given up", func() bool {
		done, ok := pool.worker.completion("run-runner_1")
		return ok && done.Failed
	})

	if _, _, ok := engine.egressOf("runner_1"); ok || len(engine.workSandboxes()) != 0 {
		t.Error("started a sandbox or egress without egress's credential")
	}
}

func TestRemovesTheNetworksACrashedHostLeftBehind(t *testing.T) {
	engine, pool := harnessed(), newPool()
	engine.leftNets = []string{"spotlight-orphan"}
	serving(t, options(t), engine, pool)

	eventually(t, "the network removed", func() bool {
		engine.mu.Lock()
		defer engine.mu.Unlock()
		return slices.Contains(engine.unnetworked, "spotlight-orphan")
	})
}

func TestHandsEgressTheAuthoritiesItTrustsForPrivateHosts(t *testing.T) {
	engine, pool := harnessed(), newPool()
	opts := options(t)
	opts.Egress.Trust = []byte("acme authority")
	serving(t, opts, engine, pool)

	pool.work <- handed("runner_1")
	eventually(t, "a sandbox", func() bool { return len(engine.workSandboxes()) == 1 })

	_, egress, _ := engine.egressOf("runner_1")
	if !slices.Contains(egress.Env, "SSL_CERT_DIR="+serve.EgressTrusts) {
		t.Errorf("egress env %v", egress.Env)
	}
	if len(egress.Files) != 2 || egress.Files[1].Path != serve.EgressTrusts+"/trusted.pem" || string(egress.Files[1].Body) != "acme authority" {
		t.Errorf("egress files %+v", egress.Files)
	}

	sandboxed := engine.sandbox(engine.workSandboxes()[0])
	for _, file := range sandboxed.Files {
		if string(file.Body) == "acme authority" {
			t.Error("the sandbox was handed what egress trusts upstream")
		}
	}
}

func TestEachRunsEgressAnswersOnlyToACredentialOfItsOwn(t *testing.T) {
	engine, pool := harnessed(), newPool()
	opts := options(t)
	opts.Capacity = 2
	serving(t, opts, engine, pool)

	pool.work <- handed("runner_1")
	pool.work <- handed("runner_2")
	eventually(t, "two sandboxes", func() bool { return len(engine.workSandboxes()) == 2 })

	credentials := map[string]bool{}
	for _, runner := range []string{"runner_1", "runner_2"} {
		_, egress, _ := engine.egressOf(runner)
		var told protocol.EgressHanded
		if err := json.Unmarshal(egress.Files[0].Body, &told); err != nil {
			t.Fatal(err)
		}
		credentials[told.Credential] = true
	}
	if len(credentials) != 2 {
		t.Errorf("two runs' egresses share a credential: %v", credentials)
	}
}

func TestPullsTheEgressImageOnceAndRunsEveryEgressFromIt(t *testing.T) {
	engine, pool := harnessed(), newPool()
	engine.set(func(e *fakeEngine) {
		e.images[egressImage] = imageAt("egress", strings.Repeat("e", 64))
	})
	serving(t, options(t), engine, pool)

	for _, runner := range []string{"runner_1", "runner_2"} {
		pool.work <- handed(runner)
		eventually(t, "a sandbox for "+runner, func() bool {
			_, _, ok := engine.egressOf(runner)
			return ok && len(engine.workSandboxes()) > 0
		})
		engine.finish(engine.workSandboxes()[len(engine.workSandboxes())-1])
	}

	if pulls := slices.Collect(func(yield func(string) bool) {
		for _, each := range engine.pulled() {
			if each == egressImage && !yield(each) {
				return
			}
		}
	}); len(pulls) != 1 {
		t.Errorf("pulled the egress image %d times", len(pulls))
	}
}

func TestHandsHarnessKeysToEgressAndTheSandboxAndProbeOnlyStandIns(t *testing.T) {
	engine, pool := harnessed(), newPool()
	opts := options(t)
	opts.SandboxEnv = []string{"ANTHROPIC_API_KEY=sk-test", "CURSOR_API_KEY=cursor-test", "GIT_AUTHOR=spotlight"}
	serving(t, opts, engine, pool)

	pool.work <- handed("runner_1")
	eventually(t, "a sandbox", func() bool { return len(engine.workSandboxes()) == 1 })

	told := func(spec sandbox.Spec) protocol.EgressHanded {
		var handed protocol.EgressHanded
		if err := json.Unmarshal(spec.Files[0].Body, &handed); err != nil {
			t.Fatal(err)
		}
		return handed
	}
	wantHeld := []protocol.HeldByTheHost{{Name: "ANTHROPIC_API_KEY", Host: "api.anthropic.com", Header: "x-api-key", Value: "sk-test"}}

	_, runEgress, _ := engine.egressOf("runner_1")
	if held := told(runEgress).Held; !slices.Equal(held, wantHeld) {
		t.Errorf("the run's egress holds %+v", held)
	}

	sandboxed := engine.sandbox(engine.workSandboxes()[0])
	for _, want := range []string{"ANTHROPIC_API_KEY=spotlight-egress:ANTHROPIC_API_KEY", "CURSOR_API_KEY=cursor-test", "GIT_AUTHOR=spotlight"} {
		if !slices.Contains(sandboxed.Env, want) {
			t.Errorf("the sandbox lacks %s: %v", want, sandboxed.Env)
		}
	}
	if slices.Contains(sandboxed.Env, "ANTHROPIC_API_KEY=sk-test") {
		t.Error("the sandbox holds the harness key")
	}

	engine.mu.Lock()
	defer engine.mu.Unlock()
	probed := false
	for _, spec := range engine.started {
		if len(spec.Args) == 0 || spec.Args[0] != "harnesses" {
			continue
		}
		probed = true
		if slices.Contains(spec.Env, "ANTHROPIC_API_KEY=sk-test") || !slices.Contains(spec.Env, "ANTHROPIC_API_KEY=spotlight-egress:ANTHROPIC_API_KEY") {
			t.Errorf("the probe ran with %v", spec.Env)
		}
		if !strings.HasPrefix(spec.Network, "spotlight-probe-") {
			t.Errorf("the probe ran on %q, not behind an egress", spec.Network)
		}
	}
	probeEgress := false
	for _, spec := range engine.egresses {
		if spec.Labels[serve.LabelRunner] == "" {
			probeEgress = true
			if handed := told(spec); handed.Token != "" || !slices.Equal(handed.Held, wantHeld) {
				t.Errorf("the probe's egress was told %+v", handed)
			}
		}
	}
	if !probed || !probeEgress {
		t.Errorf("probed %v behind an egress %v", probed, probeEgress)
	}
}

func handedTo(t *testing.T, spec sandbox.Spec) protocol.EgressHanded {
	t.Helper()

	for _, file := range spec.Files {
		if file.Path == protocol.EgressHandedPath {
			var handed protocol.EgressHanded
			if err := json.Unmarshal(file.Body, &handed); err != nil {
				t.Fatal(err)
			}
			return handed
		}
	}
	t.Fatal("egress was handed nothing")
	return protocol.EgressHanded{}
}

func hookCall(id string) protocol.HostCall {
	return protocol.HostCall{
		ID: id, Method: "POST", URL: "https://audit.acme.internal/hooks",
		Headers: map[string]string{"content-type": "application/json"}, Body: "e30=", TimeoutMs: 50,
	}
}

func TestSendsACallThroughAnEgressOfItsOwnAndAnswersWhatItSaid(t *testing.T) {
	engine, pool := harnessed(), newPool()
	opts := options(t)
	opts.Network = "spotlight"
	opts.ExtraHosts = []string{"audit.acme.internal:10.0.0.7"}
	serving(t, opts, engine, pool)

	pool.calls <- hookCall("call_1")
	eventually(t, "the call answered", func() bool { _, ok := pool.answered("call_1"); return ok })

	answer, _ := pool.answered("call_1")
	if answer.Status != 200 || answer.Body != "c2VudA==" || answer.Ms != 7 || answer.Error != "" {
		t.Errorf("answered %+v", answer)
	}

	id, spec, ok := engine.egressFor("call_1")
	if !ok {
		t.Fatal("sent the call without an egress")
	}
	if spec.Labels[serve.LabelHost] != "host_1" || spec.Network != "spotlight" || len(spec.Joins) != 0 ||
		!slices.Equal(spec.ExtraHosts, opts.ExtraHosts) || !slices.Contains(spec.Env, "AWS_REGION=eu-west-1") {
		t.Errorf("started the call's egress as %+v", spec)
	}
	handed := handedTo(t, spec)
	if handed.Send == nil || handed.Send.ID != "call_1" || handed.Send.URL != "https://audit.acme.internal/hooks" ||
		handed.Token != "" || handed.Credential == "" || !slices.Equal(handed.Allow, opts.Egress.Allow) {
		t.Errorf("handed the call's egress %+v", handed)
	}
	eventually(t, "the call's egress destroyed", func() bool { return engine.wasDestroyed(id) })

	engine.mu.Lock()
	defer engine.mu.Unlock()
	for name := range engine.networks {
		if strings.Contains(name, "call") {
			t.Errorf("made the network %s for a call", name)
		}
	}
}

func TestAnswersACallWhoseEgressWillNotStart(t *testing.T) {
	engine, pool := harnessed(), newPool()
	engine.egressFails = true
	serving(t, options(t), engine, pool)

	pool.calls <- hookCall("call_1")
	eventually(t, "the call answered", func() bool { _, ok := pool.answered("call_1"); return ok })

	answer, _ := pool.answered("call_1")
	if answer.Status != 0 || answer.Error != "The host's egress didn't start. Error: the egress image will not run" {
		t.Errorf("answered %+v", answer)
	}
}

func TestAnswersACallWhoseEgressNeverAnswers(t *testing.T) {
	engine, pool := harnessed(), newPool()
	engine.callMute = true
	opts := options(t)
	opts.EgressWait = 100 * time.Millisecond
	serving(t, opts, engine, pool)

	pool.calls <- hookCall("call_1")
	eventually(t, "the call answered", func() bool { _, ok := pool.answered("call_1"); return ok })

	answer, _ := pool.answered("call_1")
	if answer.Status != 0 || answer.Error != "The host's egress didn't answer in time. Time limit: 150ms" {
		t.Errorf("answered %+v", answer)
	}
	id, _, _ := engine.egressFor("call_1")
	eventually(t, "the call's egress destroyed", func() bool { return engine.wasDestroyed(id) })
}

func TestAHostWhoseCallsAreRefusedStops(t *testing.T) {
	engine, pool := harnessed(), newPool()
	_, stopped := serving(t, options(t), engine, pool)

	close(pool.refuseCalls)

	if err := stopped(); !errors.Is(err, control.ErrRefused) {
		t.Fatalf("stopped with %v", err)
	}
}
