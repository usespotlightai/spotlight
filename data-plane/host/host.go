package host

import (
	"context"
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
)

const Usage = `  spotlight host              serve a pull pool or runner trust, a fresh sandbox for every run
  spotlight host install      run it as a service (systemd or launchd)`

func Main(args []string, version string) int {
	var err error

	switch {
	case len(args) == 0:
		err = run(version)
	case len(args) == 1 && args[0] == "install":
		err = installService(version)
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
	log := slog.New(slog.NewJSONHandler(os.Stdout, nil))
	slog.SetDefault(log)

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	cfg, err := config.Load(version)
	if err != nil {
		return err
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

	engine, err := docker.Connect(cfg.DockerHost)
	if err != nil {
		return err
	}

	claims, err := pool.New(cfg.URL, cfg.Credential(), id)
	if err != nil {
		return err
	}

	mirrors := mirror.At(filepath.Join(cfg.State, "mirrors"))
	if err := mirrors.Tidy(); err != nil {
		log.Warn("could not tidy the mirrors a stopped host left", "error", err)
	}

	host := serve.New(serve.Options{
		HostID:     id,
		Name:       cfg.Name,
		Version:    version,
		Images:     cfg.Images,
		Registry:   registry.From(cfg.Registry),
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

	if err := host.Serve(ctx); err != nil {
		return err
	}

	log.Info("host stopped")
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
