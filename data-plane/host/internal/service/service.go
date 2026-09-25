package service

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

	RefusedExit = 3
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
		return fmt.Errorf("installing a service on %s is not supported; run spotlight-host under your own supervisor", runtime.GOOS)
	}
}

func (s Service) systemd(out io.Writer) error {
	system := os.Geteuid() == 0

	dir := "/etc/systemd/system"
	scope := []string{}
	if !system {
		home, err := os.UserHomeDir()
		if err != nil {
			return err
		}
		dir = filepath.Join(home, ".config/systemd/user")
		scope = []string{"--user"}
	}

	path := filepath.Join(dir, unitName+".service")
	if err := write(path, SystemdUnit(s, system)); err != nil {
		return err
	}

	for _, args := range [][]string{
		{"daemon-reload"},
		{"enable", unitName},
		{"restart", unitName},
	} {
		if err := command(out, "systemctl", append(scope, args...)...); err != nil {
			return err
		}
	}

	fmt.Fprintf(out, "spotlight-host: running as the systemd service %s (%s)\n", unitName, path)
	if !system {
		fmt.Fprintf(out, "spotlight-host: to keep it running after you log out: loginctl enable-linger %s\n", os.Getenv("USER"))
	}

	return nil
}

// Docker Desktop, OrbStack and Colima each run per user, so a Mac host is a LaunchAgent, not a daemon.
func (s Service) launchd(out io.Writer) error {
	home, err := os.UserHomeDir()
	if err != nil {
		return err
	}

	path := filepath.Join(home, "Library/LaunchAgents", label+".plist")
	logs := filepath.Join(home, "Library/Logs/spotlight-host.log")
	if err := write(path, LaunchdPlist(s, logs)); err != nil {
		return err
	}

	domain := "gui/" + strconv.Itoa(os.Getuid())
	_ = exec.Command("launchctl", "bootout", domain+"/"+label).Run()
	if err := command(out, "launchctl", "bootstrap", domain, path); err != nil {
		return err
	}

	fmt.Fprintf(out, "spotlight-host: running as the launchd agent %s, logging to %s\n", label, logs)
	return nil
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
		"ExecStart=" + commandQuoted(s.Binary),
		"Environment=" + settingQuoted("SPOTLIGHT_HOST_CONFIG="+s.Config),
		"Restart=always",
		"RestartSec=5",
		"RestartPreventExitStatus=" + strconv.Itoa(RefusedExit),
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
  <key>ProgramArguments</key><array><string>` + escaped(s.Binary) + `</string></array>
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

func command(out io.Writer, name string, args ...string) error {
	run := exec.Command(name, args...)
	run.Stdout, run.Stderr = out, out
	if err := run.Run(); err != nil {
		return fmt.Errorf("%s %s: %w", name, strings.Join(args, " "), err)
	}
	return nil
}
