package runner

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"

	"usespotlight.ai/data-plane/control"
	"usespotlight.ai/data-plane/protocol"
	"usespotlight.ai/data-plane/runner/internal/account"
	"usespotlight.ai/data-plane/runner/internal/cacerts"
	"usespotlight.ai/data-plane/runner/internal/config"
	"usespotlight.ai/data-plane/runner/internal/gitproxy"
	"usespotlight.ai/data-plane/runner/internal/harness"
	"usespotlight.ai/data-plane/runner/internal/session"
	"usespotlight.ai/data-plane/runner/internal/stackcheck"
	"usespotlight.ai/data-plane/runner/internal/wayout"
	"usespotlight.ai/data-plane/telemetry"
)

const Usage = `  spotlight runner            do the one run or check this sandbox was started for`

func Main(args []string, version string) int {
	if err := cacerts.Install(protocol.SandboxAuthority, protocol.SandboxBundle); err != nil {
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
		telemetry.Report(err, nil)
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
	log := slog.New(slog.NewJSONHandler(os.Stdout, nil))
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

	var egress *wayout.Egress
	if cfg.Egress.Given() {
		if egress, err = wayout.To(cfg.Egress.URL, cfg.Egress.Credential, nil); err != nil {
			return err
		}
	}

	handed, err := given(ctx, cfg, version, egress, log)
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
	if egress != nil {
		r.transport = egress.Transport(nil)
		client.Through(r.transport)

		way, err := r.openWayOut(ctx, egress)
		if err != nil {
			r.unready = err
		} else {
			defer way.close()
			r.wayOut = way.env
		}
	}
	r.serve(ctx, client, handed.Work)

	r.log.Info("runner stopped")
	return nil
}

type runner struct {
	cfg       config.Config
	agentUser *account.User
	log       *slog.Logger
	transport http.RoundTripper
	wayOut    map[string]string
	unready   error
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
			Transport:    r.transport,
			WayOut:       r.wayOut,
			Enforced:     r.enforced(),
			Unready:      r.unready,
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

	if r.unready != nil {
		log.Error("could not check, because the way out through egress did not open", "error", r.unready)
		if err := client.RecordChangeStackCheck(ctx, claimed.RunID, claimed.StackID, claimed.Recheck, unready(r.unready)); err != nil {
			log.Warn("could not report a change stack check", "error", err)
		}
		return
	}

	serving, err := gitproxy.Serve(r.cfg.URL, client.Token(), claimed.RunID, true, r.transport)
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
		Env:     r.wayOut,
		Log:     log,
	})
}

type opened struct {
	env   map[string]string
	close func()
}

func (r runner) openWayOut(ctx context.Context, egress *wayout.Egress) (opened, error) {
	way, err := wayout.Open(ctx, egress, wayout.Options{Direct: r.cfg.Egress.Direct, Log: r.log})
	if err != nil {
		r.log.Error("could not open the way out through egress, so the work fails", "error", err)
		return opened{}, fmt.Errorf("the way out through egress did not open, so the agent cannot go out with its run's secrets: %w", err)
	}

	if err := cacerts.Add(way.PEM(), protocol.SandboxAuthority, protocol.SandboxBundle); err != nil {
		r.log.Warn("could not trust the way out's authority, so TLS through it may fail", "error", err)
	}

	return opened{env: way.Env(), close: func() {
		if err := way.Close(); err != nil {
			r.log.Warn("could not close the way out", "error", err)
		}
	}}, nil
}

func unready(err error) protocol.StackChecked {
	return protocol.StackChecked{Skipped: &protocol.SkippedCheck{Code: protocol.SkipSetupFailed, Detail: err.Error()}}
}

func (r runner) enforced() func(ctx context.Context) bool {
	if !r.cfg.Egress.Given() {
		return nil
	}

	return func(ctx context.Context) bool { return wayout.Enforced(ctx, r.cfg.URL) }
}
