package session

import (
	"cmp"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"usespotlight.ai/data-plane/protocol"
	"usespotlight.ai/data-plane/runner/internal/account"
	"usespotlight.ai/data-plane/runner/internal/acp"
	"usespotlight.ai/data-plane/runner/internal/declare"
	"usespotlight.ai/data-plane/runner/internal/gitproxy"
	"usespotlight.ai/data-plane/runner/internal/otel"
	"usespotlight.ai/data-plane/runner/internal/prepare"
	"usespotlight.ai/data-plane/runner/internal/stackcheck"
	"usespotlight.ai/data-plane/runner/internal/workspace"
)

type Journal interface {
	AppendEvents(ctx context.Context, runID string, events []protocol.Event) error
	RenewLease(ctx context.Context, runID string) (bool, error)
	Complete(ctx context.Context, runID string, done protocol.Completion) error
	UseTool(ctx context.Context, runID, name string, input json.RawMessage) (json.RawMessage, error)
	DraftChangeStack(ctx context.Context, runID, repository, diff, base string) error
	AnswerRemark(ctx context.Context, runID string, said protocol.Remark) error
	Trace(ctx context.Context, runID, taskID string) (json.RawMessage, error)
	RecallMemories(ctx context.Context, runID, words string) (json.RawMessage, error)
	RecallMemory(ctx context.Context, runID, handle string) (json.RawMessage, error)
	Remember(ctx context.Context, runID string, remembered protocol.Remembering) (json.RawMessage, error)
	Said(ctx context.Context, runID string) ([]protocol.Said, error)
	Delivered(ctx context.Context, runID string, upTo int) error
	Attachment(ctx context.Context, runID, attachmentID string, into io.Writer) error
	AskPermission(ctx context.Context, runID string, asked protocol.PermissionAsked) (protocol.PermissionAnswer, error)
	WorkspaceArchive(ctx context.Context, runID string) (*protocol.HeldArchive, error)
	GrantArchive(ctx context.Context, runID string, size int64, sha256 string) (protocol.ArchiveGrant, error)
	SealArchive(ctx context.Context, runID, archiveID string) error
}

const (
	prepareStep = "prepare"
	setupStep   = "setup"
)

const (
	flushEvery = 200 * time.Millisecond
	renewEvery = 2 * time.Second
	steerEvery = 2 * time.Second
)

type Options struct {
	Workspace    string
	Journal      Journal
	Log          *slog.Logger
	AgentUser    *account.User
	Author       prepare.Author
	Mirrors      string
	ControlPlane string
	Token        string
	SetupTimeout time.Duration
}

func Execute(ctx context.Context, run protocol.Run, opts Options) error {
	log := opts.Log.With("run", run.ID)
	journal := &journalWriter{runID: run.ID, journal: opts.Journal}

	lifecycle := &progress{state: Preparing}

	space, err := workspace.Open(opts.Workspace)
	if err != nil {
		return finish(ctx, run.ID, journal, lifecycle, opts.Journal, log, err)
	}

	keeper := newKeeper(run, space, journal, opts.Journal, log)
	keeper.restore(ctx)

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

	// As the runner, before the handover, so nothing prepare holds is left for the agent to find.
	if err := opts.prepare(ctx, space.Dir, run, journal); err != nil {
		return finish(ctx, run.ID, journal, lifecycle, opts.Journal, log, err)
	}

	bases := markBases(ctx, space.Dir, run.Spec.Checkouts, log)

	cwd := space.Dir

	for _, attachment := range run.Spec.Attachments {
		if err := fetch(ctx, opts.Journal, run.ID, space, nil, attachment); err != nil {
			return finish(ctx, run.ID, journal, lifecycle, opts.Journal, log, err)
		}
	}

	for home, laid := range skillHomes(run.Spec.Skills) {
		if err := space.Prune(home, laid); err != nil {
			return finish(ctx, run.ID, journal, lifecycle, opts.Journal, log, fmt.Errorf("clear skills from %s: %w", home, err))
		}
	}

	for _, skill := range run.Spec.Skills {
		if err := lay(space, skill); err != nil {
			return finish(ctx, run.ID, journal, lifecycle, opts.Journal, log, err)
		}
	}

	state, err := space.State()
	if err != nil {
		return finish(ctx, run.ID, journal, lifecycle, opts.Journal, log, err)
	}

	for _, file := range run.Spec.HarnessSetup.Files {
		if err := setUp(space, file); err != nil {
			return finish(ctx, run.ID, journal, lifecycle, opts.Journal, log, err)
		}
	}

	if opts.AgentUser != nil {
		if err := space.GiveTo(opts.AgentUser.UID, opts.AgentUser.GID); err != nil {
			return finish(ctx, run.ID, journal, lifecycle, opts.Journal, log, fmt.Errorf("hand over workspace: %w", err))
		}
	}

	opts.setUp(ctx, space.Dir, run.Spec.Checkouts, journal, log)

	if err := lifecycle.reach(WorkspaceReady); err != nil {
		return finish(ctx, run.ID, journal, lifecycle, opts.Journal, log, err)
	}
	journal.record(ctx, protocol.Event{Type: protocol.EventWorkspaceReady, Message: space.Dir})
	keeper.settled()

	channel, err := declare.Serve(
		run.Spec.Handover.Options,
		run.Spec.Handover.NoteLimit,
		func(ctx context.Context, said protocol.Remark) error {
			return opts.Journal.AnswerRemark(ctx, run.ID, said)
		},
	)
	if err != nil {
		return finish(ctx, run.ID, journal, lifecycle, opts.Journal, log, err)
	}
	defer channel.Close()

	channel.Tools(toolNames(run.Spec.Manifest), func(ctx context.Context, name string, input json.RawMessage) (json.RawMessage, error) {
		return opts.Journal.UseTool(ctx, run.ID, name, input)
	})
	channel.Manifest(run.Spec.Manifest)

	channel.Traces(func(ctx context.Context, taskID string) (json.RawMessage, error) {
		return opts.Journal.Trace(ctx, run.ID, taskID)
	})

	channel.Memories(
		func(ctx context.Context, asked protocol.RecallRequest) (json.RawMessage, error) {
			from := time.Now()
			answer, err := recall(ctx, opts.Journal, run.ID, asked)
			journal.append(protocol.Event{Type: protocol.EventSpan, Data: recalled(asked, from, time.Now(), answer, err)})
			return answer, err
		},
		func(ctx context.Context, remembered protocol.Remembering) (json.RawMessage, error) {
			within, err := checkedOutPaths(space.Dir, run.Spec.Checkouts, remembered.Paths)
			if err != nil {
				return nil, err
			}
			remembered.Paths = within

			journal.flush(ctx)
			return opts.Journal.Remember(ctx, run.ID, remembered)
		},
	)

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

	var putToPerson atomic.Bool

	harness, err := acp.Start(ctx, acp.Options{
		Executable: run.Spec.Command.Executable,
		Args:       run.Spec.Command.Args,
		Env:        granted(run.Spec.Command.Env, channel, state, telemetry.URL),
		Root:       cwd,
		RunAs:      opts.AgentUser,
		Answer:     answering(run, opts.Journal, &putToPerson, log),
		Session:    run.Spec.HarnessSetup.Session,
		McpServers: serversOf(run.Spec.HarnessSetup.McpServers),
	})
	if err != nil {
		return finish(ctx, run.ID, journal, lifecycle, opts.Journal, log, fmt.Errorf("start agent: %w", err))
	}
	defer harness.Close()

	leave := func() {
		_ = harness.Close()
		keeper.keep(ctx)
	}

	if err := lifecycle.reach(AgentStarted); err != nil {
		leave()
		return finish(ctx, run.ID, journal, lifecycle, opts.Journal, log, err)
	}
	log.Info("agent started", "executable", run.Spec.Command.Executable, "cwd", cwd)

	sessionID, err := open(ctx, harness, run.Spec.Continuity.SessionID, log)
	if err != nil {
		leave()
		return finish(ctx, run.ID, journal, lifecycle, opts.Journal, log, err)
	}

	attached := func(ctx context.Context, attachment protocol.Attachment) error {
		return fetch(ctx, opts.Journal, run.ID, space, opts.AgentUser, attachment)
	}

	exitCode, stopped := work(ctx, harness, sessionID, run, journal, opts.Journal, attached, &putToPerson, log)

	if err := lifecycle.reach(AgentExited); err != nil {
		leave()
		return finish(ctx, run.ID, journal, lifecycle, opts.Journal, log, err)
	}

	opts.draftStacks(ctx, run, space.Dir, bases, log)

	declared := channel.Declared()
	if declared == nil {
		declared = space.Outcome()
	}

	leave()

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

	completed := opts.Journal.Complete(ctx, run.ID, protocol.Completion{
		ExitCode:  exitCode,
		Failed:    exitCode != 0,
		Outcome:   declared,
		SessionID: sessionID,
	})

	return completed
}

func (o Options) draftStacks(
	ctx context.Context, run protocol.Run, dir string, bases map[string]string, log *slog.Logger,
) {
	if !run.Spec.Diffs {
		return
	}

	checking := stackcheck.Options{Dir: dir, RunAs: o.AgentUser, Log: log}

	for _, checkout := range run.Spec.Checkouts {
		diffing := checking.Diff
		if checkout.DiffOf == protocol.DiffOfCommits {
			diffing = checking.Committed
		}

		diff, err := diffing(ctx, filepath.Join(dir, checkout.Path))
		if err != nil {
			log.Warn("could not diff a checkout for its change stack", "path", checkout.Path, "error", err)
			continue
		}
		if diff == "" {
			continue
		}

		if err := o.Journal.DraftChangeStack(ctx, run.ID, checkout.Path, diff, bases[checkout.Path]); err != nil {
			log.Warn("could not hand over what a run changed", "path", checkout.Path, "error", err)
			continue
		}

		log.Info("drafting a change stack", "path", checkout.Path)
	}
}

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

func work(
	ctx context.Context,
	harness *acp.Client,
	sessionID string,
	run protocol.Run,
	journal *journalWriter,
	lease Journal,
	attached func(context.Context, protocol.Attachment) error,
	putToPerson *atomic.Bool,
	log *slog.Logger,
) (int, bool) {
	renewing, stopRenewing := context.WithCancel(ctx)
	defer stopRenewing()

	var stopped atomic.Bool
	go renew(renewing, lease, run.ID, log, func() {
		stopped.Store(true)
		_ = harness.Close()
	})

	flushing, stopFlushing := context.WithCancel(ctx)
	defer stopFlushing()
	go stream(flushing, journal)

	prompt := run.Spec.Briefing
	steered, resaid := false, false

	for {
		turn, endTurn := context.WithCancel(ctx)
		go steer(turn, harness, lease, sessionID, run.ID, log)

		heard := 0
		result, err := harness.Prompt(ctx, sessionID, prompt, func(update acp.Update) {
			heard++
			journal.append(protocol.Event{
				Type: protocol.EventOutput,
				Data: update.Raw,
			})
		})
		endTurn()

		journal.flush(ctx)

		if stopped.Load() {
			return 0, true
		}

		if putToPerson.Load() {
			log.Info("a person was asked for permission; letting the run go")
			return 0, false
		}

		if err != nil {
			log.Warn("the agent stopped short", "error", err)
			return -1, false
		}

		log.Info("turn finished", "stopReason", result.StopReason)

		// A harness can end the turn right after a cancel without reading the prompt at all.
		if steered && !resaid && heard == 0 && result.StopReason == "end_turn" {
			log.Info("the harness let what was said go unread; saying it again")
			resaid = true
			continue
		}
		steered, resaid = result.StopReason == "cancelled", false

		if result.StopReason != "end_turn" &&
			result.StopReason != "max_tokens" &&
			result.StopReason != "cancelled" {
			return 1, false
		}

		said, upTo := waiting(ctx, lease, run.ID, attached, log)
		if said == "" {
			return 0, false
		}

		if err := lease.Delivered(ctx, run.ID, upTo); err != nil {
			log.Warn("could not mark what was said delivered", "error", err)
			return 0, false
		}

		log.Info("a person said something", "upTo", upTo)
		prompt = said
	}
}

func answering(
	run protocol.Run, lease Journal, putToPerson *atomic.Bool, log *slog.Logger,
) acp.Permission {
	asks := run.Spec.HarnessSetup.Asks

	return func(ctx context.Context, asked acp.Asked) acp.Verdict {
		if !slices.Contains(asks, asked.Kind) {
			return acp.Allow
		}

		if putToPerson.Load() {
			return acp.Cancel
		}

		answer, err := lease.AskPermission(ctx, run.ID, protocol.PermissionAsked{
			SessionID: asked.SessionID,
			Kind:      asked.Kind,
			Title:     asked.Title,
			Input:     asked.Input,
		})
		if err != nil {
			log.Warn("could not ask for permission; refusing", "tool", asked.Title, "error", err)
			return acp.Reject
		}

		switch answer.Decision {
		case protocol.PermissionAllow:
			return acp.Allow
		case protocol.PermissionPutToPerson:
			putToPerson.Store(true)
			return acp.Cancel
		default:
			return acp.Reject
		}
	}
}

func serversOf(given []protocol.McpServer) []acp.McpServer {
	servers := make([]acp.McpServer, 0, len(given))
	for _, server := range given {
		env := make([]acp.EnvVariable, 0, len(server.Env))
		for _, variable := range server.Env {
			env = append(env, acp.EnvVariable{Name: variable.Name, Value: variable.Value})
		}
		servers = append(servers, acp.McpServer{
			Name: server.Name, Command: server.Command, Args: server.Args, Env: env,
		})
	}
	return servers
}

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

const skillFile = "SKILL.md"

func skillHomes(skills []protocol.SkillFile) map[string][]string {
	var candidates []string
	for _, skill := range skills {
		path := filepath.Clean(skill.Path)
		if filepath.Base(path) == skillFile {
			candidates = append(candidates, filepath.Dir(filepath.Dir(path)))
		}
	}
	slices.SortFunc(candidates, func(a, b string) int { return cmp.Compare(len(a), len(b)) })

	homes := map[string][]string{}
	for _, candidate := range candidates {
		if candidate == "." || homeOf(homes, candidate) != "" {
			continue
		}
		homes[candidate] = nil
	}

	for _, skill := range skills {
		if home := homeOf(homes, filepath.Clean(skill.Path)); home != "" {
			homes[home] = append(homes[home], skill.Path)
		}
	}

	return homes
}

func homeOf(homes map[string][]string, path string) string {
	for home := range homes {
		if path == home || strings.HasPrefix(path, home+string(filepath.Separator)) {
			return home
		}
	}

	return ""
}

func lay(space *workspace.Workspace, skill protocol.SkillFile) error {
	if err := space.Replace(skill.Path, nil, writing(skill.Text)); err != nil {
		return fmt.Errorf("lay skill %s: %w", skill.Path, err)
	}

	return nil
}

func setUp(space *workspace.Workspace, file protocol.SetupFile) error {
	if !filepath.IsLocal(file.Path) {
		return fmt.Errorf("harness file %q escapes the state directory", file.Path)
	}

	if err := space.Replace(filepath.Join(workspace.StatePath, file.Path), nil, writing(file.Text)); err != nil {
		return fmt.Errorf("lay harness file %s: %w", file.Path, err)
	}

	return nil
}

func writing(text string) func(io.Writer) error {
	return func(into io.Writer) error {
		_, err := io.WriteString(into, text)
		return err
	}
}

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

func (o Options) prepare(ctx context.Context, dir string, run protocol.Run, journal *journalWriter) error {
	if len(run.Spec.Checkouts) == 0 {
		return nil
	}

	output, err := prepare.Checkouts(ctx, run.Spec.Checkouts, prepare.Options{
		Dir:     dir,
		Mirrors: o.Mirrors,
		Author:  o.Author,
	})
	if output != "" {
		journal.append(protocol.Event{Type: protocol.EventOutput, Message: prepareStep, Data: []byte(output)})
	}
	if err != nil {
		return fmt.Errorf("prepare: %w", err)
	}

	return nil
}

func (o Options) setUp(
	ctx context.Context, dir string, checkouts []protocol.Checkout, journal *journalWriter, log *slog.Logger,
) {
	for _, checkout := range checkouts {
		if checkout.Setup == "" {
			continue
		}

		output, err := prepare.Setup(ctx, filepath.Join(dir, checkout.Path), checkout.Setup, o.AgentUser, o.SetupTimeout)
		if err != nil {
			log.Warn("could not set up a checkout", "path", checkout.Path, "error", err)
			output = strings.TrimSpace(fmt.Sprintf("%s\n\nSetting up %s failed: %v", output, checkout.Path, err))
		}
		if output != "" {
			journal.append(protocol.Event{Type: protocol.EventOutput, Message: setupStep, Data: []byte(output)})
		}
	}
}

type journalWriter struct {
	runID   string
	journal Journal
	mu      sync.Mutex
	sending sync.Mutex
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
	j.sending.Lock()
	defer j.sending.Unlock()

	j.mu.Lock()
	batch := j.pending
	j.pending = nil
	j.mu.Unlock()

	if len(batch) == 0 {
		return
	}

	if err := j.journal.AppendEvents(ctx, j.runID, batch); err != nil {
		slog.Warn("could not append events", "run", j.runID, "count", len(batch), "error", err)
	}
}

func recall(ctx context.Context, journal Journal, runID string, asked protocol.RecallRequest) (json.RawMessage, error) {
	if asked.Handle != "" {
		return journal.RecallMemory(ctx, runID, asked.Handle)
	}
	return journal.RecallMemories(ctx, runID, asked.Words)
}

func checkedOutPaths(dir string, checkouts []protocol.Checkout, asked []string) ([]string, error) {
	roots := []string{filepath.Clean(dir)}
	if resolved, err := filepath.EvalSymlinks(dir); err == nil && resolved != roots[0] {
		roots = append(roots, resolved)
	}

	within := make([]string, 0, len(asked))
	for _, raw := range asked {
		found, ok := checkedOutPath(roots, checkouts, raw)
		if !ok {
			return nil, &declare.Refusal{Because: fmt.Sprintf(
				"%s is outside the repositories this run checked out; name a path inside %s",
				raw, checkoutDirs(dir, checkouts),
			)}
		}
		within = append(within, found)
	}

	return within, nil
}

func checkedOutPath(roots []string, checkouts []protocol.Checkout, raw string) (string, bool) {
	candidates := []string{filepath.Clean(raw)}
	if resolved, err := filepath.EvalSymlinks(raw); err == nil {
		candidates = append(candidates, resolved)
	}

	for _, root := range roots {
		for _, candidate := range candidates {
			relative, err := filepath.Rel(root, candidate)
			if err != nil {
				continue
			}
			relative = filepath.ToSlash(relative)

			for _, checkout := range checkouts {
				folder := filepath.ToSlash(filepath.Clean(checkout.Path))
				if relative == folder || strings.HasPrefix(relative, folder+"/") {
					return relative, true
				}
			}
		}
	}

	return "", false
}

func checkoutDirs(dir string, checkouts []protocol.Checkout) string {
	if len(checkouts) == 0 {
		return "a checkout, and this run has none"
	}

	named := make([]string, len(checkouts))
	for at, checkout := range checkouts {
		named[at] = filepath.Join(dir, checkout.Path)
	}

	return "one of: " + strings.Join(named, ", ")
}

const StateVar = "SPOTLIGHT_STATE_DIR"

const TelemetryVar = "SPOTLIGHT_TELEMETRY_URL"

func granted(
	env map[string]string, channel *declare.Server, state, telemetry string,
) map[string]string {
	places := map[string]string{StateVar: state, TelemetryVar: telemetry}

	granted := make(map[string]string, len(env)+3)
	for key, value := range env {
		granted[key] = os.Expand(value, func(name string) string { return places[name] })
	}

	granted[protocol.HandoverURLVar] = channel.URL()
	granted[protocol.HandoverTokenVar] = channel.Token()
	granted[StateVar] = state

	return granted
}

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

func toolNames(manifest []protocol.ToolManifest) []string {
	names := make([]string, 0, len(manifest))
	for _, tool := range manifest {
		names = append(names, tool.Name)
	}
	return names
}
