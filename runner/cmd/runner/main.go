package main

import (
	"context"
	"fmt"
	"log/slog"
	"os"
	"os/signal"
	"syscall"

	"usespotlight.ai/runner/internal/account"
	"usespotlight.ai/runner/internal/config"
	"usespotlight.ai/runner/internal/control"
	"usespotlight.ai/runner/internal/gitproxy"
	"usespotlight.ai/runner/internal/protocol"
	"usespotlight.ai/runner/internal/session"
	"usespotlight.ai/runner/internal/stackcheck"
	"usespotlight.ai/runner/internal/workspace"
)

func main() {
	if args := os.Args[1:]; len(args) > 0 && args[0] == "register" {
		if err := register(args[1:], os.Stdin, os.Stdout); err != nil {
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

	r := runner{cfg: cfg, agentUser: agentUser, log: log}
	if cfg.PoolToken != "" {
		err = r.pooled(ctx)
	} else {
		err = r.registered(ctx)
	}
	if err != nil {
		return err
	}

	log.Info("runner stopped")
	return nil
}

type runner struct {
	cfg       config.Config
	agentUser *account.User
	log       *slog.Logger
}

func (r runner) registered(ctx context.Context) error {
	token := r.cfg.Token
	if r.cfg.Workload.Enrols() {
		var err error
		token, err = control.Enrol(ctx, r.cfg.URL, control.Enrolment{
			TokenFile: r.cfg.Workload.TokenFile,
			Trust:     r.cfg.Workload.Trust,
			Name:      r.cfg.Workload.Name,
		}, r.log)
		if err != nil {
			r.log.Info("runner stopped before enrolling")
			return nil
		}
	}

	client, err := control.New(r.cfg.URL, token)
	if err != nil {
		return err
	}

	if err := control.Register(ctx, client, r.log); err != nil {
		if ctx.Err() != nil {
			r.log.Info("runner stopped before registering")
			return nil
		}
		return err
	}

	log := r.log.With("runner", client.RunnerID())
	log.Info("registered",
		"agentUser", r.cfg.AgentUser,
		"workspace", r.cfg.WorkspaceRoot,
		"once", r.cfg.Once,
	)

	after := func(context.Context) {}
	if !r.cfg.Once {
		after = r.sweeper(client, log)
		after(ctx)
	}

	return r.poll(ctx, client, log, func() *control.Client { return client }, after)
}

func (r runner) pooled(ctx context.Context) error {
	pool, err := control.NewPool(r.cfg.URL, r.cfg.PoolToken)
	if err != nil {
		return err
	}

	if err := control.Register(ctx, pool, r.log); err != nil {
		if ctx.Err() != nil {
			r.log.Info("runner stopped before offering itself to its pool")
			return nil
		}
		return err
	}

	r.log.Info("claiming from its pool",
		"agentUser", r.cfg.AgentUser,
		"workspace", r.cfg.WorkspaceRoot,
	)

	return r.poll(ctx, pool, r.log, pool.Seated, func(context.Context) {})
}

func (r runner) sweeper(client *control.Client, log *slog.Logger) func(context.Context) {
	return func(ctx context.Context) {
		keep, err := client.Kept(ctx)
		if err != nil {
			// A failed request is not an empty answer; never sweep on it.
			log.Warn("could not ask what to keep, holding everything", "error", err)
			return
		}

		reaped, err := workspace.Reap(r.cfg.WorkspaceRoot, keep)
		if err != nil {
			log.Warn("could not dispose of every workspace", "error", err)
		}
		if reaped > 0 {
			log.Info("disposed of workspaces nothing will return for", "count", reaped)
		}
	}
}

func (r runner) poll(
	ctx context.Context,
	claimer control.Claimer,
	polling *slog.Logger,
	seated func() *control.Client,
	after func(context.Context),
) error {
	return control.Poll(
		ctx,
		claimer,
		control.Limits{
			Once:        r.cfg.Once,
			MaxRuns:     r.cfg.MaxRuns,
			IdleTimeout: r.cfg.IdleTimeout,
			RetireAt:    r.cfg.RetireAt,
		},
		polling,
		control.Work{
			Run: func(ctx context.Context, claimed protocol.Run) {
				client := seated()
				log := r.log.With("runner", client.RunnerID())

				if err := session.Execute(ctx, claimed, session.Options{
					WorkspaceRoot: r.cfg.WorkspaceRoot,
					Journal:       client,
					Log:           log,
					AgentUser:     r.agentUser,
					PrepareHook:   r.cfg.PrepareHook,
					PublishHook:   r.cfg.PublishHook,
					HookTimeout:   r.cfg.HookTimeout,
					ControlPlane:  r.cfg.URL,
					Token:         client.Token(),
				}); err != nil {
					log.Error("run failed", "run", claimed.ID, "error", err)
				}

				after(ctx)
			},
			Check: func(ctx context.Context, claimed protocol.StackCheck) {
				client := seated()
				r.check(ctx, client, claimed, r.log.With("runner", client.RunnerID()))
				after(ctx)
			},
		},
	)
}

func (r runner) check(
	ctx context.Context,
	client *control.Client,
	claimed protocol.StackCheck,
	log *slog.Logger,
) {
	log = log.With("stack", claimed.StackID, "run", claimed.RunID)

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
		Dir:    r.cfg.WorkspaceRoot,
		Remote: serving.Remote,
		RunAs:  r.agentUser,
		Log:    log,
	})
}
