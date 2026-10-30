package runner

import (
	"context"
	"crypto/tls"
	"crypto/x509"
	"encoding/json"
	"errors"
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
	"usespotlight.ai/data-plane/runner/internal/localproxy"
	"usespotlight.ai/data-plane/runner/internal/session"
	"usespotlight.ai/data-plane/runner/internal/stackcheck"
	"usespotlight.ai/data-plane/telemetry"
)

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

func report(candidatesJSON, version string, out io.Writer) error {
	var candidates []protocol.HarnessProbe
	if err := json.Unmarshal([]byte(candidatesJSON), &candidates); err != nil {
		return fmt.Errorf("read the harnesses to look for: %w", err)
	}

	return json.NewEncoder(out).Encode(protocol.Registration{
		Release:   version,
		Harnesses: harness.Installed(context.Background(), candidates),
	})
}

func run(args []string, version string) error {
	log := telemetry.NewLogger("runner", os.Stdout)
	slog.SetDefault(log)

	delivered := make(chan os.Signal, 1)
	signal.Notify(delivered, syscall.SIGUSR1)
	defer signal.Stop(delivered)

	ctx, stop := signal.NotifyContext(
		context.Background(),
		syscall.SIGINT,
		syscall.SIGTERM,
	)
	defer stop()

	trace, traced := telemetry.TraceOf(os.Getenv(telemetry.TraceparentVar))
	if !traced {
		trace = telemetry.NewTrace()
	}
	ctx = telemetry.WithTrace(ctx, trace)
	log = log.With("trace_id", trace.ID())

	cfg, err := config.Load(args)
	if err != nil {
		return err
	}

	agentUser, err := account.LookupUser(cfg.AgentUser)
	if err != nil {
		return err
	}

	var egress *localproxy.Egress
	if cfg.Egress.Configured() {
		if egress, err = localproxy.To(cfg.Egress.URL, cfg.Egress.Credential, nil); err != nil {
			return err
		}
	}

	assigned, err := assignment(ctx, cfg, version, egress, log)
	if err != nil {
		return err
	}
	if assigned == nil {
		log.Info("runner stopped with no work")
		return nil
	}

	r := runner{cfg: cfg, agentUser: agentUser, log: log, sandbox: new(session.Sandbox)}
	if egress != nil {
		r.transport = egress.Transport(nil)

		proxy, err := r.openLocalProxy(ctx, egress)
		if err != nil {
			r.unready = err
		} else {
			defer proxy.close()
			r.proxyEnv = proxy.env
		}
	}

	if !cfg.HasAssignmentFile() || assigned.SandboxID == "" {
		r.serve(ctx, *assigned)
		log.Info("runner stopped")
		return nil
	}

	r.supervise(ctx, *assigned, delivered)
	log.Info("runner stopped; the sandbox drains")
	return nil
}

type runner struct {
	cfg       config.Config
	agentUser *account.User
	log       *slog.Logger
	sandbox   *session.Sandbox
	transport http.RoundTripper
	proxyEnv  map[string]string
	unready   error
}

func (r runner) supervise(ctx context.Context, assigned protocol.Assignment, delivered <-chan os.Signal) {
	log := r.log.With("sandboxId", assigned.SandboxID)
	log.Info("supervising the sandbox")

	for {
		each := r
		each.transport = trustingTheSandbox(log)
		each.serve(ctx, assigned)
		if ctx.Err() != nil {
			return
		}

		r.stopLeftovers(log)

		next, ok := r.nextAssignment(ctx, delivered, log)
		if !ok {
			return
		}
		assigned = next

		if err := cacerts.Install(protocol.SandboxAuthority, protocol.SandboxBundle); err != nil {
			log.Warn("could not trust the egress authority of the next run, so TLS through egress may fail", "error", err)
		}
	}
}

// Go reads the system authorities one time. Each run's egress has a new authority, so read them again.
func trustingTheSandbox(log *slog.Logger) http.RoundTripper {
	pem, err := os.ReadFile(protocol.SandboxBundle)
	if err != nil {
		if !errors.Is(err, os.ErrNotExist) {
			log.Warn("could not read the sandbox's trusted authorities", "error", err)
		}
		return nil
	}

	pool := x509.NewCertPool()
	if !pool.AppendCertsFromPEM(pem) {
		log.Warn("the sandbox's trusted authorities hold no certificate")
		return nil
	}

	transport := http.DefaultTransport.(*http.Transport).Clone()
	transport.TLSClientConfig = &tls.Config{RootCAs: pool, MinVersion: tls.VersionTLS12}
	return transport
}

func (r runner) nextAssignment(ctx context.Context, delivered <-chan os.Signal, log *slog.Logger) (protocol.Assignment, bool) {
	log.Info("waiting for the next run")

	for {
		select {
		case <-ctx.Done():
			return protocol.Assignment{}, false
		case <-delivered:
		}

		assigned, err := readAssignment(r.cfg.AssignmentFile)
		if err != nil {
			log.Warn("could not read the next assignment; waiting for the host to signal again", "error", err)
			continue
		}

		return *assigned, true
	}
}

func (r runner) stopLeftovers(log *slog.Logger) {
	stopped, err := r.agentUser.StopProcesses()
	if err != nil {
		log.Warn("could not stop every process the last run left", "error", err)
	}
	if stopped > 0 {
		log.Info("stopped the processes the last run left", "count", stopped)
	}
}

func (r runner) serve(ctx context.Context, assigned protocol.Assignment) {
	client, err := control.ForRun(r.cfg.URL, assigned)
	if err != nil {
		r.log.Error("could not act for the assigned runner", "error", err)
		return
	}
	if r.transport != nil {
		client.Through(r.transport)
	}

	r.log = r.log.With("runner", client.RunnerID())

	switch work := assigned.Work; {
	case work.Kind == protocol.ClaimedRun && work.Run != nil:
		r.execute(ctx, client, *work.Run)
	case work.Kind == protocol.ClaimedCheck && work.Check != nil:
		r.check(ctx, client, *work.Check)
	default:
		r.log.Warn("was assigned something it does not know how to do", "kind", work.Kind)
	}
}

func (r runner) execute(ctx context.Context, client *control.Client, run protocol.Run) {
	r.log.Info("running", "run", run.ID)

	running, cancel := ctx, context.CancelFunc(func() {})
	if r.cfg.RunTimeout > 0 {
		running, cancel = context.WithTimeout(ctx, r.cfg.RunTimeout)
	}
	defer cancel()

	err := r.sandbox.Execute(running, run, session.Options{
		Workspace:    r.cfg.Workspace,
		Journal:      client,
		Log:          r.log,
		AgentUser:    r.agentUser,
		Author:       r.cfg.Author,
		Mirrors:      os.Getenv("SPOTLIGHT_MIRRORS"),
		ControlPlane: r.cfg.URL,
		Token:        client.Token(),
		Transport:    r.transport,
		ProxyEnv:     r.proxyEnv,
		Enforced:     r.enforced(),
		Unready:      r.unready,
	})
	if err == nil {
		return
	}

	r.log.Error("run failed", "run", run.ID, "error", err)
	if errors.Is(running.Err(), context.DeadlineExceeded) && ctx.Err() == nil {
		r.timedOut(ctx, client, run.ID)
	}
}

func (r runner) timedOut(ctx context.Context, client *control.Client, runID string) {
	r.log.Warn("the run ran past its time", "run", runID, "timeout", r.cfg.RunTimeout)

	if err := client.Complete(ctx, runID, protocol.Completion{
		ExitCode: -1,
		Failed:   true,
		TimedOut: true,
		Message:  fmt.Sprintf("Run stopped at the host's time limit. Time limit: %s", r.cfg.RunTimeout),
	}); err != nil {
		r.log.Warn("could not say the run ran out of time; its lease will expire instead", "error", err)
	}
}

func (r runner) check(ctx context.Context, client *control.Client, claimed protocol.StackCheck) {
	log := r.log.With("stack", claimed.StackID, "run", claimed.RunID)
	log.Info("checking a change stack")

	if r.unready != nil {
		log.Error("could not check, because the local proxy did not open", "error", r.unready)
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
		Env:     r.proxyEnv,
		Log:     log,
	})
}

type opened struct {
	env   map[string]string
	close func()
}

func (r runner) openLocalProxy(ctx context.Context, egress *localproxy.Egress) (opened, error) {
	proxy, err := localproxy.Open(ctx, egress, localproxy.Options{Direct: r.cfg.Egress.Direct, Log: r.log})
	if err != nil {
		r.log.Error("could not open the local proxy, so the work fails", "error", err)
		return opened{}, fmt.Errorf("the local proxy did not open, so the agent cannot send requests with its run's secrets: %w", err)
	}

	if err := cacerts.Add(proxy.PEM(), protocol.SandboxAuthority, protocol.SandboxBundle); err != nil {
		r.log.Warn("could not trust the authority of the local proxy, so TLS through it can fail", "error", err)
	}

	return opened{env: proxy.Env(), close: func() {
		if err := proxy.Close(); err != nil {
			r.log.Warn("could not close the local proxy", "error", err)
		}
	}}, nil
}

func unready(err error) protocol.StackCheckResult {
	return protocol.StackCheckResult{Skipped: &protocol.SkippedCheck{Code: protocol.SkipSetupFailed, Detail: err.Error()}}
}

func (r runner) enforced() func(ctx context.Context) bool {
	if !r.cfg.Egress.Configured() {
		return nil
	}

	return func(ctx context.Context) bool { return localproxy.Enforced(ctx, r.cfg.URL) }
}
