package secret

import (
	"context"
	"errors"
	"flag"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"text/tabwriter"
	"time"

	"golang.org/x/term"

	"usespotlight.ai/data-plane/console"
	"usespotlight.ai/data-plane/control"
	"usespotlight.ai/data-plane/credentials"
	"usespotlight.ai/data-plane/flagset"
	"usespotlight.ai/data-plane/help"
)

const (
	urlVar       = credentials.URLVar
	workspaceVar = "SPOTLIGHT_WORKSPACE"
	tokenVar     = "SPOTLIGHT_API_TOKEN"
	clientHeader = "Spotlight-Client"
)

type Secret struct {
	Name       string   `json:"name"`
	Hosts      []string `json:"hosts"`
	Origin     string   `json:"valueOrigin"`
	ValueSetAt *string  `json:"valueSetAt"`
	Settable   bool     `json:"settable"`
}

type workspace struct {
	Slug string `json:"slug"`
}

type cli struct {
	env     func(string) string
	in      io.Reader
	out     io.Writer
	version string
	typed   func(question string) (string, bool, error)
	client  func(address, token string) (*control.Client, error)
}

func Main(args []string, version string) int {
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	c := &cli{env: os.Getenv, in: os.Stdin, out: os.Stdout, version: version, typed: typedOnTerminal, client: control.New}

	if err := c.run(ctx, args); err != nil {
		fmt.Fprintln(os.Stderr, "spotlight secret:", err)
		return 1
	}

	return 0
}

func typedOnTerminal(question string) (string, bool, error) {
	if !term.IsTerminal(int(os.Stdin.Fd())) {
		return "", false, nil
	}
	tty := console.Open()
	if tty == nil {
		return "", false, nil
	}
	defer tty.Close()

	typed, err := tty.Secret(question, "")
	return typed, true, err
}

func (c *cli) run(ctx context.Context, args []string) error {
	if len(args) == 0 {
		return errors.New(secretHelp.Synopsis())
	}

	switch args[0] {
	case "list":
		return c.list(ctx, args[1:])
	case "set":
		return c.set(ctx, args[1:])
	default:
		return fmt.Errorf("no command %q\n%s", "secret "+args[0], secretHelp.Synopsis())
	}
}

type target struct {
	api       *control.Client
	workspace string
}

func (c *cli) target(ctx context.Context, shown help.Command, args []string) (target, []string, error) {
	set := flag.NewFlagSet(shown.Path, flag.ContinueOnError)
	set.SetOutput(io.Discard)
	given := set.String("url", "", "")
	named := set.String("workspace", "", "")

	positional, err := flagset.Interspersed(set, args)
	if err != nil {
		return target{}, nil, errors.New(shown.Synopsis())
	}

	address, err := credentials.Choose(c.env, *given)
	if err != nil {
		return target{}, nil, err
	}

	token := strings.TrimSpace(c.env(tokenVar))
	if token == "" {
		if token, err = credentials.Stored(c.env, address); err != nil {
			return target{}, nil, err
		}
	}
	if token == "" {
		return target{}, nil, fmt.Errorf("no login for %s. Run %s, or set %s", address, credentials.Command("spotlight login", address), tokenVar)
	}

	api, err := c.client(address, token)
	if err != nil {
		return target{}, nil, err
	}

	slug := firstOf(*named, c.env(workspaceVar))
	if slug == "" {
		if slug, err = c.onlyWorkspace(ctx, api); err != nil {
			return target{}, nil, err
		}
	}

	return target{api: api, workspace: slug}, positional, nil
}

func (c *cli) onlyWorkspace(ctx context.Context, api *control.Client) (string, error) {
	var listed struct {
		Items []workspace `json:"items"`
	}
	if _, err := api.RequestWith(ctx, http.MethodGet, "/api/v1/resources/workspaces", c.headers(), nil, &listed); err != nil {
		return "", fmt.Errorf("list your workspaces: %w", err)
	}

	switch len(listed.Items) {
	case 0:
		return "", errors.New("you are in no workspace")
	case 1:
		return listed.Items[0].Slug, nil
	default:
		slugs := make([]string, 0, len(listed.Items))
		for _, each := range listed.Items {
			slugs = append(slugs, each.Slug)
		}
		return "", fmt.Errorf("you are in the workspaces %s. Say which one with --workspace, or set %s", strings.Join(slugs, ", "), workspaceVar)
	}
}

func (c *cli) headers() http.Header {
	return http.Header{clientHeader: {"cli/" + c.version}}
}

func secretsPath(workspace string) string {
	return "/api/workspaces/" + url.PathEscape(workspace) + "/secrets"
}

func (c *cli) list(ctx context.Context, args []string) error {
	at, positional, err := c.target(ctx, listHelp, args)
	if err != nil {
		return err
	}
	if len(positional) > 0 {
		return errors.New(listHelp.Synopsis())
	}

	var secrets []Secret
	if _, err := at.api.RequestWith(ctx, http.MethodGet, secretsPath(at.workspace), c.headers(), nil, &secrets); err != nil {
		return described("list the secrets", err)
	}

	if len(secrets) == 0 {
		_, err := fmt.Fprintf(c.out, "The workspace %s has no secrets. Terraform defines them with spotlight_secret.\n", at.workspace)
		return err
	}

	table := tabwriter.NewWriter(c.out, 0, 0, 3, ' ', 0)
	fmt.Fprintln(table, "NAME\tVALUE\tSET AT\tHOSTS")
	for _, each := range secrets {
		fmt.Fprintf(table, "%s\t%s\t%s\t%s\n", each.Name, originText(each.Origin), setAtText(each.ValueSetAt), strings.Join(each.Hosts, ", "))
	}

	return table.Flush()
}

func originText(origin string) string {
	switch origin {
	case "awaiting":
		return "Awaiting a value"
	case "spotlight":
		return "Stored in Spotlight"
	case "terraform":
		return "Set by Terraform"
	default:
		return origin
	}
}

func setAtText(at *string) string {
	if at == nil {
		return "-"
	}
	parsed, err := time.Parse(time.RFC3339, *at)
	if err != nil {
		return *at
	}
	return parsed.Local().Format("2006-01-02 15:04")
}

func (c *cli) set(ctx context.Context, args []string) error {
	at, positional, err := c.target(ctx, setHelp, args)
	if err != nil {
		return err
	}
	if len(positional) != 1 {
		return errors.New(setHelp.Synopsis())
	}
	name := positional[0]

	value, err := c.value(name)
	if err != nil {
		return err
	}

	path := secretsPath(at.workspace) + "/" + url.PathEscape(name) + "/value"
	if _, err := at.api.RequestWith(ctx, http.MethodPut, path, c.headers(), map[string]string{"value": value}, nil); err != nil {
		return described("set "+name, err)
	}

	_, err = fmt.Fprintf(c.out, "Spotlight stores the new value of %s.\n", name)
	return err
}

func (c *cli) value(name string) (string, error) {
	typed, onTerminal, err := c.typed("Value of " + name)
	if err != nil {
		return "", err
	}
	if !onTerminal {
		read, err := io.ReadAll(c.in)
		if err != nil {
			return "", fmt.Errorf("read the value from stdin: %w", err)
		}
		typed = withoutNewline(string(read))
	}
	if typed == "" {
		return "", errors.New("the value is empty. Type it, or send it to stdin")
	}

	return typed, nil
}

func withoutNewline(read string) string {
	if trimmed, found := strings.CutSuffix(read, "\r\n"); found {
		return trimmed
	}
	return strings.TrimSuffix(read, "\n")
}

func described(doing string, err error) error {
	var rejected *control.ResponseError
	if errors.As(err, &rejected) {
		switch rejected.Status {
		case http.StatusUnauthorized:
			return fmt.Errorf("%s: your login ended. Run spotlight login", doing)
		case http.StatusForbidden:
			return fmt.Errorf("%s: you do not manage the workspace's secrets", doing)
		case http.StatusNotFound:
			return fmt.Errorf("%s: no such secret or workspace", doing)
		}
		if message, ok := rejected.ClientErrorMessage(); ok {
			return fmt.Errorf("%s: %s", doing, message)
		}
	}
	return fmt.Errorf("%s: %w", doing, err)
}

func firstOf(values ...string) string {
	for _, each := range values {
		if trimmed := strings.TrimSpace(each); trimmed != "" {
			return trimmed
		}
	}
	return ""
}
