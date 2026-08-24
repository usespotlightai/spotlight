package session

import (
	"context"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"os"
	"path/filepath"
	"sync/atomic"
	"time"

	"usespotlight.ai/runner/internal/hook"
	"usespotlight.ai/runner/internal/protocol"
	"usespotlight.ai/runner/internal/terminal"
	"usespotlight.ai/runner/internal/workspace"
)

// Journal is the part of the control plane a run talks to. Declared here
// rather than in the client so this package can be exercised without one.
type Journal interface {
	AppendEvents(ctx context.Context, runID string, events []protocol.Event) error
	RenewLease(ctx context.Context, runID string) error
	Complete(ctx context.Context, runID string, done protocol.Completion) error
}

type InputSource interface {
	AwaitInput(ctx context.Context, runID string) ([]protocol.Input, error)
}

const (
	// flushEvery coalesces terminal output. Per-read events would be a
	// request per keystroke echoed.
	flushEvery = 200 * time.Millisecond
	// renewEvery keeps the lease alive well inside its expiry.
	renewEvery        = 15 * time.Second
	readBuffer        = 32 * 1024
	inputRetryFloor   = 1 * time.Second
	inputRetryCeiling = 20 * time.Second
)

type Options struct {
	WorkspaceRoot string
	Journal       Journal
	Log           *slog.Logger
	// PrepareHook fills the workspace; PublishHook does something with the
	// result. Both run as the runner, never as the agent, so whatever
	// credentials they need never coexist with model-directed code.
	PrepareHook string
	PublishHook string
	HookTimeout time.Duration
	// AgentUser is the account to run the agent as. Nil runs it as the runner,
	// which is what a laptop does.
	AgentUser *terminal.User
	Input     InputSource
}

// Execute takes a claimed run from an empty directory to a reported outcome.
// It always removes the workspace and always reports something, whether the
// agent succeeded, failed, or the runner was told to stop.
func Execute(ctx context.Context, run protocol.Run, opts Options) error {
	log := opts.Log.With("run", run.ID)
	journal := &journalWriter{runID: run.ID, journal: opts.Journal}

	lifecycle := &progress{state: Preparing}

	space, err := workspace.Create(opts.WorkspaceRoot, run.ID)
	if err != nil {
		return finish(ctx, run.ID, journal, lifecycle, opts.Journal, log, fmt.Errorf("create workspace: %w", err))
	}
	defer func() {
		if err := space.Remove(); err != nil {
			log.Warn("could not remove workspace", "error", err)
		}
	}()

	// Before the handover, so whatever the hook authenticates with is gone by
	// the time the agent can look.
	if err := opts.runHook(ctx, opts.PrepareHook, space.Dir, run, journal, log, "prepare"); err != nil {
		return finish(ctx, run.ID, journal, lifecycle, opts.Journal, log, err)
	}

	cwd, err := space.Resolve(run.Spec.Cwd)
	if err != nil {
		return finish(ctx, run.ID, journal, lifecycle, opts.Journal, log, err)
	}

	if opts.AgentUser != nil {
		if err := space.GiveTo(opts.AgentUser.UID, opts.AgentUser.GID); err != nil {
			return finish(ctx, run.ID, journal, lifecycle, opts.Journal, log, fmt.Errorf("hand over workspace: %w", err))
		}
	}

	if err := lifecycle.reach(WorkspaceReady); err != nil {
		return finish(ctx, run.ID, journal, lifecycle, opts.Journal, log, err)
	}
	journal.record(ctx, protocol.Event{Type: protocol.EventWorkspaceReady, Message: space.Dir})

	// Beside the workspace rather than inside it: the agent owns its tree and
	// must not be able to edit the record of what it did. It is a live replay
	// buffer, not an archive — the journal holds the same bytes — so it goes
	// when the run does.
	recording := filepath.Join(opts.WorkspaceRoot, ".recordings", run.ID)
	defer func() {
		if err := os.Remove(recording); err != nil && !os.IsNotExist(err) {
			log.Warn("could not remove recording", "error", err)
		}
	}()

	agent, err := terminal.Start(ctx, terminal.Spec{
		Command:   run.Spec.Command,
		Dir:       cwd,
		Recording: recording,
		Size:      terminal.DefaultSize,
		RunAs:     opts.AgentUser,
	})
	if err != nil {
		return finish(ctx, run.ID, journal, lifecycle, opts.Journal, log, fmt.Errorf("start agent: %w", err))
	}
	defer agent.Close()

	if err := lifecycle.reach(AgentStarted); err != nil {
		return finish(ctx, run.ID, journal, lifecycle, opts.Journal, log, err)
	}
	log.Info("agent started", "executable", run.Spec.Command.Executable, "cwd", cwd)

	exitCode, stopped := pump(ctx, agent, journal, run.ID, opts.Journal, log, opts.Input)

	if err := lifecycle.reach(AgentExited); err != nil {
		return finish(ctx, run.ID, journal, lifecycle, opts.Journal, log, err)
	}

	// After the agent has exited, so push credentials never overlap with it.
	if err := opts.runHook(ctx, opts.PublishHook, space.Dir, run, journal, log, "publish"); err != nil {
		journal.flush(ctx)
		if completeErr := opts.Journal.Complete(ctx, run.ID, protocol.Completion{
			ExitCode: exitCode,
			Failed:   true,
			Message:  err.Error(),
		}); completeErr != nil {
			log.Warn("could not report the failure", "error", completeErr)
		}
		return err
	}

	journal.flush(ctx)
	if err := lifecycle.reach(Drained); err != nil {
		return finish(ctx, run.ID, journal, lifecycle, opts.Journal, log, err)
	}

	log.Info("run finished", "state", lifecycle.state, "exitCode", exitCode, "stopped", stopped)

	if stopped {
		return opts.Journal.Complete(ctx, run.ID, protocol.Completion{
			ExitCode: exitCode,
			Failed:   false,
			Message:  "stopped from the console",
		})
	}

	return opts.Journal.Complete(ctx, run.ID, protocol.Completion{
		ExitCode: exitCode,
		Failed:   exitCode != 0,
	})
}

func pump(
	ctx context.Context,
	agent *terminal.Session,
	journal *journalWriter,
	runID string,
	lease Journal,
	log *slog.Logger,
	input InputSource,
) (int, bool) {
	chunks := make(chan terminal.Chunk)
	done := make(chan int, 1)

	var stopped atomic.Bool

	if input != nil {
		collecting, stop := context.WithCancel(ctx)
		defer stop()
		go collect(collecting, input, agent, runID, log, &stopped)
	}

	go func() {
		defer close(chunks)
		buffer := make([]byte, readBuffer)
		for {
			chunk, err := agent.Read(buffer)
			if len(chunk.Data) > 0 {
				// Copied: the buffer is reused on the next read.
				chunks <- terminal.Chunk{
					Data:   append([]byte(nil), chunk.Data...),
					Offset: chunk.Offset,
				}
			}
			if err != nil {
				if !errors.Is(err, io.EOF) {
					log.Warn("terminal read failed", "error", err)
				}
				return
			}
		}
	}()

	go func() { done <- agent.Wait() }()

	flush := time.NewTicker(flushEvery)
	defer flush.Stop()
	renew := time.NewTicker(renewEvery)
	defer renew.Stop()

	exitCode := -1
	for {
		select {
		case chunk, open := <-chunks:
			if !open {
				chunks = nil
				continue
			}
			journal.append(protocol.Event{
				Type:   protocol.EventOutput,
				Data:   chunk.Data,
				Offset: chunk.Offset,
			})

		case <-flush.C:
			journal.flush(ctx)

		case <-renew.C:
			if err := lease.RenewLease(ctx, runID); err != nil {
				log.Warn("could not renew lease", "error", err)
			}

		case exitCode = <-done:
			journal.flush(ctx)
			return exitCode, stopped.Load()

		case <-ctx.Done():
			// The agent dies with the context; wait for its code rather than
			// guessing one, so the journal says what actually happened.
			log.Info("stopping the agent")
			return <-done, stopped.Load()
		}
	}
}

func collect(
	ctx context.Context,
	source InputSource,
	agent *terminal.Session,
	runID string,
	log *slog.Logger,
	stopped *atomic.Bool,
) {
	backoff := inputRetryFloor

	for {
		if ctx.Err() != nil {
			return
		}

		pending, err := source.AwaitInput(ctx, runID)
		if err != nil {
			if ctx.Err() != nil {
				return
			}

			log.Warn("could not collect input", "error", err, "retryIn", backoff)
			timer := time.NewTimer(backoff)
			select {
			case <-timer.C:
			case <-ctx.Done():
				timer.Stop()
				return
			}
			backoff = min(backoff*2, inputRetryCeiling)
			continue
		}

		backoff = inputRetryFloor

		for _, typed := range pending {
			if typed.Stop {
				stopped.Store(true)
				log.Info("stopping the agent on request")

				if err := agent.Stop(); err != nil {
					log.Warn("could not stop the agent", "error", err)
				}
				return
			}

			if typed.Cols > 0 && typed.Rows > 0 {
				if err := agent.Resize(terminal.Size{Cols: typed.Cols, Rows: typed.Rows}); err != nil {
					log.Warn("could not resize the terminal", "error", err)
				}
			}

			if len(typed.Data) > 0 {
				if err := agent.Write(typed.Data); err != nil {
					log.Warn("could not write to the terminal", "error", err)
					return
				}
			}
		}
	}
}

// finish reports a run that never got as far as an agent. Saying so matters:
// staying quiet leaves the run claimed until its lease lapses, and a failure
// that will happen again — a missing repository, an unreachable forge — is
// then retried forever instead of once.
func finish(
	ctx context.Context,
	runID string,
	journal *journalWriter,
	lifecycle *progress,
	reporter Journal,
	log *slog.Logger,
	cause error,
) error {
	if err := lifecycle.reach(WentWrong); err != nil {
		log.Warn("could not mark the run failed", "error", err)
	}

	journal.append(protocol.Event{
		Type:    protocol.EventFailed,
		Message: cause.Error(),
	})
	journal.flush(ctx)

	if err := reporter.Complete(ctx, runID, protocol.Completion{
		ExitCode: -1,
		Failed:   true,
		Message:  cause.Error(),
	}); err != nil {
		log.Warn("could not report the failure", "error", err)
	}

	return cause
}

// progress is a run's state and the only way to change it. Advancing goes
// through Next, so an illegal step is refused rather than discarded: if the
// code gets there, the run's real state is unknown and continuing would be
// guesswork. Failing instead lets the lease expire and the run be claimed
// again from a known start.
type progress struct {
	state State
}

func (p *progress) reach(trigger Trigger) error {
	next, err := Next(p.state, trigger)
	if err != nil {
		return err
	}
	p.state = next
	return nil
}

// runHook runs one of the deployment's hooks, journals whatever it wrote, and
// treats a non-zero exit as the run failing. A checkout that did not happen
// and a branch that was never pushed are both worse than a run that stops.
func (o Options) runHook(
	ctx context.Context,
	path, dir string,
	run protocol.Run,
	journal *journalWriter,
	log *slog.Logger,
	name string,
) error {
	output, err := hook.Run(ctx, hook.Spec{
		Path:    path,
		Dir:     dir,
		Payload: run.Spec,
		Env: map[string]string{
			"SPOTLIGHT_RUN_ID":        run.ID,
			"SPOTLIGHT_WORKSPACE_DIR": dir,
		},
		Timeout: o.HookTimeout,
	})

	if errors.Is(err, hook.ErrNoHook) {
		return nil
	}

	if output != "" {
		journal.append(protocol.Event{
			Type:    protocol.EventOutput,
			Message: name,
			Data:    []byte(output),
		})
	}

	if err != nil {
		return fmt.Errorf("%s hook: %w", name, err)
	}

	log.Info("hook finished", "hook", name)
	return nil
}

// journalWriter numbers events and batches them, so a run's output arrives in
// order and a reader that reconnects can tell what it missed.
type journalWriter struct {
	runID   string
	journal Journal
	seq     int
	pending []protocol.Event
}

func (j *journalWriter) append(event protocol.Event) {
	j.seq++
	event.Seq = j.seq
	event.At = time.Now().UTC()
	j.pending = append(j.pending, event)
}

func (j *journalWriter) record(ctx context.Context, event protocol.Event) {
	j.append(event)
	j.flush(ctx)
}

func (j *journalWriter) flush(ctx context.Context) {
	if len(j.pending) == 0 {
		return
	}

	batch := j.pending
	j.pending = nil

	// A journal the control plane rejected is lost, not retried: the run
	// itself matters more than its narration, and the recording on disk keeps
	// the full picture either way.
	if err := j.journal.AppendEvents(ctx, j.runID, batch); err != nil {
		slog.Warn("could not append events", "run", j.runID, "count", len(batch), "error", err)
	}
}
