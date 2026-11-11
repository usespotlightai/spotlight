package session

import (
	"cmp"
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"strings"
	"sync/atomic"
	"time"

	"usespotlight.ai/data-plane/protocol"
	"usespotlight.ai/data-plane/runner/internal/workspace"
)

type conversation struct {
	run          protocol.Run
	harness      Harness
	sessionID    string
	joined       []string
	unready      []setupFailure
	journal      *journalWriter
	control      Journal
	archiver     *archiver
	lifecycle    *progress
	takeHandover func() *protocol.Handover
	handover     *protocol.Handover
	attached     func(context.Context, protocol.Attachment) error
	escalated    *atomic.Bool
	handOver     func(context.Context)
	heartbeat    time.Duration
	waitLimit    time.Duration
	keepLost     func([]workspace.LostTask)
	lost         []workspace.LostTask
	log          *slog.Logger
	updates      atomic.Int64
	leaseLost    atomic.Bool

	stopped chan struct{}
}

const resumeAfterLostRunner = "The runner working on this was lost before your turn ended. Carry on where you left off."

const turnEndedWithoutHandover = "Your turn ended without a handover. The run ends when your next turn ends. " +
	"Hand over with `spotlight handover`. To ask a person, hand over to `review`."

func reminder(still []protocol.BackgroundTask) string {
	if len(still) == 0 {
		return turnEndedWithoutHandover
	}
	return "Your turn ended without a handover. These background tasks still run: " + described(lostOf(still)) + ". " +
		"The run ends when your next turn ends, and these tasks stop with it. " +
		"Wait for them in this turn, stop them, or hand over with `spotlight handover`. To ask a person, hand over to `review`."
}

func lostOf(items []protocol.BackgroundTask) []workspace.LostTask {
	tasks := make([]workspace.LostTask, 0, len(items))
	for _, item := range items {
		tasks = append(tasks, workspace.LostTask{Kind: string(item.Kind), Description: item.Description})
	}
	return tasks
}

type lostRun interface {
	RunNoLongerLeased() bool
}

func (c *conversation) opening(ctx context.Context) string {
	return unreadyNote(c.unready) + lostNote(c.lost) + c.request(ctx)
}

func lostNote(tasks []workspace.LostTask) string {
	if len(tasks) == 0 {
		return ""
	}
	return "These background tasks stopped when your last sandbox stopped: " + described(tasks) + ". Run them again if you still need them.\n\n"
}

func described(tasks []workspace.LostTask) string {
	named := make([]string, 0, len(tasks))
	for _, task := range tasks {
		named = append(named, cmp.Or(task.Description, task.Kind))
	}
	return strings.Join(named, "; ")
}

func (c *conversation) request(ctx context.Context) string {
	briefing := c.run.Spec.Briefing
	if !c.run.Spec.Resume.ResumeSession {
		return briefing
	}

	resumed := c.sessionID == c.run.Spec.Resume.SessionID
	message, received := c.pollMessages(ctx)
	switch {
	case received && resumed:
		return newRepositoriesNote(c.joined) + message
	case received:
		return briefing + "\n\n" + message
	case resumed:
		return newRepositoriesNote(c.joined) + resumeAfterLostRunner
	default:
		return briefing
	}
}

func newRepositoriesNote(folders []string) string {
	if len(folders) == 0 {
		return ""
	}
	return "The workspace has repositories that it did not have before: " + strings.Join(folders, ", ") + ". Each is a folder in the workspace.\n\n"
}

func (c *conversation) work(ctx context.Context, prompt string) error {
	renewing, stopRenewing := context.WithCancel(ctx)
	defer stopRenewing()
	go renew(renewing, c.control, c.run.ID, c.heartbeat, c.log, c.stop, func() { c.leaseLost.Store(true) })

	flushing, stopFlushing := context.WithCancel(ctx)
	defer stopFlushing()
	go stream(flushing, c.journal)

	return c.complete(ctx, c.converse(ctx, prompt))
}

func (c *conversation) converse(ctx context.Context, prompt string) int {
	steered, resent, nudged := false, false, false
	var waitUntil time.Time

	c.harness.Watch(func(update Update) {
		c.updates.Add(1)
		c.journal.append(protocol.Event{Type: protocol.EventOutput, Data: update.Raw})
	})

	for {
		turn, endTurn := context.WithCancel(ctx)
		go c.steer(turn)

		c.updates.Store(0)
		result, err := c.harness.Prompt(ctx, c.sessionID, prompt)
		updates := c.updates.Load()
		endTurn()

		if err == nil && result.Used() {
			c.journal.append(protocol.Event{Type: protocol.EventUsage, Data: result.Usage})
		}
		c.journal.flush(ctx)

		if c.stopWasRequested() {
			return 0
		}

		if c.escalated.Load() {
			if replays(c.run) {
				c.log.Info("a replay asked a person for permission; it ends there")
				return 0
			}

			message, received := c.pollMessages(ctx)
			if !received {
				c.log.Info("a person was asked for permission; the turn ends")
				return 0
			}
			c.escalated.Store(false)
			prompt, nudged, waitUntil = message, false, time.Time{}
			continue
		}

		if err != nil {
			c.log.Warn("the agent stopped short", "error", err)
			return -1
		}

		c.log.Info("turn finished", "stopReason", result.Reason)

		// A harness can end the turn immediately after a cancel and not read the prompt.
		if steered && !resent && updates == 0 && result.End == TurnEnded {
			c.log.Info("the harness did not read the message; sending it again")
			resent = true
			continue
		}
		steered, resent = result.End == TurnCancelled, false

		if result.End == TurnFailed {
			return 1
		}

		message, receivedMore := c.pollMessages(ctx)
		if receivedMore {
			prompt, nudged, waitUntil = message, false, time.Time{}
			continue
		}

		if nudged || result.End == TurnCancelled || !c.owesHandover() {
			return 0
		}

		if waitUntil.IsZero() {
			waitUntil = time.Now().Add(c.waitLimit)
		}
		waited := c.waitForBackground(ctx, waitUntil)
		switch {
		case waited.gone:
			c.log.Warn("the agent stopped while the run waited for its background work")
			return -1
		case waited.stop:
			return 0
		case waited.message != "":
			prompt, nudged, waitUntil = waited.message, false, time.Time{}
			continue
		case !c.owesHandover():
			return 0
		}

		c.log.Info("the turn ended without a handover; asking the agent once for one", "stillRunning", len(waited.still))
		text := reminder(waited.still)
		c.journal.append(protocol.Event{Type: protocol.EventAgentReminded, Message: text})
		prompt, nudged = text, true
	}
}

type waited struct {
	stop    bool
	gone    bool
	message string
	still   []protocol.BackgroundTask
}

func (c *conversation) waitForBackground(ctx context.Context, until time.Time) waited {
	started := c.harness.Current()
	if len(started.Background) > 0 {
		deadline := until.UTC()
		c.recordBackground(protocol.EventBackgroundWait, protocol.BackgroundWork{Tasks: started.Background, Until: &deadline})
	}

	for {
		step, cancel := context.WithDeadline(ctx, earliest(until, time.Now().Add(c.heartbeat)))
		work, settled := c.harness.Settle(step)
		cancel()

		switch {
		case work.Gone:
			c.settledBackground(started, protocol.WaitGone)
			return waited{gone: true}
		case c.stopWasRequested(), ctx.Err() != nil, c.escalated.Load(), c.leaseLost.Load():
			c.settledBackground(started, protocol.WaitStopped)
			return waited{stop: true}
		case !c.owesHandover():
			c.settledBackground(started, protocol.WaitHandedOver)
			return waited{}
		case settled:
			c.settledBackground(started, protocol.WaitSettled)
			return waited{still: work.Background}
		case !time.Now().Before(until):
			c.log.Info("background work still runs at the wait limit", "tasks", len(work.Background))
			c.settledBackground(started, protocol.WaitLimit)
			return waited{still: work.Background}
		}

		if message, received := c.pollMessages(ctx); received {
			c.settledBackground(started, protocol.WaitMessage)
			return waited{message: message}
		}
	}
}

func (c *conversation) recordBackground(kind protocol.EventType, work protocol.BackgroundWork) {
	if work.Tasks == nil {
		work.Tasks = []protocol.BackgroundTask{}
	}
	raw, _ := json.Marshal(work)
	c.journal.append(protocol.Event{Type: kind, Data: raw})
}

func (c *conversation) settledBackground(started Work, ended protocol.WaitEnded) {
	if len(started.Background) > 0 {
		c.recordBackground(protocol.EventBackgroundDone, protocol.BackgroundWork{
			Tasks: c.harness.Current().Background,
			Ended: ended,
		})
	}
}

func earliest(a, b time.Time) time.Time {
	if a.Before(b) {
		return a
	}
	return b
}

func (c *conversation) owesHandover() bool {
	return len(c.run.Spec.Handover.Options) > 0 && !replays(c.run) && !searches(c.run) && !c.handedOver()
}

func (c *conversation) handedOver() bool {
	if handover := c.takeHandover(); handover != nil {
		c.handover = handover
	}
	return c.handover != nil
}

func (c *conversation) complete(ctx context.Context, exitCode int) error {
	if ctx.Err() != nil {
		return c.leave(ctx)
	}

	stopped := c.stopWasRequested()
	if stopped {
		c.journal.record(ctx, protocol.Event{Type: protocol.EventAgentStopped})
	}

	c.handedOver()
	c.leaveLostBehind()
	turn := protocol.Completion{
		ExitCode:  exitCode,
		Failed:    !stopped && exitCode != 0,
		Stopped:   stopped,
		Handover:  c.handover,
		SessionID: c.sessionID,
	}

	_ = c.harness.Close()
	c.archiver.archive(ctx)
	c.journal.flush(ctx)

	if c.handOver != nil && !stopped {
		c.handOver(ctx)
		c.handOver = nil
	}

	if err := c.control.Complete(ctx, c.run.ID, turn); err != nil {
		return err
	}

	c.log.Info("turn reported", "exitCode", exitCode, "stopped", stopped)
	return nil
}

func (c *conversation) leaveLostBehind() {
	still := c.harness.Current().Background
	if len(still) > 0 {
		c.recordBackground(protocol.EventBackgroundLost, protocol.BackgroundWork{Tasks: still})
	}
	if c.keepLost != nil {
		c.keepLost(lostOf(still))
	}
}

func (c *conversation) leave(ctx context.Context) error {
	c.leaveLostBehind()
	_ = c.harness.Close()
	c.archiver.archive(ctx)

	settled, cancel := settling(ctx)
	defer cancel()
	c.journal.flush(settled)

	c.log.Info("the runner is stopping; the workspace is kept for the run's next attempt")
	return ctx.Err()
}

func (c *conversation) pollMessages(ctx context.Context) (string, bool) {
	messages, err := c.control.Messages(ctx, c.run.ID)
	if err != nil {
		c.log.Warn("could not read the messages", "error", err)
		return "", false
	}
	if len(messages) == 0 {
		return "", false
	}

	bodies := make([]string, 0, len(messages))
	for _, each := range messages {
		for _, attachment := range each.Attachments {
			if err := c.attached(ctx, attachment); err != nil {
				c.log.Warn("could not fetch what was attached", "error", err)
			}
		}
		bodies = append(bodies, each.Body)
	}

	upTo := messages[len(messages)-1].Position
	if err := c.control.AckMessages(ctx, c.run.ID, upTo); err != nil {
		c.log.Warn("could not acknowledge the messages", "error", err)
		return "", false
	}

	c.log.Info("a person sent a message", "upTo", upTo)
	return strings.Join(bodies, "\n\n"), true
}

func (c *conversation) steer(ctx context.Context) {
	ticker := time.NewTicker(c.heartbeat)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			messages, err := c.control.Messages(ctx, c.run.ID)
			if err != nil {
				if ctx.Err() == nil {
					c.log.Warn("could not look for messages", "error", err)
				}
				continue
			}
			if len(messages) > 0 {
				c.log.Info("a person sent a message mid-turn; steering")
				if err := c.harness.Cancel(c.sessionID); err != nil {
					c.log.Warn("could not cancel the turn", "error", err)
				}
				return
			}
		}
	}
}

func (c *conversation) stop() {
	close(c.stopped)
	_ = c.harness.Close()
}

func (c *conversation) stopWasRequested() bool {
	select {
	case <-c.stopped:
		return true
	default:
		return false
	}
}

func renew(
	ctx context.Context,
	lease Journal,
	runID string,
	every time.Duration,
	log *slog.Logger,
	onStop func(),
	onLost func(),
) {
	ticker := time.NewTicker(every)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			stop, err := lease.RenewLease(ctx, runID)
			var lost lostRun
			if errors.As(err, &lost) && lost.RunNoLongerLeased() {
				log.Info("the run is no longer leased by this runner", "error", err)
				onLost()
				return
			}
			if err != nil {
				log.Warn("could not renew lease", "error", err)
				continue
			}
			if stop {
				log.Info("a person requested a stop")
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
