package host

import (
	"context"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"io"
	"os"
	"strings"
	"text/tabwriter"

	"usespotlight.ai/data-plane/control"
	"usespotlight.ai/data-plane/host/internal/config"
	"usespotlight.ai/data-plane/host/internal/install"
	"usespotlight.ai/data-plane/host/internal/pool"
	"usespotlight.ai/data-plane/host/internal/sandbox/docker"
)

type check struct {
	Level   string `json:"-"`
	Status  string `json:"status"`
	Message string `json:"message"`
	Fix     string `json:"fix,omitempty"`
}

type report struct {
	Config  string `json:"config"`
	Service struct {
		Installed bool   `json:"installed"`
		Unit      string `json:"unit,omitempty"`
		Running   bool   `json:"running"`
		Process   int    `json:"process,omitempty"`
	} `json:"service"`
	Sandboxes struct {
		Running  *int `json:"running"`
		Capacity int  `json:"capacity"`
	} `json:"sandboxes"`
	Settings []listed `json:"settings"`
	Checks   []check  `json:"checks"`
}

func status(version string, args []string) error {
	flags := flag.NewFlagSet("status", flag.ContinueOnError)
	asJSON := flags.Bool("json", false, "")
	if rest, err := parse(flags, args); err != nil || len(rest) > 0 {
		return fmt.Errorf("%s", statusHelp.Synopsis())
	}

	ctx, cancel := context.WithTimeout(context.Background(), 2*timeout)
	defer cancel()

	r := inspect(ctx, version)
	if *asJSON {
		if err := json.NewEncoder(os.Stdout).Encode(r); err != nil {
			return err
		}
	} else {
		r.print(os.Stdout)
	}

	for _, each := range r.Checks {
		if each.Level == failed {
			return errReported
		}
	}
	return nil
}

func inspect(ctx context.Context, version string) report {
	var r report
	r.Config = config.Path()
	r.Settings = []listed{}
	add := func(level, message, fix string) {
		names := map[string]string{passed: "passed", warned: "warning", failed: "failed"}
		r.Checks = append(r.Checks, check{Level: level, Status: names[level], Message: message, Fix: fix})
	}

	file, err := config.Open(r.Config)
	if err != nil {
		add(failed, err.Error(), "")
		return r
	}
	values := file.Values()
	r.Settings = shown(values)

	cfg, invalid := config.Load(version)
	r.Sandboxes.Capacity = cfg.Capacity
	if unit, installed := install.Installed(); installed {
		r.Service.Unit, r.Service.Installed = unit, true
	}
	if r.Service.Process, err = config.Serving(cfg.State); err != nil {
		add(warned, err.Error(), "")
	}
	r.Service.Running = r.Service.Process != 0

	switch {
	case len(values) == 0:
		add(failed, "There are no settings in "+r.Config+".", "spotlight host init")
		return r
	case invalid != nil:
		add(failed, "The settings have problems: "+config.Friendly(invalid).Error(), "spotlight host config set KEY=VALUE")
	default:
		add(passed, "The settings are valid.", "")
	}

	switch {
	case r.Service.Running:
	case r.Service.Installed:
		add(failed, "The service is installed but the host does not run.", "spotlight host start, then spotlight host logs")
	default:
		add(failed, "The host does not run, and it is not installed as a service.", "spotlight host init")
	}

	if invalid == nil {
		id := readHostID(cfg.State)
		if id == "" {
			id = "status"
		}
		if claims, err := pool.New(cfg.URL, cfg.Credential(), id); err != nil {
			add(failed, fmt.Sprintf("Cannot reach Spotlight at %s: %v", cfg.URL, err), "")
		} else if _, err := claims.Requirements(ctx); errors.Is(err, control.ErrUnauthorized) {
			add(failed, fmt.Sprintf("Spotlight at %s does not accept the credential.", cfg.URL),
				"copy a token from Settings → Runners → Add a host, then: spotlight host config set token=TOKEN")
		} else if err != nil {
			add(failed, fmt.Sprintf("Cannot reach Spotlight at %s: %v", cfg.URL, err), "check the url and this machine's network")
		} else {
			add(passed, fmt.Sprintf("Spotlight at %s accepts the credential.", cfg.URL), "")
		}
	}

	if engine, err := docker.Connect(cfg.DockerHost); err != nil {
		add(failed, "No container runtime answers: "+err.Error(), "start Docker or Podman, or set docker-host")
	} else if runtime, err := engine.Describe(ctx); err != nil {
		add(failed, "The container runtime does not answer: "+err.Error(), "start Docker or Podman, or set docker-host")
	} else {
		add(passed, "The container runtime answers ("+runtime+").", "")
		if running, err := runningSandboxes(ctx, cfg); err == nil {
			r.Sandboxes.Running = &running
		}
	}

	if strings.HasPrefix(cfg.Images.Default, config.Image+":") {
		add(warned, "The default image "+cfg.Images.Default+" holds no harness, so this host runs checks but no agent run.",
			"build an image FROM it with a harness, then: spotlight host config set image=IMAGE")
	}

	return r
}

func (r report) print(out io.Writer) {
	table := tabwriter.NewWriter(out, 0, 0, 2, ' ', 0)
	fmt.Fprintln(table, paint(bold, "Spotlight host"))
	fmt.Fprintf(table, "  Settings\t%s\n", r.Config)

	service := "not installed"
	switch {
	case r.Service.Running && r.Service.Installed:
		service = fmt.Sprintf("running (process %d, %s)", r.Service.Process, r.Service.Unit)
	case r.Service.Running:
		service = fmt.Sprintf("running (process %d), not as a service", r.Service.Process)
	case r.Service.Installed:
		service = "stopped (" + r.Service.Unit + ")"
	}
	fmt.Fprintf(table, "  Service\t%s\n", service)

	if r.Sandboxes.Running != nil {
		fmt.Fprintf(table, "  Sandboxes\t%d of %d running\n", *r.Sandboxes.Running, r.Sandboxes.Capacity)
	}

	table.Flush()

	if len(r.Settings) > 0 {
		fmt.Fprintln(out)
		fmt.Fprintln(out, paint(bold, "Settings"))
		table = tabwriter.NewWriter(out, 0, 0, 2, ' ', 0)
		for _, each := range r.Settings {
			fmt.Fprintf(table, "  %s\t%s\n", each.Key, each.Value)
		}
		table.Flush()
	}

	fmt.Fprintln(out)
	fmt.Fprintln(out, paint(bold, "Checks"))
	for _, each := range r.Checks {
		fmt.Fprintf(out, "  %s %s\n", mark(each.Level), each.Message)
		if each.Fix != "" {
			fmt.Fprintf(out, "      %s\n", each.Fix)
		}
	}
}
