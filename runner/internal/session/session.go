package session

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"os"
	"strings"
	"time"

	"usespotlight.ai/runner/internal/account"
	"usespotlight.ai/runner/internal/acp"
	"usespotlight.ai/runner/internal/declare"
	"usespotlight.ai/runner/internal/hook"
	"usespotlight.ai/runner/internal/protocol"
	"usespotlight.ai/runner/internal/workspace"
)

// Journal is the part of the control plane a run talks to. Declared here, not
// in the client, so this package can be tested without one.
type Journal interface {
	AppendEvents(ctx context.Context, runID string, events []protocol.Event) error
	RenewLease(ctx context.Context, runID string) error
	Complete(ctx context.Context, runID string, done protocol.Completion) error
	Said(ctx context.Context, runID string) ([]protocol.Said, error)
	Delivered(ctx context.Context, runID string, upTo int) error
}

const (
	// flushEvery coalesces terminal output. Per-read events would mean a
	// request per echoed keystroke.
	flushEvery = 200 * time.Millisecond
	// renewEvery keeps the lease alive well inside its expiry.
	renewEvery = 15 * time.Second
	readBuffer = 32 * 1024
	// drainFor bounds the wait for output still in flight when the agent
	// exits. It is generous: the reader is spent the moment the terminal is.
	drainFor = 2 * time.Second
	// settleFor is how long an agent is left alone after handing the task
	// over, so its closing words are its own and not cut off.
	settleFor         = 5 * time.Second
	inputRetryFloor   = 1 * time.Second
	inputRetryCeiling = 20 * time.Second
)

type Options struct {
	WorkspaceRoot string
	Journal       Journal
	Log           *slog.Logger
	// PrepareHook fills the workspace; PublishHook does something with the
	// result. Both run as the runner, never as the agent, so their credentials
	// never coexist with model-directed code.
	PrepareHook string
	PublishHook string
	HookTimeout time.Duration
	// AgentUser is the account to run the agent as. Nil runs it as the
	// runner.
	AgentUser *account.User
}

// Execute takes a claimed run from an empty directory to a reported outcome.
// It always removes the workspace and always reports something.
func Execute(ctx context.Context, run protocol.Run, opts Options) error {
	log := opts.Log.With("run", run.ID)
	journal := &journalWriter{runID: run.ID, journal: opts.Journal}

	lifecycle := &progress{state: Preparing}

	// Sharing a directory is asked for, so a station that wants a clean one
	// keeps getting it without saying so.
	key := run.Spec.Continuity.Key
	if key == "" {
		key = run.ID
	}

	space, err := workspace.Create(opts.WorkspaceRoot, key)
	if err != nil {
		return finish(ctx, run.ID, journal, lifecycle, opts.Journal, log, fmt.Errorf("create workspace: %w", err))
	}
	defer func() {
		if run.Spec.Continuity.Keep {
			log.Info("workspace kept", "dir", space.Dir)
			return
		}
		if err := space.Remove(); err != nil {
			log.Warn("could not remove workspace", "error", err)
		}
	}()

	// Before the handover, so the hook's credentials are gone by the time the
	// agent can look.
	if err := opts.runHook(ctx, opts.PrepareHook, space.Dir, run, journal, log, "prepare"); err != nil {
		return finish(ctx, run.ID, journal, lifecycle, opts.Journal, log, err)
	}

	cwd, err := space.Resolve(run.Spec.Cwd)
	if err != nil {
		return finish(ctx, run.ID, journal, lifecycle, opts.Journal, log, err)
	}

	// Before the handover, so the agent owns this along with the rest of the
	// workspace and the harness can write its own state into it.
	state, err := space.State()
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

	// Raised before the agent so the endpoint is there from its first breath,
	// and closed after it so nothing can speak for a run that has ended.
	channel, err := declare.Serve(run.Spec.Handover.Options)
	if err != nil {
		return finish(ctx, run.ID, journal, lifecycle, opts.Journal, log, err)
	}
	defer channel.Close()

	harness, err := acp.Start(ctx, acp.Options{
		Executable: run.Spec.Command.Executable,
		Args:       run.Spec.Command.Args,
		Env:        granted(run.Spec.Command.Env, channel, state),
		Root:       cwd,
		RunAs:      opts.AgentUser,
		// A station is worked with nobody watching, so the runner answers for
		// itself. What keeps it in bounds is where it runs, not what it is
		// allowed to do: its own account, its own workspace.
		Answer: func(string) bool { return true },
	})
	if err != nil {
		return finish(ctx, run.ID, journal, lifecycle, opts.Journal, log, fmt.Errorf("start agent: %w", err))
	}
	defer harness.Close()

	if err := lifecycle.reach(AgentStarted); err != nil {
		return finish(ctx, run.ID, journal, lifecycle, opts.Journal, log, err)
	}
	log.Info("agent started", "executable", run.Spec.Command.Executable, "cwd", cwd)

	sessionID, err := open(ctx, harness, run.Spec.Continuity.SessionID, log)
	if err != nil {
		return finish(ctx, run.ID, journal, lifecycle, opts.Journal, log, err)
	}

	exitCode, stopped := work(ctx, harness, sessionID, run, journal, opts.Journal, log)

	if err := lifecycle.reach(AgentExited); err != nil {
		return finish(ctx, run.ID, journal, lifecycle, opts.Journal, log, err)
	}

	// Read before the publish hook, so a hook that fails still carries what the
	// agent said should happen to the task. What it said through the endpoint
	// stands over what it left in the workspace: the file asks nothing of the
	// agent but a write, so it stays for agents that can manage no more.
	declared := channel.Declared()
	if declared == nil {
		declared = space.Outcome()
	}

	// After the agent has exited, so push credentials never overlap with it.
	if err := opts.runHook(ctx, opts.PublishHook, space.Dir, run, journal, log, "publish"); err != nil {
		journal.flush(ctx)
		if completeErr := opts.Journal.Complete(ctx, run.ID, protocol.Completion{
			ExitCode:  exitCode,
			Failed:    true,
			Message:   err.Error(),
			Outcome:   declared,
			SessionID: sessionID,
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
			ExitCode:  exitCode,
			Failed:    false,
			Message:   "stopped from the console",
			Outcome:   declared,
			SessionID: sessionID,
		})
	}

	return opts.Journal.Complete(ctx, run.ID, protocol.Completion{
		ExitCode:  exitCode,
		Failed:    exitCode != 0,
		Outcome:   declared,
		SessionID: sessionID,
	})
}

// open takes up the conversation an earlier run left, or starts one. A session
// the harness no longer holds is not a failed run: the briefing still says what
// the work is, so it is done in a fresh one. Any other refusal is an error.
func open(ctx context.Context, harness *acp.Client, previous string, log *slog.Logger) (string, error) {
	if previous != "" {
		err := harness.Resume(ctx, previous)
		if err == nil {
			log.Info("resumed", "session", previous)
			return previous, nil
		}
		if !acp.Forgotten(err) {
			return "", fmt.Errorf("resume the session: %w", err)
		}
		log.Warn("the harness no longer holds that session", "session", previous)
	}

	sessionID, err := harness.NewSession(ctx)
	if err != nil {
		return "", fmt.Errorf("open a session: %w", err)
	}

	return sessionID, nil
}

// drain takes what the reader is still holding once the agent has gone. Its
// last words are written as it exits, so leaving them in flight loses exactly
// the part worth reading. The deadline stops a terminal that never ends from
/*
work sends the briefing and reports what the agent says while it works.

A turn ends when the agent stops. Anything a person typed at it while it worked
is given to it then, as another turn in the same session, so the run only ends
once nobody has anything left to add.
*/
func work(
	ctx context.Context,
	harness *acp.Client,
	sessionID string,
	run protocol.Run,
	journal *journalWriter,
	lease Journal,
	log *slog.Logger,
) (int, bool) {
	renewing, stopRenewing := context.WithCancel(ctx)
	defer stopRenewing()
	go renew(renewing, lease, run.ID, log)

	prompt := run.Spec.Briefing

	for {
		result, err := harness.Prompt(ctx, sessionID, prompt, func(update acp.Update) {
			journal.append(protocol.Event{
				Type: protocol.EventOutput,
				Data: update.Raw,
			})
		})

		journal.flush(ctx)

		if err != nil {
			log.Warn("the agent stopped short", "error", err)
			return -1, false
		}

		log.Info("turn finished", "stopReason", result.StopReason)

		// Refused and cancelled are the agent saying it will not or cannot,
		// which is a failed run rather than a finished one.
		if result.StopReason != "end_turn" && result.StopReason != "max_tokens" {
			return 1, false
		}

		said, upTo := waiting(ctx, lease, run.ID, log)
		if said == "" {
			return 0, false
		}

		// Marked given before the turn rather than after: an agent that has
		// already been told something must not be told it twice, and a turn
		// that fails ends the run anyway.
		if err := lease.Delivered(ctx, run.ID, upTo); err != nil {
			log.Warn("could not mark what was said delivered", "error", err)
			return 0, false
		}

		log.Info("a person said something", "upTo", upTo)
		prompt = said
	}
}

// waiting reads what a person typed at the agent while it worked. Nothing to
// say, or an unreachable control plane, both end the run rather than hold it.
func waiting(
	ctx context.Context,
	lease Journal,
	runID string,
	log *slog.Logger,
) (string, int) {
	said, err := lease.Said(ctx, runID)
	if err != nil {
		log.Warn("could not read what was said", "error", err)
		return "", 0
	}
	if len(said) == 0 {
		return "", 0
	}

	bodies := make([]string, 0, len(said))
	for _, each := range said {
		bodies = append(bodies, each.Body)
	}

	return strings.Join(bodies, "\n\n"), said[len(said)-1].Position
}

func renew(ctx context.Context, lease Journal, runID string, log *slog.Logger) {
	ticker := time.NewTicker(renewEvery)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			if err := lease.RenewLease(ctx, runID); err != nil {
				log.Warn("could not renew lease", "error", err)
			}
		}
	}
}

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
// through Next, and an illegal step fails the run instead of being discarded:
// at that point the real state is unknown, so it is better to let the lease
// expire and start again.
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

// runHook runs one of the deployment's hooks, journals its output, and treats
// a non-zero exit as the run failing.
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

// journalWriter numbers and batches events, so output arrives in order and a
// reader that reconnects can tell what it missed.
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

	// A rejected batch is dropped, not retried. The run matters more than its
	// narration, and the recording on disk has the same bytes.
	if err := j.journal.AppendEvents(ctx, j.runID, batch); err != nil {
		slog.Warn("could not append events", "run", j.runID, "count", len(batch), "error", err)
	}
}

// StateVar tells a harness where it may keep what it needs between runs.
// Where it then puts it, and under what name, is the harness catalogue's to
// say: the runner offers a directory and reads no meaning into the answer.
const StateVar = "SPOTLIGHT_STATE_DIR"

// granted hands the agent the endpoint it declares through, and expands the
// catalogue's own variables against this run's directories. Explicit, because
// the agent inherits none of the runner's own SPOTLIGHT_ variables.
func granted(env map[string]string, channel *declare.Server, state string) map[string]string {
	places := map[string]string{StateVar: state}

	granted := make(map[string]string, len(env)+3)
	for key, value := range env {
		granted[key] = os.Expand(value, func(name string) string { return places[name] })
	}

	granted[declare.URLVar] = channel.URL()
	granted[declare.TokenVar] = channel.Token()
	granted[StateVar] = state

	return granted
}
