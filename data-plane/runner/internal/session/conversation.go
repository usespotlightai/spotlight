package session

import (
	"context"
	"errors"
	"log/slog"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"usespotlight.ai/data-plane/protocol"
	"usespotlight.ai/data-plane/runner/internal/acp"
)

type conversation struct {
	run          protocol.Run
	harness      *acp.Client
	sessionID    string
	journal      *journalWriter
	control      Journal
	archiver     *archiver
	lifecycle    *progress
	takeHandover func() *protocol.Handover
	attached     func(context.Context, protocol.Attachment) error
	escalated    *atomic.Bool
	handOver     func(context.Context)
	closed       bool
	heartbeat    time.Duration
	answerWait   time.Duration
	log          *slog.Logger

	stopped chan struct{}
	lost    chan struct{}
	losing  sync.Once
}

const maxUnreadAnswers = 3

const carryOn = "The runner working on this was lost before your turn ended. Carry on where you left off."

type lostRun interface {
	RunNoLongerLeased() bool
}

type wake int

const (
	answered wake = iota
	stopRequested
	released
)

func (c *conversation) opening(ctx context.Context) string {
	briefing := c.run.Spec.Briefing
	if !c.run.Spec.Continuity.Resumes {
		return briefing
	}

	resumed := c.sessionID == c.run.Spec.Continuity.SessionID
	message, received := c.pollMessages(ctx)
	switch {
	case received && resumed:
		return message
	case received:
		return briefing + "\n\n" + message
	case resumed:
		return carryOn
	default:
		return briefing
	}
}

func (c *conversation) work(ctx context.Context, prompt string) (bool, error) {
	renewing, stopRenewing := context.WithCancel(ctx)
	defer stopRenewing()
	go renew(renewing, c.control, c.run.ID, c.heartbeat, c.log, c.stop, c.lose)

	flushing, stopFlushing := context.WithCancel(ctx)
	defer stopFlushing()
	go stream(flushing, c.journal)

	for {
		waiting, err := c.complete(ctx, c.converse(ctx, prompt))
		if err != nil || !waiting {
			return false, err
		}

		c.lifecycle.note(PersonAsked, c.log)
		c.log.Info("waiting warm for a person to answer", "for", c.answerWait)

		message, woke := c.await(ctx)
		switch woke {
		case released:
			c.lifecycle.note(RunSuspended, c.log)
			return true, nil
		case stopRequested:
			_, err := c.complete(ctx, 0)
			return false, err
		}

		c.lifecycle.note(PersonAnswered, c.log)
		c.escalated.Store(false)
		prompt = message
	}
}

func (c *conversation) converse(ctx context.Context, prompt string) int {
	steered, resent := false, false

	for {
		turn, endTurn := context.WithCancel(ctx)
		go c.steer(turn)

		updates := 0
		result, err := c.harness.Prompt(ctx, c.sessionID, prompt, func(update acp.Update) {
			updates++
			c.journal.append(protocol.Event{
				Type: protocol.EventOutput,
				Data: update.Raw,
			})
		})
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
			prompt = message
			continue
		}

		if err != nil {
			c.log.Warn("the agent stopped short", "error", err)
			return -1
		}

		c.log.Info("turn finished", "stopReason", result.StopReason)

		// A harness can end the turn immediately after a cancel and not read the prompt.
		if steered && !resent && updates == 0 && result.StopReason == "end_turn" {
			c.log.Info("the harness did not read the message; sending it again")
			resent = true
			continue
		}
		steered, resent = result.StopReason == "cancelled", false

		if result.StopReason != "end_turn" &&
			result.StopReason != "max_tokens" &&
			result.StopReason != "cancelled" {
			return 1
		}

		message, receivedMore := c.pollMessages(ctx)
		if !receivedMore {
			return 0
		}
		prompt = message
	}
}

func (c *conversation) complete(ctx context.Context, exitCode int) (waiting bool, err error) {
	stopped := c.stopWasRequested()
	turn := protocol.Completion{
		ExitCode:  exitCode,
		Failed:    !stopped && exitCode != 0,
		Stopped:   stopped,
		Handover:  c.takeHandover(),
		SessionID: c.sessionID,
	}

	awaits, err := c.control.AwaitsPerson(ctx, c.run.ID, turn)
	if err != nil {
		c.log.Warn("could not read whether the turn waits for a person; ending it as the run ends", "error", err)
	}
	if !awaits {
		c.close()
	}

	turn.Archived = c.archiver.archive(ctx)
	c.journal.flush(ctx)

	if c.handOver != nil && !stopped {
		c.handOver(ctx)
		c.handOver = nil
	}

	completed, err := c.control.Complete(ctx, c.run.ID, turn)
	if err != nil {
		return false, err
	}

	c.log.Info("turn reported", "exitCode", exitCode, "stopped", stopped, "waiting", completed.Waiting)
	return completed.Waiting && !stopped, nil
}

func (c *conversation) close() {
	c.closed = true
	_ = c.harness.Close()
}

func (c *conversation) lose() {
	c.losing.Do(func() { close(c.lost) })
}

func (c *conversation) await(ctx context.Context) (string, wake) {
	wait := c.answerWait
	if c.closed {
		wait = 0
	}
	grace := time.NewTimer(wait)
	defer grace.Stop()
	unread := 0

	listening := time.NewTicker(c.heartbeat)
	defer listening.Stop()

	for {
		select {
		case <-ctx.Done():
			c.log.Info("the runner is stopping; the run is suspended once its lease expires")
			return "", released
		case <-c.stopped:
			return "", stopRequested
		case <-c.lost:
			c.log.Info("the run is no longer this runner's; releasing the sandbox")
			return "", released
		case <-listening.C:
			if c.closed {
				continue
			}
			if message, received := c.pollMessages(ctx); received {
				return message, answered
			}
		case <-grace.C:
			suspension, err := c.control.Suspend(ctx, c.run.ID, false)
			if err != nil {
				c.log.Warn("could not suspend the run; it is suspended once its lease expires", "error", err)
				return "", released
			}
			if suspension.Suspended {
				c.log.Info("nobody answered in time; the run is suspended")
				return "", released
			}

			if c.closed {
				c.log.Info("answered while suspending a run whose harness has closed; it is requeued for the next runner")
				if _, err := c.control.Suspend(ctx, c.run.ID, true); err != nil {
					c.log.Warn("could not requeue the run; a runner claims it again once its lease expires", "error", err)
				}
				return "", released
			}

			c.log.Info("answered while suspending")
			if message, received := c.pollMessages(ctx); received {
				return message, answered
			}
			if unread++; unread >= maxUnreadAnswers {
				c.log.Warn("the run works again, but no message is there to read; releasing it")
				return "", released
			}
			grace.Reset(max(c.answerWait, c.heartbeat))
		}
	}
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
