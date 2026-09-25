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
	"time"

	"usespotlight.ai/data-plane/host/internal/executor"
	"usespotlight.ai/data-plane/host/internal/mirror"
	"usespotlight.ai/data-plane/internal/control"
	"usespotlight.ai/data-plane/internal/protocol"
)

const (
	LabelHost   = "ai.usespotlight.host"
	LabelRunner = "ai.usespotlight.runner"

	HandedPath = "/run/spotlight/handed.json"
	MirrorRoot = "/spotlight/mirrors"

	presenceEvery = 20 * time.Second
	stopGrace     = 30 * time.Second
	mirrorWait    = 15 * time.Second
	quickAnswer   = 2 * time.Second
	drainBudget   = 5 * time.Second
	mirrorLongest = 30 * time.Minute
	probeLongest  = 2 * time.Minute
	cleanupBudget = time.Minute
	retryFloor    = 2 * time.Second
	retryCeiling  = 30 * time.Second
)

type Pool interface {
	Harnesses(ctx context.Context) ([]protocol.Installable, error)
	Claim(ctx context.Context, harnesses []protocol.HarnessReport) (*protocol.Handed, error)
	Present(ctx context.Context, presence protocol.HostPresence) (protocol.HostStanding, error)
	Leave(ctx context.Context) error
}

type Options struct {
	HostID     string
	Name       string
	Version    string
	Images     []string
	Capacity   int
	RunTimeout time.Duration
	ControlURL string
	SandboxURL string
	SandboxEnv []string
	Network    string
	ExtraHosts []string
}

type Host struct {
	opts    Options
	pool    Pool
	engine  executor.Executor
	mirrors *mirror.Mirrors
	log     *slog.Logger

	slots     chan struct{}
	sandboxes sync.WaitGroup
	refreshes sync.WaitGroup
	workspace string
	engineIs  string
	offered   []protocol.HarnessReport

	mu       sync.Mutex
	running  map[string]string
	held     map[string]time.Time
	failures map[string]int
}

func New(opts Options, pool Pool, engine executor.Executor, mirrors *mirror.Mirrors, log *slog.Logger) *Host {
	return &Host{
		opts:     opts,
		pool:     pool,
		engine:   engine,
		mirrors:  mirrors,
		log:      log,
		slots:    make(chan struct{}, max(opts.Capacity, 1)),
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

	offers, err := h.probe(ctx)
	if err != nil {
		return quiet(ctx, err)
	}
	h.offer(offers)
	if _, err := h.pool.Present(ctx, h.presence()); err != nil {
		h.log.Warn("could not report what it offers", "error", err)
	}

	h.log.Info("serving", "name", h.opts.Name, "capacity", cap(h.slots), "images", h.opts.Images)

	var claims sync.WaitGroup
	for _, image := range h.opts.Images {
		claims.Go(func() {
			if err := h.claim(claiming, ctx, image, offers[image]); err != nil {
				stop(err)
			}
		})
	}

	claims.Wait()
	h.sandboxes.Wait()
	h.refreshes.Wait()
	stopClaiming()
	reporting.Wait()

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
}

func (h *Host) probe(ctx context.Context) (map[string][]protocol.HarnessReport, error) {
	var candidates []protocol.Installable
	if err := retried(ctx, h.log, "could not ask what harnesses to look for, still trying", func() (err error) {
		candidates, err = h.pool.Harnesses(ctx)
		return err
	}); err != nil {
		return nil, err
	}

	offers := map[string][]protocol.HarnessReport{}
	for _, image := range h.opts.Images {
		if err := h.engine.Ensure(ctx, image); err != nil {
			return nil, err
		}

		found, err := h.found(ctx, image, candidates)
		if err != nil {
			return nil, fmt.Errorf("look for harnesses in %s: %w", image, err)
		}

		offers[image] = found
		h.log.Info("found harnesses in the runner image", "image", image, "harnesses", found)
	}

	return offers, nil
}

func (h *Host) found(ctx context.Context, image string, candidates []protocol.Installable) ([]protocol.HarnessReport, error) {
	asked, err := json.Marshal(candidates)
	if err != nil {
		return nil, err
	}

	ctx, cancel := context.WithTimeout(ctx, probeLongest)
	defer cancel()

	id, err := h.engine.Start(ctx, executor.Sandbox{
		Image:  image,
		Args:   []string{"harnesses", string(asked)},
		Env:    h.opts.SandboxEnv,
		Labels: map[string]string{LabelHost: h.opts.HostID},
	})
	defer h.destroy(id)
	if err != nil {
		return nil, err
	}

	code, err := h.engine.Wait(ctx, id)
	if err != nil {
		return nil, err
	}
	if code != 0 {
		return nil, fmt.Errorf("the runner image answered with exit %d", code)
	}

	var said lines
	if err := h.engine.Follow(ctx, id, &said); err != nil {
		return nil, err
	}

	var reported protocol.Registration
	if err := json.Unmarshal([]byte(said.last()), &reported); err != nil {
		return nil, fmt.Errorf("read what the runner image has: %w", err)
	}

	return reported.Harnesses, nil
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
	offered := h.offered
	h.mu.Unlock()
	slices.Sort(running)

	return protocol.HostPresence{
		Name:      h.opts.Name,
		Release:   h.opts.Version,
		Executor:  h.engineIs,
		Capacity:  cap(h.slots),
		Running:   running,
		Harnesses: offered,
	}
}

func (h *Host) offer(offers map[string][]protocol.HarnessReport) {
	h.mu.Lock()
	defer h.mu.Unlock()

	h.offered = nil
	for _, image := range h.opts.Images {
		for _, report := range offers[image] {
			if !slices.ContainsFunc(h.offered, func(held protocol.HarnessReport) bool {
				return held.ID == report.ID && held.Version == report.Version
			}) {
				h.offered = append(h.offered, report)
			}
		}
	}
}

func (h *Host) claim(ctx, serving context.Context, image string, offer []protocol.HarnessReport) error {
	backoff := retryFloor

	for {
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
		handed, err := h.pool.Claim(ctx, offer)
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

	body, err := json.Marshal(handed)
	if err != nil {
		log.Error("could not hand over the work", "error", err)
		return
	}

	mounts := h.borrow(ctx, handed, log)
	if ctx.Err() != nil {
		log.Info("the host is stopping, so the work is left to be claimed again")
		return
	}

	env := append(slices.Clone(h.opts.SandboxEnv),
		"SPOTLIGHT_URL="+h.opts.SandboxURL,
		"SPOTLIGHT_HANDED="+HandedPath,
	)
	if len(mounts) > 0 {
		env = append(env, "SPOTLIGHT_MIRRORS="+MirrorRoot)
	}

	starting, cancel := context.WithTimeout(context.WithoutCancel(ctx), 5*time.Minute)
	defer cancel()

	id, err := h.engine.Start(starting, executor.Sandbox{
		Name:       "spotlight-" + handed.RunnerID,
		Image:      image,
		Env:        env,
		Labels:     map[string]string{LabelHost: h.opts.HostID, LabelRunner: handed.RunnerID},
		Mounts:     mounts,
		Files:      []executor.File{{Path: HandedPath, Mode: 0o400, Body: body}},
		Network:    h.opts.Network,
		ExtraHosts: h.opts.ExtraHosts,
	})
	defer h.destroy(id)
	h.started(image, err == nil)
	if err != nil {
		log.Error("could not start a sandbox; claiming from this image pauses", "error", err)
		if err := h.engine.Ensure(starting, image); err != nil {
			log.Error("the runner image is not there to start", "image", image, "error", err)
		}
		return
	}

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

func (h *Host) waited(ctx context.Context, id string, log *slog.Logger) int {
	for {
		code, err := h.engine.Wait(ctx, id)
		if err == nil || ctx.Err() != nil {
			return code
		}
		if errors.Is(err, executor.ErrGone) {
			log.Warn("the sandbox is gone from the engine", "error", err)
			return code
		}

		log.Warn("lost sight of the sandbox, waiting on it again", "error", err)
		if !sleep(ctx, retryFloor) {
			return code
		}
	}
}

func (h *Host) borrow(ctx context.Context, handed protocol.Handed, log *slog.Logger) []executor.Mount {
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

	var mounts []executor.Mount
	for range repositories {
		if each := <-found; each.dir != "" {
			mounts = append(mounts, executor.Mount{
				Source: each.dir, Target: MirrorRoot + "/" + each.repository + ".git", ReadOnly: true,
			})
		}
	}
	slices.SortFunc(mounts, func(a, b executor.Mount) int { return strings.Compare(a.Target, b.Target) })

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
