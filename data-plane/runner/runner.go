package runner

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"os"
	"os/signal"
	"syscall"

	"usespotlight.ai/data-plane/control"
	"usespotlight.ai/data-plane/protocol"
	"usespotlight.ai/data-plane/runner/internal/account"
	"usespotlight.ai/data-plane/runner/internal/config"
	"usespotlight.ai/data-plane/runner/internal/gitproxy"
	"usespotlight.ai/data-plane/runner/internal/harness"
	"usespotlight.ai/data-plane/runner/internal/session"
	"usespotlight.ai/data-plane/runner/internal/stackcheck"
	"usespotlight.ai/data-plane/runner/internal/trust"
	"usespotlight.ai/data-plane/telemetry"
)

const Usage = `  spotlight runner            do the one run or check this sandbox was started for`

func Main(args []string, version string) int {
	if err := trust.Install(protocol.SandboxAuthority, protocol.SandboxBundle); err != nil {
		slog.Warn("could not trust the egress authority, so TLS through egress may fail", "error", err)
	}

	if len(args) == 2 && args[0] == "harnesses" {
		if err := report(args[1], version, os.Stdout); err != nil {
			fmt.Fprintln(os.Stderr, "spotlight runner:", err)
			return 1
		}
		return 0
	}

	if err := run(args, version); err != nil {
		slog.Error("runner stopped", "error", err)
		return 1
	}

	return 0
}

func report(asked, version string, out io.Writer) error {
	var candidates []protocol.Installable
	if err := json.Unmarshal([]byte(asked), &candidates); err != nil {
		return fmt.Errorf("read the harnesses to look for: %w", err)
	}

	return json.NewEncoder(out).Encode(protocol.Registration{
		Release:   version,
		Harnesses: harness.Installed(context.Background(), candidates),
	})
}

func run(args []string, version string) error {
	log := slog.New(telemetry.Handler(slog.NewJSONHandler(os.Stdout, nil)))
	slog.SetDefault(log)

	ctx, stop := signal.NotifyContext(
		context.Background(),
		syscall.SIGINT,
		syscall.SIGTERM,
	)
	defer stop()

	cfg, err := config.Load(args)
	if err != nil {
		return err
	}

	agentUser, err := account.LookupUser(cfg.AgentUser)
	if err != nil {
		return err
	}

	handed, err := given(ctx, cfg, version, log)
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
			AnswerWait:   r.cfg.AnswerWait,
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

	serving, err := gitproxy.Serve(r.cfg.URL, client.Token(), claimed.RunID, true)
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
