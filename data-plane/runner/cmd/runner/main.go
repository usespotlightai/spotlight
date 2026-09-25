package main

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"os"
	"os/signal"
	"syscall"

	"usespotlight.ai/data-plane/internal/control"
	"usespotlight.ai/data-plane/internal/protocol"
	"usespotlight.ai/data-plane/runner/internal/account"
	"usespotlight.ai/data-plane/runner/internal/config"
	"usespotlight.ai/data-plane/runner/internal/gitproxy"
	"usespotlight.ai/data-plane/runner/internal/harness"
	"usespotlight.ai/data-plane/runner/internal/session"
	"usespotlight.ai/data-plane/runner/internal/stackcheck"
)

var version = "dev"

func main() {
	if args := os.Args[1:]; len(args) == 2 && args[0] == "harnesses" {
		if err := report(args[1], os.Stdout); err != nil {
			fmt.Fprintln(os.Stderr, err)
			os.Exit(1)
		}
		return
	}

	if err := run(); err != nil {
		slog.Error("runner stopped", "error", err)
		os.Exit(1)
	}
}

func report(asked string, out io.Writer) error {
	var candidates []protocol.Installable
	if err := json.Unmarshal([]byte(asked), &candidates); err != nil {
		return fmt.Errorf("read the harnesses to look for: %w", err)
	}

	return json.NewEncoder(out).Encode(protocol.Registration{
		Release:   version,
		Harnesses: harness.Installed(context.Background(), candidates),
	})
}

func run() error {
	log := slog.New(slog.NewJSONHandler(os.Stdout, nil))
	slog.SetDefault(log)

	ctx, stop := signal.NotifyContext(
		context.Background(),
		syscall.SIGINT,
		syscall.SIGTERM,
	)
	defer stop()

	cfg, err := config.Load(os.Args[1:])
	if err != nil {
		return err
	}

	agentUser, err := account.LookupUser(cfg.AgentUser)
	if err != nil {
		return err
	}

	handed, err := given(ctx, cfg, log)
	if err != nil {
		return err
	}
	if handed == nil {
		log.Info("runner stopped with no work")
		return nil
	}

	client, err := control.Seated(cfg.URL, *handed)
	if err != nil {
		return err
	}

	r := runner{cfg: cfg, agentUser: agentUser, log: log.With("runner", client.RunnerID())}
	r.serve(ctx, client, handed.Work)

	r.log.Info("runner stopped")
	return nil
}

type runner struct {
	cfg       config.Config
	agentUser *account.User
	log       *slog.Logger
}

func (r runner) serve(ctx context.Context, client *control.Client, work protocol.Claimed) {
	switch {
	case work.Kind == protocol.ClaimedRun && work.Run != nil:
		r.log.Info("running", "run", work.Run.ID)
		if err := session.Execute(ctx, *work.Run, session.Options{
			Workspace:    r.cfg.Workspace,
			Journal:      client,
			Log:          r.log,
			AgentUser:    r.agentUser,
			Author:       r.cfg.Author,
			Mirrors:      os.Getenv("SPOTLIGHT_MIRRORS"),
			ControlPlane: r.cfg.URL,
			Token:        client.Token(),
		}); err != nil {
			r.log.Error("run failed", "run", work.Run.ID, "error", err)
		}
	case work.Kind == protocol.ClaimedCheck && work.Check != nil:
		r.check(ctx, client, *work.Check)
	default:
		r.log.Warn("was handed something it does not know how to do", "kind", work.Kind)
	}
}

func (r runner) check(ctx context.Context, client *control.Client, claimed protocol.StackCheck) {
	log := r.log.With("stack", claimed.StackID, "run", claimed.RunID)
	log.Info("checking a change stack")

	serving, err := gitproxy.Serve(r.cfg.URL, client.Token(), claimed.RunID)
	if err != nil {
		log.Warn("could not serve git for a check", "error", err)
		return
	}
	defer func() {
		if err := serving.Close(); err != nil {
			log.Warn("could not stop serving git", "error", err)
		}
	}()

	stackcheck.Perform(ctx, client, claimed, stackcheck.Options{
		Dir:     r.cfg.Workspace,
		Remote:  serving.Remote,
		Mirrors: os.Getenv("SPOTLIGHT_MIRRORS"),
		RunAs:   r.agentUser,
		Log:     log,
	})
}
