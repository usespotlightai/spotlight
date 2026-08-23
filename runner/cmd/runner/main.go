// Command runner claims one run at a time from the control plane, supervises
// the agent CLI that serves it, and exits.
package main

import (
	"context"
	"log/slog"
	"os"
	"os/signal"
	"syscall"

	"usespotlight.ai/runner/internal/config"
	"usespotlight.ai/runner/internal/control"
	"usespotlight.ai/runner/internal/protocol"
	"usespotlight.ai/runner/internal/session"
	"usespotlight.ai/runner/internal/terminal"
)

func main() {
	if err := run(); err != nil {
		slog.Error("runner stopped", "error", err)
		os.Exit(1)
	}
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

	cfg, err := config.Load()
	if err != nil {
		return err
	}

	client, err := control.New(cfg.URL, cfg.Token)
	if err != nil {
		return err
	}

	// Resolved before claiming anything: a misconfigured agent user should
	// stop the runner, not surface once a run is already in flight.
	agentUser, err := terminal.LookupUser(cfg.AgentUser)
	if err != nil {
		return err
	}

	// Waiting rather than exiting: the control plane may not be up yet, and a
	// runner that dies for that reason just gets restarted into the same wait.
	if err := control.Register(ctx, client, protocol.Registration{
		Pool:     cfg.Pool,
		Labels:   cfg.Labels,
		Capacity: 1,
	}, log); err != nil {
		log.Info("runner stopped before registering")
		return nil
	}

	log = log.With("runner", client.RunnerID())
	log.Info("registered",
		"pool", cfg.Pool,
		"agentUser", cfg.AgentUser,
		"workspace", cfg.WorkspaceRoot,
		"labels", cfg.Labels,
	)

	err = control.Poll(
		ctx,
		client,
		control.Limits{
			MaxRuns:     cfg.MaxRuns,
			IdleTimeout: cfg.IdleTimeout,
			RetireAt:    cfg.RetireAt,
		},
		log,
		func(ctx context.Context, claimed protocol.Run) {
			if err := session.Execute(ctx, claimed, session.Options{
				WorkspaceRoot: cfg.WorkspaceRoot,
				Journal:       client,
				Log:           log,
				AgentUser:     agentUser,
				PrepareHook:   cfg.PrepareHook,
				PublishHook:   cfg.PublishHook,
				HookTimeout:   cfg.HookTimeout,
			}); err != nil {
				log.Error("run failed", "run", claimed.ID, "error", err)
			}
		},
	)
	if err != nil {
		return err
	}

	log.Info("runner stopped")
	return nil
}
