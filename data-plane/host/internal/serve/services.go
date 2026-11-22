package serve

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"strings"
	"sync"
	"time"

	"usespotlight.ai/data-plane/host/internal/sandbox"
	"usespotlight.ai/data-plane/protocol"
)

const (
	// serviceWait bounds how long the services of one run take to pull, start and become ready.
	serviceWait = 5 * time.Minute
	// servicePoll is how often the host looks whether a starting service is ready.
	servicePoll       = 500 * time.Millisecond
	serviceLogLines   = 15
	serviceLogTimeout = 5 * time.Second
)

// services starts the services of one run at a time on a sandbox's network. Starting the next run's stops the
// last run's first, so each run gets services of its own with nothing left over. The next turn of the same run
// keeps them, with what the run left in them.
type services struct {
	mu     sync.Mutex
	cancel context.CancelFunc
	done   chan struct{}
	run    string
}

// start stops the last run's services, then starts the run's in the background and leaves their outcome in the
// sandbox at protocol.ServicesPath. Services already there for the same run stay, as their outcome does.
func (s *egressSidecar) startServices(ctx context.Context, sandboxID string, run *protocol.Run, log *slog.Logger) {
	set := &s.services
	set.mu.Lock()
	defer set.mu.Unlock()

	if run != nil && len(run.Spec.Services) > 0 && s.servesRunLocked(ctx, run.ID) {
		log.Info("kept the services of the run for its next turn", "run", run.ID)
		return
	}

	set.stopLocked()
	set.run = ""
	s.destroyServices(ctx)
	if run == nil || len(run.Spec.Services) == 0 || s.network == "" {
		return
	}

	starting, cancel := context.WithTimeout(context.WithoutCancel(ctx), serviceWait)
	done := make(chan struct{})
	set.cancel, set.done, set.run = cancel, done, run.ID

	go func() {
		defer close(done)
		defer cancel()

		outcomes := s.runServices(starting, run.ID, run.Spec.Services, log)
		body, err := json.Marshal(protocol.ServicesStarted{Run: run.ID, Services: outcomes})
		if err != nil {
			return
		}
		if starting.Err() != nil && errors.Is(context.Cause(starting), context.Canceled) {
			return
		}

		putting, cancelPut := context.WithTimeout(context.WithoutCancel(ctx), cleanupBudget)
		defer cancelPut()
		if err := s.host.engine.Put(putting, sandboxID, sandbox.File{Path: protocol.ServicesPath, Mode: 0o444, Body: body}); err != nil {
			log.Warn("could not tell the sandbox how its services started", "error", err)
		}
	}()
}

// servesRunLocked says whether the services on the sandbox's network were started for run: by this host, or by the
// host it took over from, which labelled them.
func (s *egressSidecar) servesRunLocked(ctx context.Context, run string) bool {
	if s.services.run != "" {
		return s.services.run == run
	}
	running, err := s.host.engine.Labelled(ctx, LabelService, s.name)
	if err != nil || len(running) == 0 {
		return false
	}
	for _, each := range running {
		if each.Labels[LabelServiceRun] != run {
			return false
		}
	}
	s.services.run = run
	return true
}

func (s *services) stopLocked() {
	if s.cancel == nil {
		return
	}
	s.cancel()
	<-s.done
	s.cancel, s.done = nil, nil
}

// stopServices stops starting services and destroys the ones that run, when the sandbox ends.
func (s *egressSidecar) stopServices() {
	set := &s.services
	set.mu.Lock()
	defer set.mu.Unlock()

	set.stopLocked()
	set.run = ""
	ctx, cancel := context.WithTimeout(context.Background(), cleanupBudget)
	defer cancel()
	s.destroyServices(ctx)
}

func (s *egressSidecar) destroyServices(ctx context.Context) {
	if s.name == "" {
		return
	}
	running, err := s.host.engine.Labelled(ctx, LabelService, s.name)
	if err != nil {
		s.host.log.Warn("could not look for the services of a sandbox; the next sweep destroys them", "egress", s.name, "error", err)
		return
	}
	for _, each := range running {
		if err := s.host.engine.Destroy(ctx, each.ID); err != nil {
			s.host.log.Warn("could not destroy a service of a sandbox; the next sweep destroys it", "service", each.ID, "error", err)
		}
	}
}

type serviceStart struct {
	settled chan struct{}
	outcome protocol.ServiceOutcome
}

// runServices starts each service once the services it depends on are ready, and waits for every one to be ready
// or to fail.
func (s *egressSidecar) runServices(
	ctx context.Context, run string, wanted []protocol.Service, log *slog.Logger,
) []protocol.ServiceOutcome {
	starts := make(map[string]*serviceStart, len(wanted))
	for _, service := range wanted {
		starts[service.Name] = &serviceStart{
			settled: make(chan struct{}),
			outcome: protocol.ServiceOutcome{Name: service.Name, From: service.From},
		}
	}

	var all sync.WaitGroup
	for _, service := range wanted {
		started := starts[service.Name]
		all.Go(func() {
			defer close(started.settled)
			for _, name := range service.DependsOn {
				dependency, ok := starts[name]
				if !ok {
					continue
				}
				select {
				case <-dependency.settled:
				case <-ctx.Done():
					started.outcome.Problem = "it did not start in time"
					return
				}
				if !dependency.outcome.Ready {
					started.outcome.Problem = fmt.Sprintf("%s, which it depends on, did not start", name)
					return
				}
			}

			if err := s.runService(ctx, run, service); err != nil {
				started.outcome.Problem = err.Error()
				log.Warn("a service of the run did not start", "service", service.Name, "image", service.Image, "error", err)
				return
			}
			started.outcome.Ready = true
		})
	}
	all.Wait()

	outcomes := make([]protocol.ServiceOutcome, 0, len(wanted))
	for _, service := range wanted {
		outcomes = append(outcomes, starts[service.Name].outcome)
	}
	return outcomes
}

func (s *egressSidecar) runService(ctx context.Context, run string, service protocol.Service) error {
	engine := s.host.engine

	if _, err := engine.Inspect(ctx, service.Image); errors.Is(err, sandbox.ErrNoImage) {
		if err := engine.Pull(ctx, service.Image, ""); err != nil {
			return fmt.Errorf("its image %s could not be pulled: %w", service.Image, err)
		}
	} else if err != nil {
		return fmt.Errorf("its image %s could not be read: %w", service.Image, err)
	}

	env := make([]string, 0, len(service.Env))
	for _, each := range service.Env {
		env = append(env, each.Name+"="+each.Value)
	}

	id, err := engine.Start(ctx, sandbox.Spec{
		Name:    "spotlight-" + s.name + "-" + service.Name,
		Image:   service.Image,
		Args:    service.Command,
		Env:     env,
		Labels:  map[string]string{LabelHost: s.host.opts.HostID, LabelService: s.name, LabelServiceRun: run},
		Network: s.network,
		Aliases: []string{service.Name},
		Health:  healthOf(service.Health),
	})
	if err != nil {
		if id != "" {
			s.host.destroy(id)
		}
		return fmt.Errorf("it could not start: %w", err)
	}

	return s.ready(ctx, id)
}

func healthOf(health *protocol.ServiceHealth) *sandbox.Health {
	if health == nil {
		return nil
	}
	return &sandbox.Health{
		Test:        health.Test,
		Interval:    time.Duration(health.IntervalMs) * time.Millisecond,
		Timeout:     time.Duration(health.TimeoutMs) * time.Millisecond,
		StartPeriod: time.Duration(health.StartPeriodMs) * time.Millisecond,
		Retries:     health.Retries,
	}
}

// ready waits until the service passes its health check, or runs where it has none.
func (s *egressSidecar) ready(ctx context.Context, id string) error {
	poll := time.NewTicker(servicePoll)
	defer poll.Stop()

	for {
		state, err := s.host.engine.State(ctx, id)
		switch {
		case err != nil && ctx.Err() == nil:
			return fmt.Errorf("its state could not be read: %w", err)
		case err != nil:
		case !state.Running:
			return fmt.Errorf("it exited with code %d%s", state.ExitCode, s.lastLogs(id))
		case state.Health == sandbox.HealthHealthy, state.Health == sandbox.HealthNone:
			return nil
		case state.Health == sandbox.HealthUnhealthy:
			return fmt.Errorf("its health check failed%s", s.lastLogs(id))
		}

		select {
		case <-ctx.Done():
			return fmt.Errorf("it was not ready within %s", serviceWait)
		case <-poll.C:
		}
	}
}

func (s *egressSidecar) lastLogs(id string) string {
	ctx, cancel := context.WithTimeout(context.Background(), serviceLogTimeout)
	defer cancel()

	var logs bytes.Buffer
	_ = s.host.engine.Follow(ctx, id, time.Time{}, &logs)
	lines := strings.Split(strings.TrimSpace(logs.String()), "\n")
	if len(lines) > serviceLogLines {
		lines = lines[len(lines)-serviceLogLines:]
	}
	if last := strings.TrimSpace(strings.Join(lines, "\n")); last != "" {
		return ". Its last output:\n" + last
	}
	return ""
}
