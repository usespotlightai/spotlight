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

func Main(args []string, version string) int {
	var err error

	if len(args) == 0 {
		err = run(version)
	} else {
		switch rest := args[1:]; args[0] {
		case "init":
			err = initialize(version, rest)
		case "config":
			err = configure(version, rest)
		case "status":
			err = status(version, rest)
		case "start":
			err = noArgs(rest, startHelp, func() error { return install.Start(os.Stdout) })
		case "stop":
			err = noArgs(rest, stopHelp, func() error { return install.Stop(os.Stdout) })
		case "restart":
			err = restart(version, rest)
		case "reload":
			err = reload(version, rest)
		case "logs":
			err = logs(rest)
		case "uninstall":
			err = uninstall(version, rest)
		case "update":
			if len(rest) > 1 {
				err = fmt.Errorf("%s", updateHelp.Synopsis())
			} else {
				err = updateBinary(version, rest)
			}
		default:
			err = fmt.Errorf("no command %q\n%s", "host "+args[0], hostHelp.Synopsis())
		}
	}

	if err != nil {
		if !errors.Is(err, errReported) {
			fmt.Fprintln(os.Stderr, "spotlight host:", err)
		}
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
		return fmt.Errorf("%w\nTo set up this machine as a host, run: spotlight host init", err)
	}
	telemetry.SampleAs(cfg.Sampler, cfg.SamplerArg)
	if cfg.LogLevel != "" {
		log = telemetry.NewLoggerAt(cfg.LogLevel, os.Stdout)
		slog.SetDefault(log)
	}

	signals := make(chan os.Signal, 1)
	signal.Notify(signals, syscall.SIGHUP, syscall.SIGUSR1)
	defer signal.Stop(signals)

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

	live := liveSettings(cfg, version)
	host := serve.New(serve.Options{
		HostID:     id,
		Name:       live.Name,
		Version:    version,
		Images:     live.Images,
		Registry:   registry.From(cfg.Registry),
		Updates:    binary,
		AutoUpdate: live.AutoUpdate,
		Capacity:   live.Capacity,
		RunTimeout: live.RunTimeout,
		AnswerWait: live.AnswerWait,
		ControlURL: cfg.URL,
		SandboxURL: live.SandboxURL,
		SandboxEnv: live.SandboxEnv,
		Egress:     live.Egress,
		Network:    live.Network,
		ExtraHosts: live.ExtraHosts,
	}, claims, engine, mirrors, log.With("host", id))

	if err := telemetry.ServeHealth(ctx, cfg.HealthAddr, host.Ready, log); err != nil {
		return err
	}

	go func() {
		for sig := range signals {
			if sig == syscall.SIGUSR1 {
				host.Restart()
				continue
			}
			reloaded, err := config.Load(version)
			if err != nil {
				log.Error("could not reload the settings, so the host keeps the ones it has", "error", err)
				continue
			}
			host.Reload(liveSettings(reloaded, version))
		}
	}()

	if err := host.Serve(ctx); errors.Is(err, serve.ErrRestart) {
		log.Info("host restarts", "binary", binary.Path)
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

func liveSettings(cfg config.Config, version string) serve.Settings {
	return serve.Settings{
		Name:       cfg.Name,
		Images:     cfg.Images,
		Capacity:   cfg.Capacity,
		RunTimeout: cfg.RunTimeout,
		AnswerWait: cfg.AnswerWait,
		SandboxURL: cfg.SandboxURL,
		SandboxEnv: cfg.SandboxEnv,
		Egress: serve.Egress{
			Image: cfg.Egress.Image, Allow: cfg.Egress.Allow, SecretAllow: cfg.Egress.SecretAllow,
			Env: cfg.Egress.Env, CABundle: cfg.Egress.CABundle,
		},
		Network:    cfg.Network,
		ExtraHosts: cfg.ExtraHosts,
		AutoUpdate: cfg.AutoUpdate && version != "dev",
	}
}
