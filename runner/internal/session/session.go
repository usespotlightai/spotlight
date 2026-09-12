package session

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"os"
	"slices"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"usespotlight.ai/runner/internal/account"
	"usespotlight.ai/runner/internal/acp"
	"usespotlight.ai/runner/internal/declare"
	"usespotlight.ai/runner/internal/gitproxy"
	"usespotlight.ai/runner/internal/hook"
	"usespotlight.ai/runner/internal/otel"
	"usespotlight.ai/runner/internal/protocol"
	"usespotlight.ai/runner/internal/workspace"
)

// Journal is the part of the control plane a run talks to. Declared here, not
// in the client, so this package can be tested without one.
type Journal interface {
	AppendEvents(ctx context.Context, runID string, events []protocol.Event) error
	// RenewLease keeps the claim alive and answers whether a person has asked
	// the run to stop.
	RenewLease(ctx context.Context, runID string) (bool, error)
	Complete(ctx context.Context, runID string, done protocol.Completion) error
	OpenPullRequest(ctx context.Context, runID string, asked protocol.PullRequest) (string, error)
	AnswerRemark(ctx context.Context, runID string, said protocol.Remark) error
	Trace(ctx context.Context, runID, taskID string) (json.RawMessage, error)
	Said(ctx context.Context, runID string) ([]protocol.Said, error)
	Delivered(ctx context.Context, runID string, upTo int) error
	Attachment(ctx context.Context, runID, attachmentID string, into io.Writer) error
}

const (
	// flushEvery coalesces terminal output. Per-read events would mean a
	// request per echoed keystroke.
	flushEvery = 200 * time.Millisecond
	// renewEvery keeps the lease alive well inside its expiry, and doubles as
	// how often the runner learns of a stop. Short, so a stop reaches a working
	// agent in a couple of seconds rather than the tens the lease would allow.
	renewEvery = 2 * time.Second
	// steerEvery is how often a running turn is checked for something a person
	// said, so steering lands about as quickly as a stop.
	steerEvery = 2 * time.Second
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
	// ControlPlane and Token serve the run's git remote. The remote carries
	// neither, so the workspace holds nothing that opens the codebase.
	ControlPlane string
	Token        string
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

	// Reachable for exactly as long as the run is worked.
	if len(run.Spec.Checkouts) > 0 {
		serving, err := gitproxy.Serve(opts.ControlPlane, opts.Token, run.ID)
		if err != nil {
			return finish(ctx, run.ID, journal, lifecycle, opts.Journal, log, err)
		}
		defer func() {
			if err := serving.Close(); err != nil {
				log.Warn("could not stop serving git", "error", err)
			}
		}()

		run.Spec.Checkouts = reached(run.Spec.Checkouts, serving.Remote)
	}

	// Before the handover, so the hook's credentials are gone by the time the
	// agent can look.
	if err := opts.runHook(ctx, opts.PrepareHook, space.Dir, run, journal, log, "prepare"); err != nil {
		return finish(ctx, run.ID, journal, lifecycle, opts.Journal, log, err)
	}

	cwd, err := space.Resolve(run.Spec.Cwd)
	if err != nil {
		return finish(ctx, run.ID, journal, lifecycle, opts.Journal, log, err)
	}

	// Before the handover, so the agent owns these with the rest of the
	// workspace. Work naming a file it cannot have is not worth starting.
	for _, attachment := range run.Spec.Attachments {
		if err := fetch(ctx, opts.Journal, run.ID, space, nil, attachment); err != nil {
			return finish(ctx, run.ID, journal, lifecycle, opts.Journal, log, err)
		}
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
	var opener declare.Opener
	if slices.Contains(run.Spec.Tools, protocol.ToolPullRequest) {
		opener = func(ctx context.Context, asked protocol.PullRequest) (string, error) {
			return opts.Journal.OpenPullRequest(ctx, run.ID, asked)
		}
	}

	channel, err := declare.Serve(
		run.Spec.Handover.Options,
		run.Spec.Handover.NoteLimit,
		opener,
		func(ctx context.Context, said protocol.Remark) error {
			return opts.Journal.AnswerRemark(ctx, run.ID, said)
		},
	)
	if err != nil {
		return finish(ctx, run.ID, journal, lifecycle, opts.Journal, log, err)
	}
	defer channel.Close()

	// The runner reads the trace with its own token, so the agent studying one
	// never holds it.
	channel.Traces(func(ctx context.Context, taskID string) (json.RawMessage, error) {
		return opts.Journal.Trace(ctx, run.ID, taskID)
	})

	// Raised before the agent for the same reason the endpoint is: a harness
	// that exports from its first breath needs somewhere to export to.
	telemetry, err := otel.Serve(func(span json.RawMessage) {
		journal.append(protocol.Event{Type: protocol.EventSpan, Data: span})
	})
	if err != nil {
		return finish(ctx, run.ID, journal, lifecycle, opts.Journal, log, err)
	}
	defer func() {
		if err := telemetry.Close(); err != nil {
			log.Warn("could not stop taking telemetry", "error", err)
		}
	}()

	harness, err := acp.Start(ctx, acp.Options{
		Executable: run.Spec.Command.Executable,
		Args:       run.Spec.Command.Args,
		Env:        granted(run.Spec.Command.Env, channel, state, telemetry.URL),
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

	attached := func(ctx context.Context, attachment protocol.Attachment) error {
		return fetch(ctx, opts.Journal, run.ID, space, opts.AgentUser, attachment)
	}

	exitCode, stopped := work(ctx, harness, sessionID, run, journal, opts.Journal, attached, log)

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
			Stopped:   true,
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
	attached func(context.Context, protocol.Attachment) error,
	log *slog.Logger,
) (int, bool) {
	renewing, stopRenewing := context.WithCancel(ctx)
	defer stopRenewing()

	// Closing the harness on a stop ends the turn: the in-flight prompt unblocks
	// and the loop reports it stopped. Close is a sync.Once, so Execute's
	// deferred Close stays a no-op after this.
	var stopped atomic.Bool
	go renew(renewing, lease, run.ID, log, func() {
		stopped.Store(true)
		_ = harness.Close()
	})

	// The agent's updates are appended as they arrive but only shipped by a
	// flush; without this ticker nothing would ship until the turn ended, and a
	// reader would see a run's result rather than its working. The per-turn
	// flush below still has the last word.
	flushing, stopFlushing := context.WithCancel(ctx)
	defer stopFlushing()
	go stream(flushing, journal)

	prompt := run.Spec.Briefing

	for {
		// Cut the turn short if a person speaks while it runs, so their words
		// steer the work in flight. Scoped to the turn, not the run.
		turn, endTurn := context.WithCancel(ctx)
		go steer(turn, harness, lease, sessionID, run.ID, log)

		result, err := harness.Prompt(ctx, sessionID, prompt, func(update acp.Update) {
			journal.append(protocol.Event{
				Type: protocol.EventOutput,
				Data: update.Raw,
			})
		})
		endTurn()

		journal.flush(ctx)

		// A stop closes the harness, which surfaces here as the prompt failing.
		// Checked first so it is read as a clean stop, not an agent that broke.
		if stopped.Load() {
			return 0, true
		}

		if err != nil {
			log.Warn("the agent stopped short", "error", err)
			return -1, false
		}

		log.Info("turn finished", "stopReason", result.StopReason)

		// A cancelled turn is a steer: a person spoke, so it is taken up below
		// like any other turn. Refused, or ended short any other way, is the
		// agent saying it will not or cannot, which is a failed run.
		if result.StopReason != "end_turn" &&
			result.StopReason != "max_tokens" &&
			result.StopReason != "cancelled" {
			return 1, false
		}

		said, upTo := waiting(ctx, lease, run.ID, attached, log)
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

// steer cuts a turn short once a person has said something, so it is taken up
// at once. It only reads to notice; the loop does the reading and marking
// delivered when it takes the turn up.
func steer(
	ctx context.Context,
	harness *acp.Client,
	lease Journal,
	sessionID, runID string,
	log *slog.Logger,
) {
	ticker := time.NewTicker(steerEvery)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			said, err := lease.Said(ctx, runID)
			if err != nil {
				// The turn ending cancels this context; that read is not a fault.
				if ctx.Err() == nil {
					log.Warn("could not look for anything said", "error", err)
				}
				continue
			}
			if len(said) > 0 {
				log.Info("a person spoke mid-turn; steering")
				if err := harness.Cancel(sessionID); err != nil {
					log.Warn("could not cancel the turn", "error", err)
				}
				return
			}
		}
	}
}

// waiting reads what a person typed at the agent while it worked. Nothing to
// say, or an unreachable control plane, both end the run rather than hold it.
func waiting(
	ctx context.Context,
	lease Journal,
	runID string,
	attached func(context.Context, protocol.Attachment) error,
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
		for _, attachment := range each.Attachments {
			if err := attached(ctx, attachment); err != nil {
				log.Warn("could not fetch what was attached", "error", err)
			}
		}
		bodies = append(bodies, each.Body)
	}

	return strings.Join(bodies, "\n\n"), said[len(said)-1].Position
}

func fetch(
	ctx context.Context,
	journal Journal,
	runID string,
	space *workspace.Workspace,
	owner *account.User,
	attachment protocol.Attachment,
) error {
	err := space.Receive(attachment.Path, owner, func(into io.Writer) error {
		return journal.Attachment(ctx, runID, attachment.ID, into)
	})
	if err != nil {
		return fmt.Errorf("fetch attachment %s: %w", attachment.ID, err)
	}

	return nil
}

// renew keeps the lease alive and watches its answer for a stop, calling onStop
// once and returning when one comes.
func renew(
	ctx context.Context,
	lease Journal,
	runID string,
	log *slog.Logger,
	onStop func(),
) {
	ticker := time.NewTicker(renewEvery)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			stop, err := lease.RenewLease(ctx, runID)
			if err != nil {
				log.Warn("could not renew lease", "error", err)
				continue
			}
			if stop {
				log.Info("a person asked the run to stop")
				onStop()
				return
			}
		}
	}
}

// stream ships whatever the agent has said so far every flushEvery, coalescing
// a turn's chunks into a few requests rather than one per update. It stops when
// the turn's context is cancelled; the caller flushes once more after, so a
// tick lost to a race at the end costs nothing.
func stream(ctx context.Context, journal *journalWriter) {
	ticker := time.NewTicker(flushEvery)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			journal.flush(ctx)
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
	// Held for seq and pending only. A harness exporting telemetry writes here
	// from whichever goroutine took the export, while the agent's own updates
	// arrive on the one reading it; seq rises without gaps or the control plane
	// drops what it cannot place.
	mu      sync.Mutex
	seq     int
	pending []protocol.Event
}

func (j *journalWriter) append(event protocol.Event) {
	j.mu.Lock()
	defer j.mu.Unlock()

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
	// Taken under the lock and sent outside it: a slow control plane must not
	// hold up the agent being read.
	j.mu.Lock()
	batch := j.pending
	j.pending = nil
	j.mu.Unlock()

	if len(batch) == 0 {
		return
	}

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

// TelemetryVar tells a harness where to export what it records of itself. What
// it exports, and under which of its own variables this belongs, is the harness
// catalogue's to say: the runner offers a collector and reads nothing into the
// answer.
const TelemetryVar = "SPOTLIGHT_TELEMETRY_URL"

// granted hands the agent the endpoint it declares through, and expands the
// catalogue's own variables against this run's directories. Explicit, because
// the agent inherits none of the runner's own SPOTLIGHT_ variables.
func granted(
	env map[string]string, channel *declare.Server, state, telemetry string,
) map[string]string {
	places := map[string]string{StateVar: state, TelemetryVar: telemetry}

	granted := make(map[string]string, len(env)+3)
	for key, value := range env {
		granted[key] = os.Expand(value, func(name string) string { return places[name] })
	}

	granted[declare.URLVar] = channel.URL()
	granted[declare.TokenVar] = channel.Token()
	granted[StateVar] = state

	return granted
}

// reached turns the control plane's stand-in remote into the address this
// runner is serving the repository on. A run may work several, so each is
// reached under its own path, which is the directory it is cloned into. A
// checkout naming anywhere else is left alone: what a remote means is
// otherwise the hook's business.
func reached(checkouts []protocol.Checkout, remote string) []protocol.Checkout {
	resolved := make([]protocol.Checkout, len(checkouts))

	for at, checkout := range checkouts {
		resolved[at] = checkout
		if checkout.Remote == protocol.ThroughSpotlight {
			resolved[at].Remote = remote + "/" + checkout.Path
		}
	}

	return resolved
}
