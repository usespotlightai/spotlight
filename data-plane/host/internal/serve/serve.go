package serve

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"math/rand/v2"
	"net/url"
	"slices"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"usespotlight.ai/data-plane/control"
	"usespotlight.ai/data-plane/host/internal/images"
	"usespotlight.ai/data-plane/host/internal/mirror"
	"usespotlight.ai/data-plane/host/internal/sandbox"
	"usespotlight.ai/data-plane/protocol"
)

const (
	LabelHost   = "ai.usespotlight.host"
	LabelRunner = "ai.usespotlight.runner"
	LabelCall   = "ai.usespotlight.call"

	HandedPath = "/run/spotlight/handed.json"
	MirrorRoot = "/spotlight/mirrors"

	AuthorityPath = protocol.SandboxAuthority
	BundlePath    = protocol.SandboxBundle
	EgressTrusts  = "/etc/spotlight/trust"
	EgressAlias   = "egress"

	presenceEvery   = 20 * time.Second
	refreshEvery    = time.Minute
	leaseEvery      = 20 * time.Second
	stopGrace       = 30 * time.Second
	mirrorWait      = 15 * time.Second
	quickAnswer     = 2 * time.Second
	drainBudget     = 5 * time.Second
	egressWait      = 90 * time.Second
	probeEgressWait = 30 * time.Second
	egressPoll      = 250 * time.Millisecond
	mirrorLongest   = 30 * time.Minute
	probeLongest    = 2 * time.Minute
	cleanupBudget   = time.Minute
	retryFloor      = 2 * time.Second
	retryCeiling    = 30 * time.Second
)

type Pool interface {
	Requirements(ctx context.Context) (protocol.HostRequirements, error)
	Claim(ctx context.Context, offer protocol.HostClaim) (*protocol.Handed, error)
	ClaimCall(ctx context.Context) (*protocol.HostCall, error)
	AnswerCall(ctx context.Context, id string, answer protocol.HostCallAnswer) error
	Present(ctx context.Context, presence protocol.HostPresence) (protocol.HostStanding, error)
	Leave(ctx context.Context) error
	Seat(handed protocol.Handed) (Worker, error)
}

type Worker interface {
	RenewLease(ctx context.Context, runID string) (bool, error)
	RenewCheckLease(ctx context.Context, runID, stackID string) (bool, error)
	RecordImage(ctx context.Context, runID, image string) error
	Complete(ctx context.Context, runID string, done protocol.Completion) error
	RecordChangeStackCheck(ctx context.Context, runID, stackID string, checked protocol.StackChecked) error
}

type Registry interface {
	For(image string) (string, error)
}

type Options struct {
	HostID       string
	Name         string
	Version      string
	Images       images.Allowed
	Registry     Registry
	RefreshEvery time.Duration
	LeaseEvery   time.Duration
	EgressWait   time.Duration
	Capacity     int
	RunTimeout   time.Duration
	ControlURL   string
	SandboxURL   string
	SandboxEnv   []string
	Egress       Egress
	Network      string
	ExtraHosts   []string
}

type Egress struct {
	Image string
	Allow []string
	Reads []string
	Env   []string
	Trust []byte
}

type Host struct {
	opts    Options
	pool    Pool
	engine  sandbox.Engine
	mirrors *mirror.Mirrors
	log     *slog.Logger

	slots     chan struct{}
	loops     sync.WaitGroup
	sandboxes sync.WaitGroup
	answering sync.WaitGroup
	refreshes sync.WaitGroup
	workspace string
	engineIs  string

	mu         sync.Mutex
	served     map[string]*served
	unadmitted []string
	required   protocol.HostRequirements
	running    map[string]string
	held       map[string]time.Time
	failures   map[string]int
	egressIs   string
}

func New(opts Options, pool Pool, engine sandbox.Engine, mirrors *mirror.Mirrors, log *slog.Logger) *Host {
	return &Host{
		opts:     opts,
		pool:     pool,
		engine:   engine,
		mirrors:  mirrors,
		log:      log,
		slots:    make(chan struct{}, max(opts.Capacity, 1)),
		served:   map[string]*served{},
		running:  map[string]string{},
		held:     map[string]time.Time{},
		failures: map[string]int{},
	}
}

func (h *Host) Serve(ctx context.Context) error {
	claiming, stopClaiming := context.WithCancel(ctx)
	defer stopClaiming()

	var (
		failure error
		failing sync.Once
	)
	stop := func(err error) {
		failing.Do(func() {
			failure = err
			h.log.Error("the control plane will not have this host; it stops claiming and lets its sandboxes finish", "error", err)
		})
		stopClaiming()
	}

	if err := retried(ctx, h.log, "the container runtime is not answering yet", func() (err error) {
		h.engineIs, err = h.engine.Describe(ctx)
		return err
	}); err != nil {
		return quiet(ctx, err)
	}
	h.log.Info("reached the container runtime", "engine", h.engineIs)

	if err := retried(ctx, h.log, "could not report to the control plane, still trying", func() error {
		standing, err := h.pool.Present(ctx, h.presence())
		h.workspace = standing.Workspace
		return err
	}); err != nil {
		return quiet(ctx, err)
	}

	h.reap(ctx)

	var reporting sync.WaitGroup
	defer func() {
		stopClaiming()
		reporting.Wait()
	}()
	reporting.Go(func() { h.report(claiming, stop) })

	if err := retried(claiming, h.log, "could not ask what to serve, still trying", func() error {
		return h.refresh(claiming, claiming, ctx, stop)
	}); err != nil {
		if final(err) {
			stop(err)
		} else {
			return quiet(ctx, err)
		}
	}

	h.log.Info("serving", "name", h.opts.Name, "capacity", cap(h.slots), "default", h.opts.Images.Default)

	reporting.Go(func() { h.watch(claiming, ctx, stop) })
	h.loops.Go(func() {
		if err := h.calls(claiming, ctx, stop); err != nil {
			stop(err)
		}
	})

	<-claiming.Done()
	reporting.Wait()
	h.loops.Wait()
	h.sandboxes.Wait()
	h.answering.Wait()
	h.refreshes.Wait()

	leaving, cancel := context.WithTimeout(context.WithoutCancel(ctx), 10*time.Second)
	defer cancel()
	if err := h.pool.Leave(leaving); err != nil {
		h.log.Warn("could not say it is leaving", "error", err)
	}

	return failure
}

func quiet(ctx context.Context, err error) error {
	if ctx.Err() != nil {
		return nil
	}
	return err
}

func (h *Host) reap(ctx context.Context) {
	left, err := h.engine.Labelled(ctx, LabelHost, h.opts.HostID)
	if err != nil {
		h.log.Warn("could not look for sandboxes left behind", "error", err)
		return
	}

	for _, id := range left {
		if err := h.engine.Destroy(ctx, id); err != nil {
			h.log.Warn("could not destroy a sandbox left behind", "sandbox", id, "error", err)
			continue
		}
		h.log.Info("destroyed a sandbox left behind", "sandbox", id)
	}

	networks, err := h.engine.Networks(ctx, LabelHost, h.opts.HostID)
	if err != nil {
		h.log.Warn("could not look for sandbox networks left behind", "error", err)
		return
	}

	for _, id := range networks {
		if err := h.engine.Unnetwork(ctx, id); err != nil {
			h.log.Warn("could not remove a sandbox network left behind", "network", id, "error", err)
		}
	}
}

func (h *Host) watch(claiming, serving context.Context, stop func(error)) {
	every := h.opts.RefreshEvery
	if every <= 0 {
		every = refreshEvery
	}
	ticker := time.NewTicker(every)
	defer ticker.Stop()

	for {
		select {
		case <-claiming.Done():
			return
		case <-ticker.C:
		}

		if err := h.refresh(claiming, claiming, serving, stop); err != nil {
			if final(err) {
				stop(err)
				return
			}
			if claiming.Err() == nil {
				h.log.Warn("could not ask what to serve", "error", err)
			}
		}
	}
}

func (h *Host) report(ctx context.Context, stop func(error)) {
	ticker := time.NewTicker(presenceEvery)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
		}

		if _, err := h.pool.Present(ctx, h.presence()); err != nil {
			if final(err) {
				stop(err)
				return
			}
			if ctx.Err() == nil {
				h.log.Warn("could not report presence", "error", err)
			}
		}
	}
}

func (h *Host) presence() protocol.HostPresence {
	h.mu.Lock()
	running := make([]string, 0, len(h.running))
	for runner := range h.running {
		running = append(running, runner)
	}
	h.mu.Unlock()
	slices.Sort(running)

	return protocol.HostPresence{
		Name:     h.opts.Name,
		Release:  h.opts.Version,
		Executor: h.engineIs,
		Capacity: cap(h.slots),
		Running:  running,
		Images:   h.reportedImages(),
	}
}

func (h *Host) claim(ctx, serving context.Context, image string) error {
	backoff := retryFloor

	for {
		current, ok := h.servedAs(image)
		if !ok {
			return nil
		}
		if current.refused != "" {
			if !sleep(ctx, jitter(retryCeiling)) {
				return nil
			}
			continue
		}

		if wait := h.heldFor(image); wait > 0 {
			if !sleep(ctx, wait) {
				return nil
			}
			continue
		}

		select {
		case h.slots <- struct{}{}:
		case <-ctx.Done():
			return nil
		}

		if h.heldFor(image) > 0 {
			<-h.slots
			continue
		}

		asked := time.Now()
		handed, err := h.pool.Claim(ctx, protocol.HostClaim{Image: image})
		if err != nil || handed == nil {
			<-h.slots

			if ctx.Err() != nil {
				return nil
			}
			if final(err) {
				return err
			}
			if err != nil {
				h.log.Warn("claim failed", "image", image, "error", err, "retryIn", backoff)
				if !sleep(ctx, jitter(backoff)) {
					return nil
				}
				backoff = min(backoff*2, retryCeiling)
			} else if time.Since(asked) < quickAnswer && !sleep(ctx, jitter(retryFloor)) {
				return nil
			}
			continue
		}

		backoff = retryFloor
		h.sandboxes.Go(func() {
			defer func() { <-h.slots }()
			h.sandbox(serving, image, *handed)
		})
	}
}

func (h *Host) heldFor(image string) time.Duration {
	h.mu.Lock()
	defer h.mu.Unlock()

	return time.Until(h.held[image])
}

func (h *Host) started(image string, ok bool) {
	h.mu.Lock()
	defer h.mu.Unlock()

	if ok {
		delete(h.failures, image)
		delete(h.held, image)
		return
	}

	h.failures[image]++
	pause := min(retryFloor<<min(h.failures[image], 5), retryCeiling)
	h.held[image] = time.Now().Add(jitter(pause))
}

func Final(err error) bool {
	return final(err)
}

func final(err error) bool {
	return errors.Is(err, control.ErrRefused) ||
		control.Rejected(err, "host-taken") ||
		control.Rejected(err, "host-unreported")
}

func (h *Host) sandbox(ctx context.Context, image string, handed protocol.Handed) {
	log := h.log.With("runner", handed.RunnerID)
	if handed.Work.Run != nil {
		log = log.With("run", handed.Work.Run.ID)
	}
	if handed.Work.Check != nil {
		log = log.With("stack", handed.Work.Check.StackID)
	}

	if ctx.Err() != nil {
		log.Info("the host is stopping, so the work is left to be claimed again")
		return
	}

	inSandbox := handed
	inSandbox.EgressToken = ""
	body, err := json.Marshal(inSandbox)
	if err != nil {
		log.Error("could not hand over the work", "error", err)
		return
	}

	worker, err := h.pool.Seat(handed)
	if err != nil {
		log.Error("could not act for the runner it was handed", "error", err)
		return
	}

	held, told := h.holding(ctx, handed, worker, log)
	defer held()

	ready, ok := h.readied(ctx, image, handed, worker, log)
	if !ok {
		return
	}
	if told() {
		log.Info("told to stop the work, so no sandbox starts")
		return
	}

	mounts := h.borrow(ctx, handed, log)
	if ctx.Err() != nil {
		log.Info("the host is stopping, so the work is left to be claimed again")
		return
	}

	starting, cancel := context.WithTimeout(context.WithoutCancel(ctx), 5*time.Minute)
	defer cancel()

	sandboxEnv, keys := standInsFor(h.opts.SandboxEnv)

	way, err := h.egress(starting, handed, keys, log)
	defer way.close()
	if err != nil {
		log.Warn("gave up the work: its way out did not start", "error", err)
		h.giveUp(ctx, handed, worker, fmt.Sprintf("The sandbox's egress did not start: %v", err), log)
		return
	}

	if told() {
		log.Info("told to stop the work, so no sandbox starts")
		return
	}

	env := append(sandboxEnv, way.env()...)
	env = append(env,
		"SPOTLIGHT_URL="+h.opts.SandboxURL,
		"SPOTLIGHT_HANDED="+HandedPath,
	)
	if len(mounts) > 0 {
		env = append(env, "SPOTLIGHT_MIRRORS="+MirrorRoot)
	}

	id, err := h.engine.Start(starting, sandbox.Spec{
		Name:    "spotlight-" + handed.RunnerID,
		Image:   ready.id,
		Env:     env,
		Labels:  map[string]string{LabelHost: h.opts.HostID, LabelRunner: handed.RunnerID},
		Mounts:  mounts,
		Files:   append([]sandbox.File{{Path: HandedPath, Mode: 0o400, Body: body}}, way.files()...),
		Network: way.network,
	})
	defer h.destroy(id)
	h.started(image, err == nil)
	if err != nil {
		log.Error("could not start a sandbox; claiming from this image pauses", "image", ready.digest, "error", err)
		return
	}

	held()
	h.track(handed.RunnerID, id)
	defer h.untrack(handed.RunnerID)
	log.Info("started a sandbox", "sandbox", id)

	watching, stopWatching := context.WithCancel(context.WithoutCancel(ctx))
	defer stopWatching()

	followed := make(chan struct{})
	go func() {
		defer close(followed)
		if err := h.engine.Follow(watching, id, &echo{log: log}); err != nil && watching.Err() == nil {
			log.Warn("stopped following the sandbox", "error", err)
		}
	}()

	exited := make(chan int, 1)
	go func() { exited <- h.waited(watching, id, log) }()

	timeout := time.NewTimer(h.opts.RunTimeout)
	defer timeout.Stop()

	drain := func() {
		drained := time.NewTimer(drainBudget)
		defer drained.Stop()
		select {
		case <-followed:
		case <-drained.C:
		}
	}

	select {
	case code := <-exited:
		drain()
		log.Info("the sandbox finished", "exit", code)
		return
	case <-timeout.C:
		log.Warn("the sandbox ran past its time", "timeout", h.opts.RunTimeout)
	case <-ctx.Done():
		log.Info("the host is stopping, so is the sandbox")
	}

	stopping, cancelStop := context.WithTimeout(context.WithoutCancel(ctx), stopGrace+10*time.Second)
	defer cancelStop()
	if err := h.engine.Stop(stopping, id, stopGrace); err != nil {
		log.Warn("could not stop the sandbox", "error", err)
	}
	drain()
}

func (h *Host) readied(
	ctx context.Context, image string, handed protocol.Handed, worker Worker, log *slog.Logger,
) (examined, bool) {
	h.mu.Lock()
	each, ok := h.served[image]
	h.mu.Unlock()
	if !ok {
		each = &served{image: image}
	}

	before, _ := h.servedAs(image)
	ready, err := h.examine(ctx, each)
	if ctx.Err() != nil {
		log.Info("the host is stopping, so the work is left to be claimed again")
		return examined{}, false
	}

	reason := ""
	switch {
	case err != nil:
		reason = fmt.Sprintf("The runner image %s could not be pulled: %v", image, err)
	case ready.refused != "":
		reason = fmt.Sprintf("The runner image %s is refused: %s", image, ready.refused)
	case handed.Work.Run != nil && handed.Work.Run.Harness != "" && !ready.holds(handed.Work.Run.Harness):
		reason = fmt.Sprintf("The runner image %s no longer holds %s, which this run needs", ready.digest, handed.Work.Run.Harness)
	}

	if ok && (ready.id != before.id || ready.refused != before.refused) {
		if _, err := h.pool.Present(ctx, h.presence()); err != nil {
			log.Warn("could not report what it serves", "error", err)
		}
	}

	if reason != "" {
		log.Warn("gave up the work it could not start", "reason", reason)
		h.giveUp(ctx, handed, worker, reason, log)
		return examined{}, false
	}

	if run := handed.Work.Run; run != nil {
		if err := worker.RecordImage(ctx, run.ID, ready.digest); err != nil {
			log.Warn("could not record the image the run starts from", "image", ready.digest, "error", err)
		}
	}

	return ready, true
}

func (h *Host) holding(
	ctx context.Context, handed protocol.Handed, worker Worker, log *slog.Logger,
) (release func(), told func() bool) {
	renew := renewal(handed.Work, worker)
	if renew == nil {
		return func() {}, func() bool { return false }
	}

	every := h.opts.LeaseEvery
	if every <= 0 {
		every = leaseEvery
	}

	renewing, stop := context.WithCancel(context.WithoutCancel(ctx))
	done := make(chan struct{})
	var stopped atomic.Bool

	go func() {
		defer close(done)
		ticker := time.NewTicker(every)
		defer ticker.Stop()

		for {
			select {
			case <-renewing.Done():
				return
			case <-ticker.C:
				stop, err := renew(renewing)
				switch {
				case err == nil && stop:
					log.Info("told to stop the work while the sandbox starts")
					stopped.Store(true)
					return
				case err != nil && renewing.Err() == nil:
					log.Warn("could not renew the lease while the sandbox starts", "error", err)
				}
			}
		}
	}()

	release = func() {
		stop()
		<-done
	}

	return release, stopped.Load
}

func renewal(work protocol.Claimed, worker Worker) func(context.Context) (bool, error) {
	switch {
	case work.Run != nil:
		return func(ctx context.Context) (bool, error) {
			// A run asked to stop still starts: only its runner can say it stopped.
			_, err := worker.RenewLease(ctx, work.Run.ID)
			return false, err
		}
	case work.Check != nil:
		return func(ctx context.Context) (bool, error) {
			stop, err := worker.RenewCheckLease(ctx, work.Check.RunID, work.Check.StackID)
			if control.CheckLeaseLost(err) {
				return true, nil
			}
			return stop, err
		}
	}

	return nil
}

func (h *Host) giveUp(ctx context.Context, handed protocol.Handed, worker Worker, reason string, log *slog.Logger) {
	telling, cancel := context.WithTimeout(context.WithoutCancel(ctx), time.Minute)
	defer cancel()

	var err error
	switch work := handed.Work; {
	case work.Run != nil:
		err = worker.Complete(telling, work.Run.ID, protocol.Completion{ExitCode: -1, Failed: true, Message: reason})
	case work.Check != nil:
		err = worker.RecordChangeStackCheck(telling, work.Check.RunID, work.Check.StackID, protocol.StackChecked{
			Skipped: &protocol.SkippedCheck{Code: protocol.SkipNoImage, Detail: reason},
		})
	}
	if err != nil {
		log.Error("could not say why the work did not start", "error", err)
	}
}

func (h *Host) waited(ctx context.Context, id string, log *slog.Logger) int {
	for {
		code, err := h.engine.Wait(ctx, id)
		if err == nil || ctx.Err() != nil {
			return code
		}
		if errors.Is(err, sandbox.ErrGone) {
			log.Warn("the sandbox is gone from the engine", "error", err)
			return code
		}

		log.Warn("lost sight of the sandbox, waiting on it again", "error", err)
		if !sleep(ctx, retryFloor) {
			return code
		}
	}
}

func (h *Host) borrow(ctx context.Context, handed protocol.Handed, log *slog.Logger) []sandbox.Mount {
	if h.mirrors == nil || h.workspace == "" {
		return nil
	}

	runID, repositories := worked(handed.Work)

	budget, cancel := context.WithTimeout(ctx, mirrorWait)
	defer cancel()

	type borrowed struct{ repository, dir string }
	found := make(chan borrowed, len(repositories))
	for _, repository := range repositories {
		go func() {
			dir, _ := h.mirrored(ctx, budget, runID, repository, handed.Token, log)
			found <- borrowed{repository, dir}
		}()
	}

	var mounts []sandbox.Mount
	for range repositories {
		if each := <-found; each.dir != "" {
			mounts = append(mounts, sandbox.Mount{
				Source: each.dir, Target: MirrorRoot + "/" + each.repository + ".git", ReadOnly: true,
			})
		}
	}
	slices.SortFunc(mounts, func(a, b sandbox.Mount) int { return strings.Compare(a.Target, b.Target) })

	return mounts
}

func (h *Host) mirrored(ctx, budget context.Context, runID, repository, token string, log *slog.Logger) (string, bool) {
	remote, err := url.JoinPath(h.opts.ControlURL, "api", "git", runID, repository)
	if err != nil {
		return "", false
	}

	refreshing, cancel := context.WithTimeout(ctx, mirrorLongest)
	refreshed := make(chan string, 1)

	h.refreshes.Go(func() {
		defer cancel()
		dir, err := h.mirrors.Refresh(refreshing, mirror.Fetch{
			Workspace: h.workspace, Repository: repository, Remote: remote, Token: token,
		})
		if err != nil {
			log.Warn("could not bring the mirror up to date", "repository", repository, "error", err)
			close(refreshed)
			return
		}
		refreshed <- dir
	})

	if dir, ok := h.mirrors.Dir(h.workspace, repository); ok {
		return dir, true
	}

	select {
	case dir, ok := <-refreshed:
		return dir, ok
	case <-budget.Done():
		if ctx.Err() == nil {
			log.Info("the first mirror is still cloning, so this run clones on its own", "repository", repository)
		}
	}

	return "", false
}

func worked(work protocol.Claimed) (string, []string) {
	switch {
	case work.Run != nil:
		var repositories []string
		for _, checkout := range work.Run.Spec.Checkouts {
			if checkout.Remote == protocol.ThroughSpotlight {
				repositories = append(repositories, checkout.Path)
			}
		}
		return work.Run.ID, repositories
	case work.Check != nil:
		return work.Check.RunID, []string{work.Check.Repository}
	default:
		return "", nil
	}
}

func (h *Host) destroy(id string) {
	if id == "" {
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), cleanupBudget)
	defer cancel()

	if err := h.engine.Destroy(ctx, id); err != nil {
		h.log.Error("could not destroy a sandbox; the next start destroys it", "sandbox", id, "error", err)
	}
}

func (h *Host) track(runner, id string) {
	h.mu.Lock()
	defer h.mu.Unlock()
	h.running[runner] = id
}

func (h *Host) untrack(runner string) {
	h.mu.Lock()
	defer h.mu.Unlock()
	delete(h.running, runner)
}

func retried(ctx context.Context, log *slog.Logger, failed string, try func() error) error {
	backoff := retryFloor

	for {
		err := try()
		if err == nil || ctx.Err() != nil || final(err) {
			return err
		}

		log.Warn(failed, "error", err, "retryIn", backoff)
		if !sleep(ctx, jitter(backoff)) {
			return ctx.Err()
		}
		backoff = min(backoff*2, retryCeiling)
	}
}

func jitter(d time.Duration) time.Duration {
	return d/2 + time.Duration(rand.Int64N(int64(d)))
}

func sleep(ctx context.Context, d time.Duration) bool {
	timer := time.NewTimer(d)
	defer timer.Stop()

	select {
	case <-timer.C:
		return true
	case <-ctx.Done():
		return false
	}
}
