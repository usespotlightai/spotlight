package host

import (
	"context"
	"errors"
	"flag"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"golang.org/x/term"

	"usespotlight.ai/data-plane/console"
	"usespotlight.ai/data-plane/control"
	"usespotlight.ai/data-plane/credentials"
	"usespotlight.ai/data-plane/host/internal/config"
	"usespotlight.ai/data-plane/host/internal/install"
	"usespotlight.ai/data-plane/host/internal/pool"
	"usespotlight.ai/data-plane/host/internal/registry"
	"usespotlight.ai/data-plane/host/internal/sandbox/docker"
	"usespotlight.ai/data-plane/login"
)

const (
	defaultCapacity = "5"
	pullWait        = 30 * time.Minute
)

type initFlags struct {
	url, token, trust, tokenFile, image, name, memory string
	capacity                                          int
	noService, yes, tokenStdin                        bool
	given                                             map[string]bool
}

func initialize(version string, args []string) error {
	var f initFlags
	flags := flag.NewFlagSet("init", flag.ContinueOnError)
	flags.StringVar(&f.url, "url", "", "")
	flags.StringVar(&f.token, "token", "", "")
	flags.StringVar(&f.trust, "trust", "", "")
	flags.StringVar(&f.tokenFile, "oidc-token-file", "", "")
	flags.IntVar(&f.capacity, "capacity", 0, "")
	flags.StringVar(&f.memory, "sandbox-memory", "", "")
	flags.StringVar(&f.image, "image", "", "")
	flags.StringVar(&f.name, "name", "", "")
	flags.BoolVar(&f.noService, "no-service", false, "")
	flags.BoolVar(&f.yes, "yes", false, "")
	flags.BoolVar(&f.tokenStdin, "token-stdin", false, "")
	if rest, err := parse(flags, args); err != nil || len(rest) > 0 {
		return fmt.Errorf("%s", initHelp.Synopsis())
	}
	f.given = map[string]bool{}
	flags.Visit(func(each *flag.Flag) { f.given[each.Name] = true })

	if onlyURL(f.given) && personal() && Interactive() && !connected() {
		address := ""
		if f.given["url"] {
			parsed, err := credentials.Address(f.url)
			if err != nil {
				return err
			}
			address = parsed
		}
		return OpenDashboard(version, &address)
	}
	if f.tokenStdin {
		if f.given["token"] {
			return errors.New("give the token with --token or --token-stdin, not both")
		}
		if term.IsTerminal(int(os.Stdin.Fd())) {
			return errors.New("--token-stdin reads the token from a pipe, as in: printf %s \"$POOL_TOKEN\" | spotlight host init --token-stdin")
		}
		token, err := io.ReadAll(io.LimitReader(os.Stdin, 4096))
		if err != nil {
			return fmt.Errorf("read the token from stdin: %w", err)
		}
		f.token, f.given["token"] = strings.TrimSpace(string(token)), true
	}

	var tty *console.Terminal
	if !f.yes {
		if tty = console.Open(); tty != nil {
			defer tty.Close()
		}
	}

	file, err := config.Open(config.Path())
	if err != nil {
		return err
	}
	if err := runtimeAnswers(file.Values()["DOCKER_HOST"]); err != nil {
		return err
	}
	if err := settle(file, f, tty, version, runtimeMemory(os.Stdout, file.Values()["DOCKER_HOST"])); err != nil {
		return err
	}

	cfg, err := config.Check(version, file.Values())
	if err != nil {
		return fmt.Errorf("nothing saved, because %w", config.Friendly(err))
	}

	ctx, cancel := context.WithTimeout(context.Background(), 2*timeout)
	defer cancel()
	if err := reach(ctx, os.Stdout, cfg); err != nil {
		return err
	}

	if err := file.Save(); err != nil {
		return err
	}
	console.Step(os.Stdout, "Saved the settings in "+file.Path)

	if err := pull(os.Stdout, cfg); err != nil {
		return err
	}

	if err := serveIt(os.Stdout, version, cfg, f.noService); err != nil {
		return err
	}
	if !f.noService {
		fmt.Printf("\n%s It shows on the Runners page when it connects.\n", paint(bold+green, "The host serves "+cfg.URL+"."))
	}

	if strings.HasPrefix(cfg.Images.Default, config.Image+":") {
		fmt.Printf("\n%s The runner image holds no harness, so this host runs checks but no agent run.\n", mark(warned))
		fmt.Println("  Run spotlight host init in a terminal, without flags, to build an image with Claude Code, Codex, Cursor or OpenCode.")
	}
	return nil
}

// settle puts each value in the file: from its flag, else from the person's answer, else the saved value or default.
func settle(file *config.File, f initFlags, tty *console.Terminal, version string, runtimeMemory int64) error {
	saved := file.Values()
	value := func(question, flagName, flagValue, env, fallback string) (string, error) {
		current := saved[env]
		if current == "" {
			current = fallback
		}
		if f.given[flagName] {
			return flagValue, nil
		}
		if tty == nil {
			return current, nil
		}
		answer, err := tty.Ask(question, current)
		if answer == "" {
			answer = current
		}
		return answer, err
	}

	url, err := value("Spotlight URL", "url", f.url, "SPOTLIGHT_URL", loginAddress())
	if err != nil {
		return err
	}
	if err := file.Set("SPOTLIGHT_URL", credentials.WithScheme(url)); err != nil {
		return err
	}

	if err := credential(file, f, tty, saved); err != nil {
		return err
	}

	capacity, err := value("Sandboxes at once", "capacity", strconv.Itoa(f.capacity), "SPOTLIGHT_CAPACITY", defaultCapacity)
	if err != nil {
		return err
	}
	if err := file.Set("SPOTLIGHT_CAPACITY", capacity); err != nil {
		return err
	}

	sandboxes, _ := strconv.Atoi(capacity)
	memory, err := value("Memory per sandbox ("+config.NoMemoryLimit+" sets no limit)", "sandbox-memory", f.memory,
		"SPOTLIGHT_SANDBOX_MEMORY", config.SuggestedSandboxMemory(runtimeMemory, sandboxes))
	if err != nil {
		return err
	}
	if memory == "" {
		file.Unset("SPOTLIGHT_SANDBOX_MEMORY")
	} else if err := file.Set("SPOTLIGHT_SANDBOX_MEMORY", memory); err != nil {
		return err
	}

	image, err := value("Runner image", "image", f.image, "SPOTLIGHT_RUNNER_IMAGE", config.DefaultImage(version))
	if err != nil {
		return err
	}
	if image == "" || image == config.DefaultImage(version) {
		file.Unset("SPOTLIGHT_RUNNER_IMAGE")
	} else if err := file.Set("SPOTLIGHT_RUNNER_IMAGE", image); err != nil {
		return err
	}

	if f.given["name"] {
		return file.Set("SPOTLIGHT_HOST_NAME", f.name)
	}
	return nil
}

func credential(file *config.File, f initFlags, tty *console.Terminal, saved map[string]string) error {
	switch {
	case f.given["trust"] || f.given["oidc-token-file"]:
		file.Unset("SPOTLIGHT_POOL_TOKEN")
		var problems []error
		if f.given["trust"] {
			problems = append(problems, file.Set("SPOTLIGHT_TRUST", f.trust))
		}
		if f.given["oidc-token-file"] {
			problems = append(problems, file.Set("SPOTLIGHT_OIDC_TOKEN_FILE", f.tokenFile))
		}
		return errors.Join(problems...)
	case f.given["token"]:
		file.Unset("SPOTLIGHT_TRUST")
		file.Unset("SPOTLIGHT_OIDC_TOKEN_FILE")
		return file.Set("SPOTLIGHT_POOL_TOKEN", f.token)
	case saved["SPOTLIGHT_TRUST"] != "":
		return nil
	case tty == nil && saved["SPOTLIGHT_POOL_TOKEN"] == "":
		return errors.New("--token is required: a pull pool's token, from Settings → Runners → Add a host")
	case tty == nil:
		return nil
	}

	shown := ""
	if saved["SPOTLIGHT_POOL_TOKEN"] != "" {
		shown = "Enter keeps " + config.Mask(saved["SPOTLIGHT_POOL_TOKEN"])
	}
	for range 3 {
		token, err := tty.Secret("Pool token (from Settings → Runners → Add a host)", shown)
		if err != nil {
			return err
		}
		if token == "" {
			token = saved["SPOTLIGHT_POOL_TOKEN"]
		}
		if token != "" {
			return file.Set("SPOTLIGHT_POOL_TOKEN", token)
		}
	}
	return errors.New("a pool token is required")
}

func runtimeAnswers(dockerHost string) error {
	ctx, cancel := context.WithTimeout(context.Background(), timeout)
	defer cancel()
	engine, err := docker.Connect(dockerHost)
	if err == nil {
		_, err = engine.Describe(ctx)
	}
	if err != nil {
		return fmt.Errorf("nothing saved, because no container runtime answers. A host runs each sandbox in a container: start Docker or Podman (on macOS, Docker Desktop, OrbStack or Colima), then run this again: %w", err)
	}
	return nil
}

func runtimeMemory(out io.Writer, dockerHost string) int64 {
	ctx, cancel := context.WithTimeout(context.Background(), timeout)
	defer cancel()
	engine, err := docker.Connect(dockerHost)
	var memory int64
	if err == nil {
		memory, err = engine.Memory(ctx)
	}
	if err != nil {
		fmt.Fprintf(out, "  %s The container runtime does not give its memory, so init suggests no memory limit: %v\n",
			mark(warned), err)
	}
	return memory
}

// reach stops on a credential Spotlight refuses, and only warns when Spotlight does not answer.
func reach(ctx context.Context, out io.Writer, cfg config.Config) error {
	id := readHostID(cfg.State)
	if id == "" {
		id = "init"
	}
	claims, err := pool.New(cfg.URL, cfg.Credential(), id)
	if err != nil {
		return config.Friendly(err)
	}

	_, err = claims.Requirements(ctx)
	switch {
	case errors.Is(err, control.ErrUnauthorized):
		return fmt.Errorf("nothing saved, because Spotlight at %s does not accept the credential", cfg.URL)
	case err != nil:
		fmt.Fprintf(out, "  %s Spotlight at %s does not answer, so the credential is not checked: %v\n", mark(warned), cfg.URL, err)
	default:
		console.Step(out, "Spotlight at "+cfg.URL+" accepts the credential")
	}
	return nil
}

func pull(out io.Writer, cfg config.Config) error {
	image := cfg.Images.Default
	if image == "" || strings.Contains(image, "*") {
		return nil
	}

	engine, err := docker.Connect(cfg.DockerHost)
	if err != nil {
		return fmt.Errorf("no container runtime answers; start Docker or Podman, then run this again: %w", err)
	}
	if local, err := engine.Inspect(context.Background(), image); err == nil && len(local.Digests) == 0 {
		console.Step(out, "Uses "+image+", built on this machine")
		return nil
	}
	auth, err := registry.From(cfg.Registry).For(image)
	if err != nil {
		return err
	}

	fmt.Fprintf(out, "  Pulling %s…\n", image)
	ctx, cancel := context.WithTimeout(context.Background(), pullWait)
	defer cancel()
	if err := engine.Pull(ctx, image, auth); err != nil {
		if _, local := engine.Inspect(ctx, image); local != nil {
			return fmt.Errorf("pull %s: %w", image, err)
		}
		fmt.Fprintf(out, "  %s Could not pull %s, so the host uses the copy on this machine: %v\n", mark(warned), image, err)
		return nil
	}
	console.Step(out, "Pulled "+image)
	return nil
}

func serveIt(out io.Writer, version string, cfg config.Config, noService bool) error {
	pid, err := config.Serving(cfg.State)
	if err != nil {
		return err
	}
	if pid != 0 {
		return apply(out, version, config.Settings, false)
	}

	if noService {
		fmt.Fprintln(out, "\nStart the host with: spotlight host serve")
		return nil
	}

	binary, err := os.Executable()
	if err != nil {
		return err
	}
	if binary, err = filepath.EvalSymlinks(binary); err != nil {
		return err
	}
	return install.Service{Binary: binary, Config: config.Path()}.Install(out)
}

func onlyURL(given map[string]bool) bool {
	return len(given) == 0 || len(given) == 1 && given["url"]
}

func connected() bool {
	file, err := config.Open(config.Path())
	if err != nil {
		return false
	}
	saved := file.Values()
	return saved["SPOTLIGHT_POOL_TOKEN"] != "" || saved["SPOTLIGHT_TRUST"] != ""
}

func loginAddress() string {
	if address := login.Suggested(); address != "" {
		return address
	}
	return credentials.DefaultAddress
}
