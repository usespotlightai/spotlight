package host

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"os"
	"os/signal"
	"path/filepath"
	"syscall"

	"usespotlight.ai/data-plane/host/internal/config"
	"usespotlight.ai/data-plane/host/internal/install"
	"usespotlight.ai/data-plane/host/internal/mirror"
	"usespotlight.ai/data-plane/host/internal/pool"
	"usespotlight.ai/data-plane/host/internal/registry"
	"usespotlight.ai/data-plane/host/internal/sandbox/docker"
	"usespotlight.ai/data-plane/host/internal/serve"
	"usespotlight.ai/data-plane/host/internal/update"
	"usespotlight.ai/data-plane/telemetry"
)

const Usage = `  spotlight host              serve a pull pool or runner trust, a fresh sandbox for every run
  spotlight host install      run it as a service (systemd or launchd)
  spotlight host update [release]
                              replace this binary with a release (default: the control plane's release);
                              a running host restarts on it when its sandboxes finish`

func Main(args []string, version string) int {
	var err error

	switch {
	case len(args) == 0:
		err = run(version)
	case len(args) == 1 && args[0] == "install":
		err = installService(version)
	case len(args) <= 2 && args[0] == "update":
		err = updateBinary(version, args[1:])
	default:
		err = fmt.Errorf("usage:\n%s", Usage)
	}

	if err != nil {
		fmt.Fprintln(os.Stderr, "spotlight host:", err)
		if serve.Final(err) {
			return install.StopExit
		}
		return 1
	}

	return 0
}

func run(version string) error {
	log := telemetry.NewLogger("host", os.Stdout)
	slog.SetDefault(log)

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	cfg, err := config.Load(version)
	if err != nil {
		return err
	}
	if cfg.LogLevel != "" {
		log = telemetry.NewLoggerAt(cfg.LogLevel, os.Stdout)
		slog.SetDefault(log)
	}

	release, err := config.Lock(cfg.State)
	if err != nil {
		return err
	}
	defer release()

	id, err := config.HostID(cfg.State)
	if err != nil {
		return err
	}

	binary, err := update.Running(cfg.Releases)
	if err != nil {
		return fmt.Errorf("find the host binary: %w", err)
	}

	engine, err := docker.Connect(cfg.DockerHost)
	if err != nil {
		return err
	}

	claims, err := pool.New(cfg.URL, cfg.Credential(), id)
	if err != nil {
		return err
	}

	mirrors := mirror.At(filepath.Join(cfg.State, "mirrors"))
	if err := mirrors.Prune(); err != nil {
		log.Warn("could not prune the mirrors a stopped host left", "error", err)
	}

	host := serve.New(serve.Options{
		HostID:     id,
		Name:       cfg.Name,
		Version:    version,
		Images:     cfg.Images,
		Registry:   registry.From(cfg.Registry),
		Updates:    binary,
		AutoUpdate: cfg.AutoUpdate && version != "dev",
		Capacity:   cfg.Capacity,
		RunTimeout: cfg.RunTimeout,
		AnswerWait: cfg.AnswerWait,
		ControlURL: cfg.URL,
		SandboxURL: cfg.SandboxURL,
		SandboxEnv: cfg.SandboxEnv,
		Egress: serve.Egress{
			Image: cfg.Egress.Image, Allow: cfg.Egress.Allow, SecretAllow: cfg.Egress.SecretAllow,
			Env: cfg.Egress.Env, CABundle: cfg.Egress.CABundle,
		},
		Network:    cfg.Network,
		ExtraHosts: cfg.ExtraHosts,
	}, claims, engine, mirrors, log.With("host", id))

	if err := telemetry.ServeHealth(ctx, cfg.HealthAddr, host.Ready, log); err != nil {
		return err
	}

	if err := host.Serve(ctx); errors.Is(err, serve.ErrUpdated) {
		log.Info("host restarts on the new binary", "binary", binary.Path)
		release()
		return syscall.Exec(binary.Path, append([]string{binary.Path}, os.Args[1:]...), os.Environ())
	} else if err != nil {
		return err
	}

	log.Info("host stopped")
	return nil
}

func updateBinary(version string, args []string) error {
	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	cfg, loaded := config.Load(version)
	if cfg.Releases == "" {
		cfg.Releases = update.DefaultReleases
	}

	release := ""
	if len(args) == 1 {
		release = args[0]
	} else {
		if loaded != nil {
			return fmt.Errorf("%s can't reach the control plane, so name a release (spotlight host update <release>): %w",
				config.Path(), loaded)
		}
		id, err := config.HostID(cfg.State)
		if err != nil {
			return err
		}
		claims, err := pool.New(cfg.URL, cfg.Credential(), id)
		if err != nil {
			return err
		}
		required, err := claims.Requirements(ctx)
		if err != nil {
			return err
		}
		if release = required.Host.Release; release == "" {
			return fmt.Errorf("the control plane at %s doesn't name a release; name one: spotlight host update <release>", cfg.URL)
		}
	}

	if release == version {
		fmt.Println("spotlight host: already on release", release)
		return nil
	}

	binary, err := update.Running(cfg.Releases)
	if err != nil {
		return fmt.Errorf("find the host binary: %w", err)
	}

	fmt.Printf("spotlight host: downloading release %s\n", release)
	if err := binary.To(ctx, release); err != nil {
		return err
	}

	fmt.Printf("spotlight host: %s is now release %s. A running host restarts on it when its sandboxes finish.\n",
		binary.Path, release)
	return nil
}

func installService(version string) error {
	binary, err := os.Executable()
	if err != nil {
		return err
	}
	if binary, err = filepath.EvalSymlinks(binary); err != nil {
		return err
	}

	if _, err := config.Load(version); err != nil {
		return fmt.Errorf("%s is not ready to serve: %w", config.Path(), err)
	}

	return install.Service{Binary: binary, Config: config.Path()}.Install(os.Stdout)
}
