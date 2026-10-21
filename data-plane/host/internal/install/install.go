package install

import (
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
)

const (
	unitName = "spotlight-host"
	label    = "ai.usespotlight.host"

	StopExit = 3
)

type Service struct {
	Binary string
	Config string
}

func (s Service) Install(out io.Writer) error {
	switch runtime.GOOS {
	case "linux":
		return s.systemd(out)
	case "darwin":
		return s.launchd(out)
	default:
		return fmt.Errorf("installing a service on %s is not supported; run `spotlight host` under your own supervisor", runtime.GOOS)
	}
}

func (s Service) systemd(out io.Writer) error {
	system := os.Geteuid() == 0
	path, err := unitPath()
	if err != nil {
		return err
	}
	if err := write(path, SystemdUnit(s, system)); err != nil {
		return err
	}

	for _, args := range [][]string{
		{"daemon-reload"},
		{"enable", unitName},
		{"restart", unitName},
	} {
		if err := systemctl(args...); err != nil {
			return err
		}
	}

	Step(out, fmt.Sprintf("Started the systemd service %s (%s)", unitName, path))
	if !system && !lingers() {
		fmt.Fprintf(out, "\nTo keep the host running after you log out, run:\n  loginctl enable-linger %s\n", os.Getenv("USER"))
	}

	return nil
}

// Docker Desktop, OrbStack and Colima each run per user, so a Mac host is a LaunchAgent, not a daemon.
func (s Service) launchd(out io.Writer) error {
	path, logs, err := agentPaths()
	if err != nil {
		return err
	}
	if err := write(path, LaunchdPlist(s, logs)); err != nil {
		return err
	}

	_ = exec.Command("launchctl", "bootout", agent()).Run()
	if err := command("launchctl", "bootstrap", domain(), path); err != nil {
		return err
	}

	Step(out, fmt.Sprintf("Started the launchd agent %s (logs in %s)", label, logs))
	return nil
}

// Installed names the unit or agent file of an installed service.
func Installed() (string, bool) {
	var path string
	var err error
	switch runtime.GOOS {
	case "linux":
		path, err = unitPath()
	case "darwin":
		path, _, err = agentPaths()
	default:
		return "", false
	}
	if err != nil {
		return "", false
	}
	_, err = os.Stat(path)
	return path, err == nil
}

func Active() bool {
	switch runtime.GOOS {
	case "linux":
		return exec.Command("systemctl", append(scope(), "is-active", "--quiet", unitName)...).Run() == nil
	case "darwin":
		return exec.Command("launchctl", "print", agent()).Run() == nil
	default:
		return false
	}
}

func Start(out io.Writer) error {
	path, err := installedPath()
	if err != nil {
		return err
	}

	if runtime.GOOS == "linux" {
		err = systemctl("start", unitName)
	} else if Active() {
		err = command("launchctl", "kickstart", agent())
	} else {
		err = command("launchctl", "bootstrap", domain(), path)
	}
	if err != nil {
		return err
	}

	Step(out, "Started the host")
	return nil
}

func Stop(out io.Writer) error {
	if _, err := installedPath(); err != nil {
		return err
	}

	var err error
	if runtime.GOOS == "linux" {
		err = systemctl("stop", unitName)
	} else if Active() {
		err = command("launchctl", "bootout", agent())
	}
	if err != nil {
		return err
	}

	Step(out, "Stopped the host")
	return nil
}

// Restart stops the host at once, with its sandboxes, and starts it again.
func Restart(out io.Writer) error {
	path, err := installedPath()
	if err != nil {
		return err
	}

	if runtime.GOOS == "linux" {
		err = systemctl("restart", unitName)
	} else if Active() {
		err = command("launchctl", "kickstart", "-k", agent())
	} else {
		err = command("launchctl", "bootstrap", domain(), path)
	}
	if err != nil {
		return err
	}

	Step(out, "Restarted the host")
	return nil
}

func Uninstall(out io.Writer) error {
	path, err := installedPath()
	if err != nil {
		return err
	}

	if runtime.GOOS == "linux" {
		if err := systemctl("disable", "--now", unitName); err != nil {
			return err
		}
	} else if Active() {
		if err := command("launchctl", "bootout", agent()); err != nil {
			return err
		}
	}

	if err := os.Remove(path); err != nil {
		return err
	}
	if runtime.GOOS == "linux" {
		if err := systemctl("daemon-reload"); err != nil {
			return err
		}
	}

	Step(out, fmt.Sprintf("Removed the service (%s)", path))
	return nil
}

// Logs reads the service's log: the journal on Linux, the agent's log file on macOS.
func Logs(follow bool, lines int) (*exec.Cmd, error) {
	if _, err := installedPath(); err != nil {
		return nil, err
	}

	if runtime.GOOS == "linux" {
		args := append(scope(), "--unit", unitName, "--lines", strconv.Itoa(lines), "--no-pager")
		if follow {
			args = append(args, "--follow")
		}
		return exec.Command("journalctl", args...), nil
	}

	_, logs, err := agentPaths()
	if err != nil {
		return nil, err
	}
	args := []string{"-n", strconv.Itoa(lines)}
	if follow {
		args = append(args, "-F")
	}
	return exec.Command("tail", append(args, logs)...), nil
}

func installedPath() (string, error) {
	if runtime.GOOS != "linux" && runtime.GOOS != "darwin" {
		return "", fmt.Errorf("a service on %s is not supported; run `spotlight host` under your own supervisor", runtime.GOOS)
	}
	path, ok := Installed()
	if !ok {
		return "", fmt.Errorf("the host is not installed as a service; run `spotlight host init`")
	}
	return path, nil
}

func unitPath() (string, error) {
	if os.Geteuid() == 0 {
		return filepath.Join("/etc/systemd/system", unitName+".service"), nil
	}
	home, err := os.UserHomeDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(home, ".config/systemd/user", unitName+".service"), nil
}

func agentPaths() (string, string, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return "", "", err
	}
	return filepath.Join(home, "Library/LaunchAgents", label+".plist"), filepath.Join(home, "Library/Logs/spotlight-host.log"), nil
}

func scope() []string {
	if os.Geteuid() == 0 {
		return nil
	}
	return []string{"--user"}
}

func systemctl(args ...string) error {
	return command("systemctl", append(scope(), args...)...)
}

func domain() string {
	return "gui/" + strconv.Itoa(os.Getuid())
}

func agent() string {
	return domain() + "/" + label
}

func SystemdUnit(s Service, system bool) string {
	wanted := "default.target"
	if system {
		wanted = "multi-user.target"
	}

	return strings.Join([]string{
		"[Unit]",
		"Description=Spotlight host: a fresh runner for every run",
		"After=network-online.target docker.service podman.socket",
		"Wants=network-online.target",
		"",
		"[Service]",
		"ExecStart=" + commandQuoted(s.Binary) + " host",
		"Environment=" + settingQuoted("SPOTLIGHT_HOST_CONFIG="+s.Config),
		"ExecReload=/bin/kill -HUP $MAINPID",
		"Restart=always",
		"RestartSec=5",
		"RestartPreventExitStatus=" + strconv.Itoa(StopExit),
		"TimeoutStopSec=90",
		"",
		"[Install]",
		"WantedBy=" + wanted,
		"",
	}, "\n")
}

func settingQuoted(value string) string {
	return `"` + strings.NewReplacer(`\`, `\\`, `"`, `\"`, "%", "%%").Replace(value) + `"`
}

// ExecStart= also expands $VARIABLES, which Environment= does not.
func commandQuoted(value string) string {
	return settingQuoted(strings.ReplaceAll(value, "$", "$$"))
}

func LaunchdPlist(s Service, logs string) string {
	return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>` + label + `</string>
  <key>ProgramArguments</key><array><string>` + escaped(s.Binary) + `</string><string>host</string></array>
  <key>EnvironmentVariables</key>
  <dict>
    <key>SPOTLIGHT_HOST_CONFIG</key><string>` + escaped(s.Config) + `</string>
    <key>PATH</key><string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin</string>
  </dict>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>ThrottleInterval</key><integer>60</integer>
  <key>ExitTimeOut</key><integer>90</integer>
  <key>StandardOutPath</key><string>` + escaped(logs) + `</string>
  <key>StandardErrorPath</key><string>` + escaped(logs) + `</string>
</dict>
</plist>
`
}

func escaped(value string) string {
	return strings.NewReplacer("&", "&amp;", "<", "&lt;", ">", "&gt;").Replace(value)
}

func write(path, body string) error {
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return err
	}
	return os.WriteFile(path, []byte(body), 0o644)
}

func command(name string, args ...string) error {
	output, err := exec.Command(name, args...).CombinedOutput()
	if err != nil {
		return fmt.Errorf("%s %s: %w\n%s", name, strings.Join(args, " "), err, strings.TrimSpace(string(output)))
	}
	return nil
}

func Step(out io.Writer, text string) {
	mark := "✓"
	if file, ok := out.(*os.File); ok && os.Getenv("NO_COLOR") == "" {
		if info, err := file.Stat(); err == nil && info.Mode()&os.ModeCharDevice != 0 {
			mark = "\033[32m✓\033[0m"
		}
	}
	fmt.Fprintf(out, "  %s %s\n", mark, text)
}

func lingers() bool {
	value, err := exec.Command("loginctl", "show-user", os.Getenv("USER"), "--property=Linger", "--value").Output()
	return err == nil && strings.TrimSpace(string(value)) == "yes"
}
