package session

import (
	"cmp"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"maps"
	"net/http"
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
	"usespotlight.ai/data-plane/runner/internal/agentapi"
	"usespotlight.ai/data-plane/runner/internal/gitproxy"
	"usespotlight.ai/data-plane/runner/internal/otel"
	"usespotlight.ai/data-plane/runner/internal/prepare"
	"usespotlight.ai/data-plane/runner/internal/stackcheck"
	"usespotlight.ai/data-plane/runner/internal/workspace"
	"usespotlight.ai/data-plane/telemetry"
)

type Journal interface {
	AppendEvents(ctx context.Context, runID string, events []protocol.Event) error
	RenewLease(ctx context.Context, runID string) (bool, error)
	Complete(ctx context.Context, runID string, done protocol.Completion) (protocol.CompleteResponse, error)
	AwaitsPerson(ctx context.Context, runID string, turn protocol.Completion) (bool, error)
	Suspend(ctx context.Context, runID string, requeue bool) (protocol.Suspension, error)
	UseTool(ctx context.Context, runID, name string, input json.RawMessage) (json.RawMessage, error)
	GenerateChangeStack(ctx context.Context, runID, repository, diff, base string) error
	ReplyToReviewComment(ctx context.Context, runID string, reply protocol.ReviewCommentReply) error
	Trace(ctx context.Context, runID, taskID string) (json.RawMessage, error)
	History(ctx context.Context, runID string, request protocol.HistoryRequest) (json.RawMessage, error)
	RecallMemories(ctx context.Context, runID, words string) (json.RawMessage, error)
	RecallMemory(ctx context.Context, runID, handle string) (json.RawMessage, error)
	Remember(ctx context.Context, runID string, remembered protocol.RememberRequest) (json.RawMessage, error)
	ProposeCandidate(ctx context.Context, runID string, proposal protocol.CandidateProposal) (json.RawMessage, error)
	RecordCause(ctx context.Context, runID string, record protocol.CauseRecord) (json.RawMessage, error)
	MemoryFiles(ctx context.Context, runID string) ([]protocol.MemoryFile, error)
	Messages(ctx context.Context, runID string) ([]protocol.Message, error)
	AckMessages(ctx context.Context, runID string, upTo int) error
	Attachment(ctx context.Context, runID, attachmentID string, into io.Writer) error
	AskPermission(ctx context.Context, runID string, asked protocol.PermissionRequest) (protocol.PermissionResponse, error)
	WorkspaceArchive(ctx context.Context, runID string) (*protocol.StoredArchive, error)
	GrantArchive(ctx context.Context, runID string, size int64, sha256 string) (protocol.ArchiveGrant, error)
	CompleteArchive(ctx context.Context, runID, archiveID string) error
	RecordStartingPoint(ctx context.Context, runID string, point protocol.StartingPoint) error
}

const (
	prepareStep = "prepare"
	setupStep   = "setup"
)

const (
	flushEvery = 200 * time.Millisecond
	heartbeat  = 2 * time.Second
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
	AnswerWait   time.Duration
	Heartbeat    time.Duration
	Transport    http.RoundTripper
	ProxyEnv     map[string]string
	Enforced     func(ctx context.Context) bool
	Unready      error
}

func Execute(ctx context.Context, run protocol.Run, opts Options) error {
	log := opts.Log.With("run", run.ID)
	journal := &journalWriter{runID: run.ID, journal: opts.Journal}

	if searches(run) {
		run.Spec.Checkouts = nil
		run.Spec.Skills = nil
		run.Spec.SettingFiles = nil
		run.Spec.HarnessSetup.Files = nil
	}

	lifecycle := &progress{state: Preparing}

	if opts.Unready != nil {
		return setupFailed(ctx, run.ID, journal, lifecycle, opts.Journal, log, opts.Unready)
	}

	space, err := workspace.Open(opts.Workspace)
	if err != nil {
		return setupFailed(ctx, run.ID, journal, lifecycle, opts.Journal, log, err)
	}

	archiver := newArchiver(run, space, journal, opts.Journal, opts.Transport, log)
	if err := archiver.restore(ctx); err != nil {
		return setupFailed(ctx, run.ID, journal, lifecycle, opts.Journal, log, err)
	}

	if err := space.Remove(workspace.HandoverPath); err != nil {
		return setupFailed(ctx, run.ID, journal, lifecycle, opts.Journal, log, fmt.Errorf("clear an earlier run's outcome: %w", err))
	}

	if len(run.Spec.Checkouts) > 0 {
		serving, err := gitproxy.Serve(opts.ControlPlane, opts.Token, run.ID, replays(run), opts.Transport)
		if err != nil {
			return setupFailed(ctx, run.ID, journal, lifecycle, opts.Journal, log, err)
		}
		defer func() {
			if err := serving.Close(); err != nil {
				log.Warn("could not stop serving git", "error", err)
			}
		}()

		run.Spec.Checkouts = viaGitProxy(run.Spec.Checkouts, serving.Remote)
	}

	// Prepare as the runner, before the handover, so the agent finds nothing that prepare keeps.
	if err := opts.prepare(ctx, space.Dir, run, journal); err != nil {
		return setupFailed(ctx, run.ID, journal, lifecycle, opts.Journal, log, err)
	}

	bases := markBases(ctx, space.Dir, run.Spec.Checkouts, log)
	archiver.started(ctx)

	cwd := space.Dir

	for _, attachment := range run.Spec.Attachments {
		if err := fetch(ctx, opts.Journal, run.ID, space, nil, attachment); err != nil {
			return setupFailed(ctx, run.ID, journal, lifecycle, opts.Journal, log, err)
		}
	}

	for home, written := range skillHomes(run.Spec.SkillHomes, run.Spec.Skills) {
		if err := space.Prune(home, written); err != nil {
			return setupFailed(ctx, run.ID, journal, lifecycle, opts.Journal, log, fmt.Errorf("clear skills from %s: %w", home, err))
		}
	}

	for _, skill := range run.Spec.Skills {
		if err := writeSkill(space, skill); err != nil {
			return setupFailed(ctx, run.ID, journal, lifecycle, opts.Journal, log, err)
		}
	}

	if searches(run) {
		if err := space.Remove(memoryFolder); err != nil {
			return setupFailed(ctx, run.ID, journal, lifecycle, opts.Journal, log, fmt.Errorf("clear the team's memory: %w", err))
		}
	} else {
		writeMemoryFiles(ctx, opts.Journal, run.ID, space, log)
	}

	state, err := space.State()
	if err != nil {
		return setupFailed(ctx, run.ID, journal, lifecycle, opts.Journal, log, err)
	}

	for _, path := range run.Spec.SettingFiles {
		if err := unset(space, path, run.Spec.HarnessSetup.Files); err != nil {
			return setupFailed(ctx, run.ID, journal, lifecycle, opts.Journal, log, err)
		}
	}

	for _, file := range run.Spec.HarnessSetup.Files {
		if err := setUp(space, file); err != nil {
			return setupFailed(ctx, run.ID, journal, lifecycle, opts.Journal, log, err)
		}
	}

	if opts.AgentUser != nil {
		if err := space.ChownAll(opts.AgentUser.UID, opts.AgentUser.GID); err != nil {
			return setupFailed(ctx, run.ID, journal, lifecycle, opts.Journal, log, fmt.Errorf("hand over workspace: %w", err))
		}
	}

	opts.setUp(ctx, space.Dir, run.Spec.Checkouts, journal, log)

	if err := lifecycle.advance(WorkspaceReady); err != nil {
		return setupFailed(ctx, run.ID, journal, lifecycle, opts.Journal, log, err)
	}
	journal.record(ctx, protocol.Event{Type: protocol.EventWorkspaceReady, Message: space.Dir})
	archiver.recordBaseline()

	channel, err := agentapi.Serve(
		run.Spec.Handover.Options,
		run.Spec.Handover.NoteLimit,
		func(ctx context.Context, reply protocol.ReviewCommentReply) error {
			if replays(run) {
				return notAllowedInReplay("reply to a review comment")
			}
			if searches(run) {
				return notAllowedInSearch("reply to a review comment")
			}
			return opts.Journal.ReplyToReviewComment(ctx, run.ID, reply)
		},
	)
	if err != nil {
		return setupFailed(ctx, run.ID, journal, lifecycle, opts.Journal, log, err)
	}
	defer channel.Close()

	channel.Tools(toolNames(run.Spec.Manifest), func(ctx context.Context, name string, input json.RawMessage) (json.RawMessage, error) {
		return opts.Journal.UseTool(ctx, run.ID, name, input)
	})
	channel.Manifest(run.Spec.Manifest)

	channel.Traces(func(ctx context.Context, taskID string) (json.RawMessage, error) {
		return opts.Journal.Trace(ctx, run.ID, taskID)
	})

	channel.Histories(func(ctx context.Context, request protocol.HistoryRequest) (json.RawMessage, error) {
		return opts.Journal.History(ctx, run.ID, request)
	})

	channel.Memories(
		func(ctx context.Context, request protocol.RecallRequest) (json.RawMessage, error) {
			if searches(run) {
				return nil, notAllowedInSearch("recall what the team remembers")
			}

			from := time.Now()
			answer, err := recall(ctx, opts.Journal, run.ID, request)
			journal.append(protocol.Event{Type: protocol.EventSpan, Data: recalled(request, from, time.Now(), answer, err)})
			return answer, err
		},
		func(ctx context.Context, remembered protocol.RememberRequest) (json.RawMessage, error) {
			if replays(run) {
				return nil, notAllowedInReplay("remember")
			}
			if searches(run) {
				return nil, notAllowedInSearch("propose a memory")
			}

			within, err := checkedOutPaths(space.Dir, run.Spec.Checkouts, remembered.Paths)
			if err != nil {
				return nil, err
			}
			remembered.Paths = within

			journal.flush(ctx)
			return opts.Journal.Remember(ctx, run.ID, remembered)
		},
	)

	if searches(run) {
		channel.Candidates(func(ctx context.Context, proposal protocol.CandidateProposal) (json.RawMessage, error) {
			journal.flush(ctx)
			from := time.Now()
			answer, err := opts.Journal.ProposeCandidate(ctx, run.ID, proposal)
			journal.append(protocol.Event{Type: protocol.EventSpan, Data: proposedSpan(proposal, from, time.Now(), answer, err)})
			return answer, err
		})
		channel.Causes(func(ctx context.Context, record protocol.CauseRecord) (json.RawMessage, error) {
			journal.flush(ctx)
			return opts.Journal.RecordCause(ctx, run.ID, record)
		})
	}

	telemetry, err := otel.Serve(func(span json.RawMessage) {
		journal.append(protocol.Event{Type: protocol.EventSpan, Data: span})
	})
	if err != nil {
		return setupFailed(ctx, run.ID, journal, lifecycle, opts.Journal, log, err)
	}
	defer func() {
		if err := telemetry.Close(); err != nil {
			log.Warn("could not stop taking telemetry", "error", err)
		}
	}()

	var escalated atomic.Bool

	opts.checkEgress(ctx, journal)

	env := granted(run.Spec.Command.Env, channel, state, telemetry.URL, usesAPI(run.Spec, opts.ControlPlane))
	maps.Copy(env, opts.ProxyEnv)

	harness, err := acp.Start(ctx, acp.Options{
		Executable: run.Spec.Command.Executable,
		Args:       run.Spec.Command.Args,
		Env:        env,
		Root:       cwd,
		RunAs:      opts.AgentUser,
		Answer:     answerPermissions(run, opts.Journal, journal, &escalated, log),
		Session:    run.Spec.HarnessSetup.Session,
		McpServers: serversOf(run.Spec.HarnessSetup.McpServers),
	})
	if err != nil {
		return finish(ctx, run.ID, journal, lifecycle, opts.Journal, log, fmt.Errorf("start agent: %w", err))
	}
	defer harness.Close()

	leave := func() {
		_ = harness.Close()
		archiver.archive(ctx)
	}

	if err := lifecycle.advance(AgentStarted); err != nil {
		leave()
		return finish(ctx, run.ID, journal, lifecycle, opts.Journal, log, err)
	}
	log.Info("agent started", "executable", run.Spec.Command.Executable, "cwd", cwd)

	sessionID, err := open(ctx, harness, run.Spec.Resume.SessionID, log)
	if err != nil {
		leave()
		return finish(ctx, run.ID, journal, lifecycle, opts.Journal, log, err)
	}

	talk := &conversation{
		run:       run,
		harness:   harness,
		sessionID: sessionID,
		journal:   journal,
		control:   opts.Journal,
		archiver:  archiver,
		lifecycle: lifecycle,
		takeHandover: func() *protocol.Handover {
			if handover := channel.TakeHandover(); handover != nil {
				return handover
			}
			return space.TakeHandover()
		},
		attached: func(ctx context.Context, attachment protocol.Attachment) error {
			return fetch(ctx, opts.Journal, run.ID, space, opts.AgentUser, attachment)
		},
		escalated:  &escalated,
		handOver:   handingOver(opts, run, space.Dir, bases, log),
		heartbeat:  opts.heartbeat(),
		answerWait: opts.AnswerWait,
		log:        log,
		stopped:    make(chan struct{}),
		lost:       make(chan struct{}),
	}

	suspended, err := talk.work(ctx, talk.opening(ctx))
	_ = harness.Close()
	if suspended {
		log.Info("run suspended", "state", lifecycle.state)
		return nil
	}
	if err != nil {
		return err
	}

	lifecycle.note(AgentExited, log)
	if !replays(run) {
		opts.generateStacks(ctx, run, space.Dir, bases, log)
	}
	lifecycle.note(Drained, log)

	log.Info("run finished", "state", lifecycle.state)
	return nil
}

func handingOver(
	opts Options, run protocol.Run, dir string, bases map[string]string, log *slog.Logger,
) func(context.Context) {
	if !replays(run) {
		return nil
	}

	return func(ctx context.Context) {
		opts.generateStacks(ctx, run, dir, bases, log)
	}
}

func replays(run protocol.Run) bool {
	return run.Spec.Replay != nil
}

func notAllowedInReplay(what string) error {
	return &agentapi.Error{Because: "a replay may not " + what + ": it has no effect outside Spotlight"}
}

func searches(run protocol.Run) bool {
	return run.Spec.Search != nil
}

func notAllowedInSearch(what string) error {
	return &agentapi.Error{Because: "a search may not " + what + ": it studies the station's history and proposes station configs, nothing more"}
}

func (o Options) heartbeat() time.Duration {
	if o.Heartbeat > 0 {
		return o.Heartbeat
	}
	return heartbeat
}

func (o Options) generateStacks(
	ctx context.Context, run protocol.Run, dir string, bases map[string]string, log *slog.Logger,
) {
	if !run.Spec.Diffs {
		return
	}

	checking := stackcheck.Options{Dir: dir, RunAs: o.AgentUser, Log: log, Env: o.ProxyEnv}

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

		if err := o.Journal.GenerateChangeStack(ctx, run.ID, checkout.Path, diff, bases[checkout.Path]); err != nil {
			log.Warn("could not hand over what a run changed", "path", checkout.Path, "error", err)
			continue
		}

		log.Info("generating a change stack", "path", checkout.Path)
	}
}

func open(ctx context.Context, harness *acp.Client, previous string, log *slog.Logger) (string, error) {
	if previous != "" {
		err := harness.Resume(ctx, previous)
		if err == nil {
			log.Info("resumed", "session", previous)
			return previous, nil
		}
		if !acp.IsSessionNotFound(err) {
			return "", fmt.Errorf("resume the session: %w", err)
		}
		log.Warn("the harness no longer has that session", "session", previous)
	}

	sessionID, err := harness.NewSession(ctx)
	if err != nil {
		return "", fmt.Errorf("open a session: %w", err)
	}

	return sessionID, nil
}

func answerPermissions(
	run protocol.Run, lease Journal, journal *journalWriter, escalated *atomic.Bool, log *slog.Logger,
) acp.Permission {
	askKinds := run.Spec.HarnessSetup.AskKinds

	return func(ctx context.Context, asked acp.Asked) acp.Verdict {
		verdict := decide(ctx, run, askKinds, lease, escalated, log, asked)
		if verdict != acp.Allow && asked.ToolCallID != "" {
			journal.append(protocol.Event{Type: protocol.EventToolRefused, Data: refusedCall(asked.ToolCallID)})
		}
		return verdict
	}
}

func refusedCall(toolCallID string) []byte {
	data, _ := json.Marshal(struct {
		ToolCallID string `json:"toolCallId"`
	}{toolCallID})
	return data
}

func decide(
	ctx context.Context, run protocol.Run, askKinds []string, lease Journal, escalated *atomic.Bool, log *slog.Logger, asked acp.Asked,
) acp.Verdict {
	if !slices.Contains(askKinds, asked.Kind) {
		return acp.Allow
	}

	if escalated.Load() {
		return acp.Cancel
	}

	answer, err := lease.AskPermission(ctx, run.ID, protocol.PermissionRequest{
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
	case protocol.PermissionEscalated:
		escalated.Store(true)
		return acp.Cancel
	default:
		return acp.Reject
	}
}

func serversOf(configured []protocol.McpServer) []acp.McpServer {
	servers := make([]acp.McpServer, 0, len(configured))
	for _, server := range configured {
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

const memoryFolder = ".spotlight/memory"

const unreadMemory = "The team's memory could not be read for this run, so nothing is written here.\n"

func writeMemoryFiles(ctx context.Context, journal Journal, runID string, space *workspace.Workspace, log *slog.Logger) {
	files, err := journal.MemoryFiles(ctx, runID)
	if err != nil {
		log.Warn("could not read what the team remembers", "error", err)
		files = []protocol.MemoryFile{{Path: memoryFolder + "/README.md", Body: unreadMemory}}
	}

	written := make([]string, 0, len(files))
	for _, file := range files {
		if strings.HasPrefix(filepath.Clean(file.Path), memoryFolder+string(filepath.Separator)) {
			written = append(written, filepath.Clean(file.Path))
		} else {
			log.Warn("left out a memory file outside the memory folder", "path", file.Path)
		}
	}

	if err := space.Prune(memoryFolder, written); err != nil {
		if err := space.Remove(memoryFolder); err != nil {
			log.Warn("could not clear the memory folder", "error", err)
			return
		}
	}

	for _, file := range files {
		if !slices.Contains(written, filepath.Clean(file.Path)) {
			continue
		}
		if err := space.Replace(file.Path, nil, writing(file.Body)); err != nil {
			log.Warn("could not write a memory file", "path", file.Path, "error", err)
		}
	}
}

const skillFile = "SKILL.md"

func skillHomes(named []string, skills []protocol.SkillFile) map[string][]string {
	candidates := make([]string, 0, len(named)+len(skills))
	for _, home := range named {
		candidates = append(candidates, filepath.Clean(home))
	}
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

func writeSkill(space *workspace.Workspace, skill protocol.SkillFile) error {
	if err := space.Replace(skill.Path, nil, writing(skill.Text)); err != nil {
		return fmt.Errorf("write skill %s: %w", skill.Path, err)
	}

	return nil
}

func setUp(space *workspace.Workspace, file protocol.SetupFile) error {
	if !filepath.IsLocal(file.Path) {
		return fmt.Errorf("harness file %q escapes the state directory", file.Path)
	}

	if err := space.Replace(filepath.Join(workspace.StatePath, file.Path), nil, writing(file.Text)); err != nil {
		return fmt.Errorf("write harness file %s: %w", file.Path, err)
	}

	return nil
}

func unset(space *workspace.Workspace, path string, files []protocol.SetupFile) error {
	if !filepath.IsLocal(path) {
		return fmt.Errorf("harness file %q escapes the state directory", path)
	}

	if slices.ContainsFunc(files, func(file protocol.SetupFile) bool {
		return filepath.Clean(file.Path) == filepath.Clean(path)
	}) {
		return nil
	}

	if err := space.Remove(filepath.Join(workspace.StatePath, path)); err != nil {
		return fmt.Errorf("clear harness file %s: %w", path, err)
	}

	return nil
}

func writing(text string) func(io.Writer) error {
	return func(into io.Writer) error {
		_, err := io.WriteString(into, text)
		return err
	}
}

func setupFailed(
	ctx context.Context,
	runID string,
	journal *journalWriter,
	lifecycle *progress,
	reporter Journal,
	log *slog.Logger,
	cause error,
) error {
	return failed(ctx, runID, journal, lifecycle, reporter, log, cause, true)
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
	return failed(ctx, runID, journal, lifecycle, reporter, log, cause, false)
}

func failed(
	ctx context.Context,
	runID string,
	journal *journalWriter,
	lifecycle *progress,
	reporter Journal,
	log *slog.Logger,
	cause error,
	beforeHandover bool,
) error {
	if err := lifecycle.advance(Errored); err != nil {
		log.Warn("could not mark the run failed", "error", err)
	}

	telemetry.Report(cause, telemetry.Tags{"run": runID})
	message := failureOf(cause, beforeHandover)

	journal.append(protocol.Event{
		Type:    protocol.EventFailed,
		Message: message,
	})
	journal.flush(ctx)

	if _, err := reporter.Complete(ctx, runID, protocol.Completion{
		ExitCode:    -1,
		Failed:      true,
		SetupFailed: beforeHandover,
		Message:     message,
	}); err != nil {
		log.Warn("could not report the failure", "error", err)
	}

	return cause
}

func failureOf(cause error, beforeHandover bool) string {
	if beforeHandover {
		return "The runner couldn't prepare the run. Error: " + cause.Error()
	}
	return "The runner couldn't start the agent. Error: " + cause.Error()
}

type progress struct {
	state State
}

func (p *progress) advance(trigger Trigger) error {
	next, err := Next(p.state, trigger)
	if err != nil {
		return err
	}
	p.state = next
	return nil
}

func (p *progress) note(trigger Trigger, log *slog.Logger) {
	if err := p.advance(trigger); err != nil {
		log.Warn("the run's lifecycle went astray", "error", err)
	}
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

func (o Options) checkEgress(ctx context.Context, journal *journalWriter) {
	if o.Enforced == nil {
		return
	}

	checked, err := json.Marshal(protocol.EgressCheckResult{Enforced: o.Enforced(ctx)})
	if err != nil {
		return
	}
	journal.append(protocol.Event{Type: protocol.EventEgressChecked, Data: checked})
}

func (o Options) setUp(
	ctx context.Context, dir string, checkouts []protocol.Checkout, journal *journalWriter, log *slog.Logger,
) {
	for _, checkout := range checkouts {
		if checkout.Setup == "" {
			continue
		}

		output, err := prepare.Setup(ctx, filepath.Join(dir, checkout.Path), checkout.Setup, o.AgentUser, o.SetupTimeout, o.ProxyEnv)
		if err != nil {
			log.Warn("could not set up a checkout", "path", checkout.Path, "error", err)
			output = strings.TrimSpace(fmt.Sprintf("%s\n\nSetup failed for %s. Error: %v", output, checkout.Path, err))
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

func recall(ctx context.Context, journal Journal, runID string, request protocol.RecallRequest) (json.RawMessage, error) {
	if request.Handle != "" {
		return journal.RecallMemory(ctx, runID, request.Handle)
	}
	return journal.RecallMemories(ctx, runID, request.Words)
}

func checkedOutPaths(dir string, checkouts []protocol.Checkout, requested []string) ([]string, error) {
	roots := []string{filepath.Clean(dir)}
	if resolved, err := filepath.EvalSymlinks(dir); err == nil && resolved != roots[0] {
		roots = append(roots, resolved)
	}

	within := make([]string, 0, len(requested))
	for _, raw := range requested {
		found, ok := checkedOutPath(roots, checkouts, raw)
		if !ok {
			return nil, &agentapi.Error{Because: fmt.Sprintf(
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

const (
	APIURLVar   = "SPOTLIGHT_URL"
	APITokenVar = "SPOTLIGHT_API_TOKEN"
)

func usesAPI(spec protocol.Spec, controlPlane string) map[string]string {
	if !spec.SpotlightAPI || controlPlane == "" {
		return nil
	}

	return map[string]string{APIURLVar: controlPlane, APITokenVar: protocol.SpotlightAPIStandIn}
}

func granted(
	env map[string]string, channel *agentapi.Server, state, telemetry string, api map[string]string,
) map[string]string {
	places := map[string]string{StateVar: state, TelemetryVar: telemetry}

	granted := make(map[string]string, len(env)+3)
	for key, value := range env {
		granted[key] = os.Expand(value, func(name string) string { return places[name] })
	}

	maps.Copy(granted, api)
	granted[protocol.AgentAPIURLVar] = channel.URL()
	granted[protocol.AgentAPITokenVar] = channel.Token()
	granted[StateVar] = state

	return granted
}

func viaGitProxy(checkouts []protocol.Checkout, remote string) []protocol.Checkout {
	resolved := make([]protocol.Checkout, len(checkouts))

	for at, checkout := range checkouts {
		resolved[at] = checkout
		if checkout.Remote == protocol.RemoteViaGitProxy {
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
