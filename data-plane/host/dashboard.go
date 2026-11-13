package host

import (
	"context"
	"fmt"
	"io"
	"os"
	"os/exec"
	"strings"
	"sync"
	"time"

	"golang.org/x/term"

	"usespotlight.ai/data-plane/host/internal/config"
	"usespotlight.ai/data-plane/host/internal/dashboard"
	"usespotlight.ai/data-plane/host/internal/install"
)

const (
	dashboardLogLines = 200
	commandTimeout    = 10 * time.Minute
)

func interactive() bool {
	return term.IsTerminal(int(os.Stdin.Fd())) && term.IsTerminal(int(os.Stdout.Fd()))
}

func openDashboard(version string) error {
	binary, err := os.Executable()
	if err != nil {
		return fmt.Errorf("find the spotlight binary: %w", err)
	}
	return dashboard.Run(localHost{version: version, binary: binary}, version)
}

type localHost struct {
	version string
	binary  string
}

func (h localHost) Run(args []string, input string) (string, error) {
	ctx, cancel := context.WithTimeout(context.Background(), commandTimeout)
	defer cancel()
	cmd := exec.CommandContext(ctx, h.binary, append([]string{"host"}, args...)...)
	cmd.Stdin = strings.NewReader(input)
	out, err := cmd.CombinedOutput()
	if ctx.Err() != nil {
		err = fmt.Errorf("spotlight host %s did not finish in %s", strings.Join(args, " "), commandTimeout)
	}
	return strings.TrimSpace(string(out)), err
}

func (h localHost) Attach(args []string) *exec.Cmd {
	return exec.Command(h.binary, append([]string{"host"}, args...)...)
}

func (h localHost) ConfigPath() string {
	return config.Path()
}

func (h localHost) Logs() (io.ReadCloser, error) {
	cmd, err := install.Logs(true, dashboardLogLines)
	if err != nil {
		return nil, err
	}
	pipe, err := cmd.StdoutPipe()
	if err != nil {
		return nil, err
	}
	cmd.Stderr = cmd.Stdout
	if err := cmd.Start(); err != nil {
		return nil, err
	}
	return &process{Reader: pipe, cmd: cmd}, nil
}

type process struct {
	io.Reader
	cmd  *exec.Cmd
	once sync.Once
	err  error
}

func (p *process) Close() error {
	p.once.Do(func() {
		_ = p.cmd.Process.Kill()
		p.err = p.cmd.Wait()
	})
	return p.err
}

func (h localHost) Status() dashboard.Status {
	ctx, cancel := context.WithTimeout(context.Background(), 2*timeout)
	defer cancel()
	r := inspect(ctx, h.version)
	cfg, _ := config.Load(h.version)

	status := dashboard.Status{
		Name: cfg.Name,
		Service: dashboard.Service{
			Installed: r.Service.Installed, Running: r.Service.Running, Unit: r.Service.Unit, Process: r.Service.Process,
		},
		Sandboxes: dashboard.Sandboxes{Running: r.Sandboxes.Running, Capacity: r.Sandboxes.Capacity},
	}
	for _, each := range r.Checks {
		status.Checks = append(status.Checks, dashboard.Check{Name: each.Name, Level: each.Level, Message: each.Message, Fix: each.Fix})
	}
	return status
}

func (h localHost) Settings() ([]dashboard.Setting, error) {
	file, err := config.Open(config.Path())
	if err != nil {
		return nil, err
	}
	values := file.Values()

	rows := make([]dashboard.Setting, 0, len(config.Settings))
	for _, setting := range config.Settings {
		value, set := values[setting.Env]
		rows = append(rows, dashboard.Setting{Setting: setting, Value: value, Set: set})
	}
	for _, env := range config.Others(values) {
		other, _ := config.Lookup(env)
		rows = append(rows, dashboard.Setting{Setting: other, Value: values[env], Set: true})
	}
	return rows, nil
}
