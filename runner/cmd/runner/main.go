// Command runner claims runs from the control plane and supervises the agent
// CLI that serves each one.
package main

import (
	"context"
	"log/slog"
	"os"
	"os/signal"
	"syscall"

	"usespotlight.ai/runner/internal/account"
	"usespotlight.ai/runner/internal/config"
	"usespotlight.ai/runner/internal/control"
	"usespotlight.ai/runner/internal/protocol"
	"usespotlight.ai/runner/internal/session"
	"usespotlight.ai/runner/internal/workspace"
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

	// Resolved up front so a bad agent user fails at startup, not mid-run.
	agentUser, err := account.LookupUser(cfg.AgentUser)
	if err != nil {
		return err
	}

	// The control plane may not be up yet. Waiting beats exiting into a
	// restart loop.
	if err := control.Register(ctx, client, 1, log); err != nil {
		log.Info("runner stopped before registering")
		return nil
	}

	log = log.With("runner", client.RunnerID())
	log.Info("registered",
		"agentUser", cfg.AgentUser,
		"workspace", cfg.WorkspaceRoot,
	)

	// Between runs is the only safe moment to dispose of workspaces, and the
	// only one needed: this serves one run at a time, so nothing here is
	// holding a directory. The sweep at startup clears what a crash left.
	sweep := func(ctx context.Context) {
		keep, err := client.Kept(ctx)
		if err != nil {
			// No answer is not an empty answer. Keeping too much costs disk;
			// deleting on a failed request would cost a task's work.
			log.Warn("could not ask what to keep, holding everything", "error", err)
			return
		}

		reaped, err := workspace.Reap(cfg.WorkspaceRoot, keep)
		if err != nil {
			log.Warn("could not dispose of every workspace", "error", err)
		}
		if reaped > 0 {
			log.Info("disposed of workspaces nothing will return for", "count", reaped)
		}
	}

	sweep(ctx)

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
				ControlPlane:  cfg.URL,
				Token:         cfg.Token,
			}); err != nil {
				log.Error("run failed", "run", claimed.ID, "error", err)
			}

			sweep(ctx)
		},
	)
	if err != nil {
		return err
	}

	log.Info("runner stopped")
	return nil
}
