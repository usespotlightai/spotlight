package host

import (
	"context"
	"errors"
	"fmt"
	"io"
	"os"
	"os/exec"
	"runtime"
	"strings"
	"sync"
	"syscall"
	"time"

	"golang.org/x/term"

	"usespotlight.ai/data-plane/host/internal/config"
	"usespotlight.ai/data-plane/host/internal/dashboard"
	"usespotlight.ai/data-plane/host/internal/install"
	"usespotlight.ai/data-plane/login"
	"usespotlight.ai/data-plane/ssh"
)

const (
	dashboardLogLines = 200
	commandTimeout    = 10 * time.Minute
)

// Interactive says if stdin and stdout are a terminal, where the dashboard can open.
func Interactive() bool {
	return term.IsTerminal(int(os.Stdin.Fd())) && term.IsTerminal(int(os.Stdout.Fd()))
}

// OpenDashboard shows this machine's host and the CLI's login, and runs spotlight commands on them.
func OpenDashboard(version string) error {
	binary, err := os.Executable()
	if err != nil {
		return fmt.Errorf("find the spotlight binary: %w", err)
	}
	if !personal() {
		return dashboard.Run(localHost{version: version, binary: binary}, nil, nil, version)
	}
	return dashboard.Run(localHost{version: version, binary: binary}, localAccount{binary: binary, version: version}, localEditors{binary: binary}, version)
}

type localEditors struct {
	binary string
}

func (e localEditors) Editors() dashboard.EditorSetup {
	setup := ssh.Inspect(os.Getenv, runtime.GOOS)
	shown := dashboard.EditorSetup{Configured: setup.Configured}
	for _, each := range setup.Editors {
		shown.Editors = append(shown.Editors, dashboard.Editor{Name: each.Name, Ready: each.Ready, Message: each.Message})
	}
	return shown
}

func (e localEditors) Setup(address string, timeout bool) (string, error) {
	args := []string{"ssh", "setup", "--no-editor-timeout"}
	if timeout {
		args[2] = "--editor-timeout"
	}
	if address != "" {
		args = append(args, "--url", address)
	}
	ctx, cancel := context.WithTimeout(context.Background(), commandTimeout)
	defer cancel()
	cmd := exec.CommandContext(ctx, e.binary, args...)
	cmd.SysProcAttr = &syscall.SysProcAttr{Setsid: true}
	out, err := cmd.CombinedOutput()
	return strings.TrimSpace(string(out)), err
}

type localAccount struct {
	binary  string
	version string
}

func (a localAccount) Logins() ([]dashboard.Login, error) {
	saved, err := savedLogins()
	var logins []dashboard.Login
	for _, each := range saved {
		logins = append(logins, dashboard.Login{Address: each.Address, User: each.User})
	}
	return logins, err
}

func (a localAccount) Address() string {
	return login.Suggested()
}

func (a localAccount) Login(ctx context.Context, address string) (dashboard.Approval, error) {
	request, err := login.Start(ctx, address, a.version)
	if err != nil {
		return dashboard.Approval{}, err
	}
	return dashboard.Approval{Address: request.Address, Page: request.Page, Code: request.Code, Open: request.Open, Wait: request.Wait}, nil
}

func (a localAccount) Logout(address string) (string, error) {
	ctx, cancel := context.WithTimeout(context.Background(), commandTimeout)
	defer cancel()
	out, err := exec.CommandContext(ctx, a.binary, "logout", "--url", address).CombinedOutput()
	return strings.TrimSpace(string(out)), err
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

func (h localHost) Update() (string, error) {
	ctx, cancel := context.WithTimeout(context.Background(), commandTimeout)
	defer cancel()
	out, err := exec.CommandContext(ctx, h.binary, "update").CombinedOutput()
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
		if killed(p.err) {
			p.err = nil
		}
	})
	return p.err
}

func killed(err error) bool {
	var exit *exec.ExitError
	if !errors.As(err, &exit) {
		return false
	}
	status, ok := exit.Sys().(syscall.WaitStatus)
	return ok && status.Signaled() && status.Signal() == syscall.SIGKILL
}

func (h localHost) Status() dashboard.Status {
	ctx, cancel := context.WithTimeout(context.Background(), 2*timeout)
	defer cancel()
	r := inspect(ctx, h.version)

	status := dashboard.Status{
		SetUp: hostSetUp(r),
		Name:  r.Name,
		Service: dashboard.Service{
			Installed: r.Service.Installed, Running: r.Service.Running, Unit: r.Service.Unit, Process: r.Service.Process,
		},
		Sandboxes: dashboard.Sandboxes{Running: r.Sandboxes.Running, Capacity: r.Sandboxes.Capacity},
	}
	if !status.SetUp {
		status.AsRoot = config.RootHost()
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
