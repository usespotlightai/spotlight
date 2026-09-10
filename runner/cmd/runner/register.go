package main

import (
	"bufio"
	"context"
	"flag"
	"fmt"
	"io"
	"os"
	"os/exec"
	"strings"
	"time"

	"usespotlight.ai/runner/internal/config"
	"usespotlight.ai/runner/internal/control"
	"usespotlight.ai/runner/internal/harness"
	"usespotlight.ai/runner/internal/protocol"
)

const registerUsage = `usage:
  runner register [--token <token>] [--url <https://…>]`

func register(args []string, in io.Reader, out io.Writer) error {
	flags := flag.NewFlagSet("register", flag.ContinueOnError)
	flags.SetOutput(io.Discard)
	tokenFlag := flags.String("token", "", "the enrollment token, minted when you enrol a runner")
	urlFlag := flags.String("url", "", "the control plane to register with")
	if err := flags.Parse(args); err != nil {
		return fmt.Errorf("%s", registerUsage)
	}

	saved, err := config.Read()
	if err != nil {
		return err
	}

	url := firstNonEmpty(*urlFlag, os.Getenv("SPOTLIGHT_URL"), saved["SPOTLIGHT_URL"])
	if url == "" {
		return fmt.Errorf("no control plane to register with: pass --url https://…")
	}

	token := strings.TrimSpace(*tokenFlag)
	if token == "" {
		token, err = prompt(in, out, "Enrollment token: ")
		if err != nil {
			return err
		}
	}
	if token == "" {
		return fmt.Errorf("a token is required\n%s", registerUsage)
	}

	client, err := control.New(url, token)
	if err != nil {
		return err
	}

	// Long enough that discovering each installed harness's models, which runs
	// its CLI, has room to finish before the whole check-in gives up.
	ctx, cancel := context.WithTimeout(context.Background(), 90*time.Second)
	defer cancel()

	candidates, err := client.Installable(ctx)
	if err != nil {
		return fmt.Errorf("reach %s: %w", url, err)
	}
	if err := client.Register(ctx, protocol.Registration{
		Capacity:  1,
		Harnesses: harness.Installed(ctx, candidates),
	}); err != nil {
		return err
	}

	if err := config.Merge(map[string]string{
		"SPOTLIGHT_URL":   url,
		"SPOTLIGHT_TOKEN": token,
	}); err != nil {
		return fmt.Errorf("save the configuration: %w", err)
	}

	fmt.Fprintf(out, "Registered as %s. Configuration saved to %s.\n",
		client.RunnerID(), config.Path())

	autostart(out)
	return nil
}

func autostart(out io.Writer) {
	exe, err := os.Executable()
	if err != nil {
		exe = "runner"
	}

	if os.Geteuid() == 0 && commandExists("systemctl") {
		if err := installService(exe); err != nil {
			fmt.Fprintf(out, "Could not install the service (%v). Start it with: %s\n", err, exe)
			return
		}
		fmt.Fprintln(out, "Started the spotlight-runner service (systemctl status spotlight-runner).")
		return
	}

	fmt.Fprintf(out, "Start the runner with: %s\n", exe)
}

func installService(exe string) error {
	unit := fmt.Sprintf(`[Unit]
Description=Spotlight runner
After=network-online.target
Wants=network-online.target

[Service]
EnvironmentFile=%s
ExecStart=%s
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
`, config.Path(), exe)

	const path = "/etc/systemd/system/spotlight-runner.service"
	if err := os.WriteFile(path, []byte(unit), 0o644); err != nil {
		return err
	}
	if err := exec.Command("systemctl", "daemon-reload").Run(); err != nil {
		return err
	}
	return exec.Command("systemctl", "enable", "--now", "spotlight-runner").Run()
}

func commandExists(name string) bool {
	_, err := exec.LookPath(name)
	return err == nil
}

func prompt(in io.Reader, out io.Writer, label string) (string, error) {
	fmt.Fprint(out, label)
	line, err := bufio.NewReader(in).ReadString('\n')
	if err != nil && err != io.EOF {
		return "", err
	}
	return strings.TrimSpace(line), nil
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if trimmed := strings.TrimSpace(value); trimmed != "" {
			return trimmed
		}
	}
	return ""
}
