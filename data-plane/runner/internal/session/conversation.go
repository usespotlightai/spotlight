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
	run         protocol.Run
	harness     *acp.Client
	sessionID   string
	journal     *journalWriter
	control     Journal
	keeper      *keeper
	lifecycle   *progress
	declared    func() *protocol.Outcome
	attached    func(context.Context, protocol.Attachment) error
	putToPerson *atomic.Bool
	handOver    func(context.Context)
	closed      bool
	heartbeat   time.Duration
	answerWait  time.Duration
	log         *slog.Logger

	stopped chan struct{}
	lost    chan struct{}
	losing  sync.Once
}

const unheardParkings = 3

const carryOn = "The runner working on this was lost before your turn ended. Carry on where you left off."

type lostRun interface {
	Lost() bool
}

type wake int

const (
	answered wake = iota
	toldToStop
	letGo
)

func (c *conversation) opening(ctx context.Context) string {
	briefing := c.run.Spec.Briefing
	if !c.run.Spec.Continuity.Resumes {
		return briefing
	}

	resumed := c.sessionID == c.run.Spec.Continuity.SessionID
	said, heard := c.hear(ctx)
	switch {
	case heard && resumed:
		return said
	case heard:
		return briefing + "\n\n" + said
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

		said, woke := c.await(ctx)
		switch woke {
		case letGo:
			c.lifecycle.note(RunParked, c.log)
			return true, nil
		case toldToStop:
			_, err := c.complete(ctx, 0)
			return false, err
		}

		c.lifecycle.note(PersonAnswered, c.log)
		c.putToPerson.Store(false)
		prompt = said
	}
}

func (c *conversation) converse(ctx context.Context, prompt string) int {
	steered, resaid := false, false

	for {
		turn, endTurn := context.WithCancel(ctx)
		go c.steer(turn)

		heard := 0
		result, err := c.harness.Prompt(ctx, c.sessionID, prompt, func(update acp.Update) {
			heard++
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

		if c.told() {
			return 0
		}

		if c.putToPerson.Load() {
			if replays(c.run) {
				c.log.Info("a replay asked a person for permission; it ends there")
				return 0
			}

			said, answered := c.hear(ctx)
			if !answered {
				c.log.Info("a person was asked for permission; the turn ends")
				return 0
			}
			c.putToPerson.Store(false)
			prompt = said
			continue
		}

		if err != nil {
			c.log.Warn("the agent stopped short", "error", err)
			return -1
		}

		c.log.Info("turn finished", "stopReason", result.StopReason)

		// A harness can end the turn immediately after a cancel and not read the prompt.
		if steered && !resaid && heard == 0 && result.StopReason == "end_turn" {
			c.log.Info("the harness let what was said go unread; saying it again")
			resaid = true
			continue
		}
		steered, resaid = result.StopReason == "cancelled", false

		if result.StopReason != "end_turn" &&
			result.StopReason != "max_tokens" &&
			result.StopReason != "cancelled" {
			return 1
		}

		said, heardMore := c.hear(ctx)
		if !heardMore {
			return 0
		}
		prompt = said
	}
}

func (c *conversation) complete(ctx context.Context, exitCode int) (waiting bool, err error) {
	stopped := c.told()
	turn := protocol.Completion{
		ExitCode:  exitCode,
		Failed:    !stopped && exitCode != 0,
		Stopped:   stopped,
		Outcome:   c.declared(),
		SessionID: c.sessionID,
	}

	asks, err := c.control.Asks(ctx, c.run.ID, turn)
	if err != nil {
		c.log.Warn("could not ask whether the turn waits for a person; ending it as the run ends", "error", err)
	}
	if !asks {
		c.close()
	}

	turn.Kept = c.keeper.keep(ctx)
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
	unheard := 0

	listening := time.NewTicker(c.heartbeat)
	defer listening.Stop()

	for {
		select {
		case <-ctx.Done():
			c.log.Info("the runner is stopping; the run is parked once its lease lapses")
			return "", letGo
		case <-c.stopped:
			return "", toldToStop
		case <-c.lost:
			c.log.Info("the run is no longer this runner's; letting the sandbox go")
			return "", letGo
		case <-listening.C:
			if c.closed {
				continue
			}
			if said, heard := c.hear(ctx); heard {
				return said, answered
			}
		case <-grace.C:
			parking, err := c.control.Park(ctx, c.run.ID, false)
			if err != nil {
				c.log.Warn("could not park the run; it is parked once its lease lapses", "error", err)
				return "", letGo
			}
			if parking.Parked {
				c.log.Info("nobody answered in time; the run is parked")
				return "", letGo
			}

			if c.closed {
				c.log.Info("answered while parking a run whose harness has closed; it goes back on the queue for the next runner")
				if _, err := c.control.Park(ctx, c.run.ID, true); err != nil {
					c.log.Warn("could not hand the run back; it is taken up again once its lease lapses", "error", err)
				}
				return "", letGo
			}

			c.log.Info("answered while parking")
			if said, heard := c.hear(ctx); heard {
				return said, answered
			}
			if unheard++; unheard >= unheardParkings {
				c.log.Warn("told the run works again, yet nothing is there to hear; letting it go")
				return "", letGo
			}
			grace.Reset(max(c.answerWait, c.heartbeat))
		}
	}
}

func (c *conversation) hear(ctx context.Context) (string, bool) {
	said, err := c.control.Said(ctx, c.run.ID)
	if err != nil {
		c.log.Warn("could not read what was said", "error", err)
		return "", false
	}
	if len(said) == 0 {
		return "", false
	}

	bodies := make([]string, 0, len(said))
	for _, each := range said {
		for _, attachment := range each.Attachments {
			if err := c.attached(ctx, attachment); err != nil {
				c.log.Warn("could not fetch what was attached", "error", err)
			}
		}
		bodies = append(bodies, each.Body)
	}

	upTo := said[len(said)-1].Position
	if err := c.control.Delivered(ctx, c.run.ID, upTo); err != nil {
		c.log.Warn("could not mark what was said delivered", "error", err)
		return "", false
	}

	c.log.Info("a person said something", "upTo", upTo)
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
			said, err := c.control.Said(ctx, c.run.ID)
			if err != nil {
				if ctx.Err() == nil {
					c.log.Warn("could not look for anything said", "error", err)
				}
				continue
			}
			if len(said) > 0 {
				c.log.Info("a person spoke mid-turn; steering")
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

func (c *conversation) told() bool {
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
			if errors.As(err, &lost) && lost.Lost() {
				log.Info("the run is no longer held by this runner", "error", err)
				onLost()
				return
			}
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
