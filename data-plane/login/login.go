package login

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"os/exec"
	"os/signal"
	"runtime"
	"slices"
	"strings"
	"syscall"
	"time"
	"unicode"

	"golang.org/x/term"

	"usespotlight.ai/data-plane/console"
	"usespotlight.ai/data-plane/credentials"
)

const (
	defaultAddress = credentials.DefaultAddress
	urlVar         = credentials.URLVar
	clientID       = "spotlight-cli"
	deviceGrant    = "urn:ietf:params:oauth:grant-type:device_code"
	clientHeader   = "Spotlight-Client"
	defaultEvery   = 5 * time.Second
	slowDownStep   = 5 * time.Second
	answerTime     = 30 * time.Second
	stoppedExit    = 130
)

// ErrStopped is the error of a login that Ctrl-C or SIGTERM stopped.
var ErrStopped = errors.New("stopped. No login was kept")

type client struct {
	env     func(string) string
	out     io.Writer
	http    *http.Client
	version string
	browse  func(string) error
	ask     func(question, shown string) (string, error)
	sleep   func(context.Context, time.Duration) error
	now     func() time.Time
}

type deviceCode struct {
	DeviceCode              string `json:"device_code"`
	UserCode                string `json:"user_code"`
	VerificationURI         string `json:"verification_uri"`
	VerificationURIComplete string `json:"verification_uri_complete"`
	ExpiresIn               int    `json:"expires_in"`
	Interval                int    `json:"interval"`
}

type grant struct {
	AccessToken      string `json:"access_token"`
	Error            string `json:"error"`
	ErrorDescription string `json:"error_description"`
}

type session struct {
	User struct {
		Email string `json:"email"`
	} `json:"user"`
}

// Main runs spotlight login, then prints what next says for the address it logged in to.
func Main(args []string, version string, next func(address string) string) int {
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	address, err := newClient(version).login(ctx, args)
	if errors.As(err, &notSpotlight{}) {
		err = fmt.Errorf("%w. To log in to another address, run: spotlight login --url <address>", err)
	}
	if err == nil && next != nil {
		if line := next(address); line != "" {
			fmt.Println(line)
		}
	}
	return exit("spotlight login", err)
}

// Request is a login that waits for its approval in the browser.
type Request struct {
	Address string
	Page    string
	Code    string
	client  *client
	device  deviceCode
}

// Start asks Spotlight at the address for a login code. The address can be without https://.
func Start(ctx context.Context, address, version string) (*Request, error) {
	normalized, err := normalized(address)
	if err != nil {
		return nil, err
	}
	return newClient(version).start(ctx, normalized)
}

// Open opens the login page in the browser.
func (r *Request) Open() error {
	return browse(r.Page)
}

// Wait waits for the approval in the browser, then keeps the login. It returns the user.
func (r *Request) Wait(ctx context.Context) (string, error) {
	return r.client.wait(ctx, r)
}

// Suggested is the address that a login without --url uses: SPOTLIGHT_URL, else the one saved login, else the default address. It is empty when there are several logins.
func Suggested() string {
	address, err := credentials.Choose(os.Getenv, "")
	if err != nil {
		return ""
	}
	return address
}

// LogIn logs in at the given address. Without one, it uses the one saved login, else asks on the terminal.
func LogIn(ctx context.Context, given, version string) (string, error) {
	c := newClient(version)
	address, err := c.loginAddress(given)
	if err != nil {
		return "", err
	}
	return address, c.logIn(ctx, address, false)
}

func Logout(args []string, version string) int {
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	return exit("spotlight logout", newClient(version).logout(ctx, args))
}

func newClient(version string) *client {
	c := &client{
		env:     os.Getenv,
		out:     os.Stdout,
		http:    &http.Client{Timeout: answerTime},
		version: version,
		sleep:   sleep,
		now:     time.Now,
	}
	if term.IsTerminal(int(os.Stdout.Fd())) {
		c.browse = browse
	}
	if term.IsTerminal(int(os.Stdin.Fd())) {
		c.ask = func(question, shown string) (string, error) {
			tty := console.Open()
			if tty == nil {
				return "", nil
			}
			defer tty.Close()
			return tty.Ask(question, shown)
		}
	}

	return c
}

func exit(command string, err error) int {
	switch {
	case err == nil:
		return 0
	case errors.Is(err, ErrStopped):
		fmt.Fprintln(os.Stderr, command+":", err)
		return stoppedExit
	default:
		fmt.Fprintln(os.Stderr, command+":", err)
		return 1
	}
}

func sleep(ctx context.Context, wait time.Duration) error {
	timer := time.NewTimer(wait)
	defer timer.Stop()

	select {
	case <-ctx.Done():
		return ctx.Err()
	case <-timer.C:
		return nil
	}
}

func browse(page string) error {
	var command *exec.Cmd
	switch runtime.GOOS {
	case "darwin":
		command = exec.Command("open", page)
	case "linux":
		command = exec.Command("xdg-open", page)
	default:
		return errors.ErrUnsupported
	}

	if err := command.Start(); err != nil {
		return err
	}
	go func() { _ = command.Wait() }()

	return nil
}

func (c *client) address(set *flag.FlagSet, args []string) (string, error) {
	given, err := c.given(set, args)
	if err != nil {
		return "", err
	}
	return credentials.Choose(c.env, given)
}

func (c *client) given(set *flag.FlagSet, args []string) (string, error) {
	set.SetOutput(io.Discard)
	given := set.String("url", "", "the Spotlight address")

	if err := set.Parse(args); err != nil || set.NArg() > 0 {
		shown := loginHelp
		switch set.Name() {
		case logoutHelp.Path:
			shown = logoutHelp
		case tokenHelp.Path:
			shown = tokenHelp
		}
		return "", fmt.Errorf("%s", shown.Synopsis())
	}

	return *given, nil
}

func loginHint(address string) string {
	if address == defaultAddress {
		return "spotlight login"
	}
	return "spotlight login --url " + address
}

func (c *client) login(ctx context.Context, args []string) (string, error) {
	set := flag.NewFlagSet("login", flag.ContinueOnError)
	set.SetOutput(io.Discard)
	noBrowser := set.Bool("no-browser", false, "do not open the browser")
	given := set.String("url", "", "the Spotlight address")
	if err := set.Parse(args); err != nil || set.NArg() > 0 {
		return "", fmt.Errorf("%s", loginHelp.Synopsis())
	}

	address, err := c.loginAddress(*given)
	if err != nil {
		return "", err
	}
	return address, c.logIn(ctx, address, *noBrowser)
}

func (c *client) loginAddress(given string) (string, error) {
	if given == "" {
		given = c.env(urlVar)
	}
	if given != "" {
		return credentials.Address(given)
	}

	saved, err := c.savedAddresses()
	if err != nil {
		return "", err
	}
	switch {
	case len(saved) == 1:
		return saved[0], nil
	case c.ask == nil && len(saved) == 0:
		return defaultAddress, nil
	case c.ask == nil:
		return "", fmt.Errorf("there are logins for %s. Say which one with --url", strings.Join(saved, ", "))
	}

	answer, err := c.ask("Spotlight address", defaultAddress)
	if err != nil {
		return "", err
	}
	return normalized(answer)
}

func normalized(answer string) (string, error) {
	answer = strings.TrimSpace(answer)
	if answer == "" {
		answer = defaultAddress
	}
	if !strings.Contains(answer, "://") {
		answer = "https://" + answer
	}
	return credentials.Address(answer)
}

func (c *client) savedAddresses() ([]string, error) {
	path, err := credentials.Path(c.env)
	if err != nil {
		return nil, nil
	}
	file, err := credentials.Load(path)
	if err != nil {
		return nil, err
	}
	saved := file.Addresses()
	slices.Sort(saved)
	return saved, nil
}

func (c *client) logIn(ctx context.Context, address string, noBrowser bool) error {
	request, err := c.start(ctx, address)
	if err != nil {
		return err
	}

	fmt.Fprintf(c.out, "Open this page to log in to %s:\n  %s\n", address, request.Page)
	fmt.Fprintf(c.out, "Check that the page shows the code %s.\n", request.Code)
	if !noBrowser && c.browse != nil && c.browse(request.Page) == nil {
		fmt.Fprintln(c.out, "Opened the page in your browser.")
	}
	fmt.Fprintln(c.out, "Waiting for you to approve the login. Press Ctrl-C to stop.")

	user, err := c.wait(ctx, request)
	if err != nil {
		return err
	}

	fmt.Fprintf(c.out, "Logged in to %s as %s.\n", address, user)
	return nil
}

func (c *client) start(ctx context.Context, address string) (*Request, error) {
	if _, err := credentials.Path(c.env); err != nil {
		return nil, err
	}

	code, err := c.deviceCode(ctx, address)
	if err != nil {
		return nil, stopped(ctx, err)
	}

	page := code.VerificationURIComplete
	if page == "" {
		page = code.VerificationURI
	}
	if !webPage(page) {
		return nil, fmt.Errorf("Spotlight at %s gave a login page that is not an http or https address", address)
	}

	return &Request{Address: address, Page: printable(page), Code: printable(shown(code.UserCode)), client: c, device: code}, nil
}

func (c *client) wait(ctx context.Context, request *Request) (string, error) {
	token, err := c.poll(ctx, request.Address, request.device)
	if err != nil {
		return "", stopped(ctx, err)
	}

	user, err := c.user(ctx, request.Address, token)
	if err != nil {
		return "", stopped(ctx, err)
	}

	path, err := credentials.Path(c.env)
	if err != nil {
		return "", err
	}
	file, err := credentials.Load(path)
	if err != nil {
		return "", err
	}
	if err := file.Put(request.Address, credentials.Login{Token: token, User: user}); err != nil {
		return "", err
	}
	if err := file.Save(); err != nil {
		return "", err
	}

	return printable(user), nil
}

func webPage(page string) bool {
	parsed, err := url.Parse(page)

	return err == nil && (parsed.Scheme == "https" || parsed.Scheme == "http") && parsed.Host != ""
}

func printable(text string) string {
	return strings.Map(func(r rune) rune {
		if unicode.IsControl(r) {
			return -1
		}
		return r
	}, text)
}

func shown(userCode string) string {
	if len(userCode) == 8 {
		return userCode[:4] + "-" + userCode[4:]
	}

	return userCode
}

func stopped(ctx context.Context, err error) error {
	if ctx.Err() != nil {
		return ErrStopped
	}

	return err
}

func (c *client) deviceCode(ctx context.Context, address string) (deviceCode, error) {
	var code deviceCode
	status, err := c.call(ctx, http.MethodPost, address+"/api/auth/device/code", "", map[string]string{"client_id": clientID}, &code)
	if err != nil {
		return code, err
	}
	if status == http.StatusNotFound {
		return code, notSpotlight{address: address}
	}
	if status != http.StatusOK || code.DeviceCode == "" {
		return code, fmt.Errorf("Spotlight at %s did not give a device code. It answered %d", address, status)
	}

	return code, nil
}

type notSpotlight struct {
	address string
}

func (e notSpotlight) Error() string {
	return fmt.Sprintf("Spotlight at %s did not give a device code. It answered 404, so it may not be a Spotlight address", e.address)
}

func (c *client) poll(ctx context.Context, address string, code deviceCode) (string, error) {
	every := time.Duration(code.Interval) * time.Second
	if every <= 0 {
		every = defaultEvery
	}

	var deadline time.Time
	if code.ExpiresIn > 0 {
		deadline = c.now().Add(time.Duration(code.ExpiresIn) * time.Second)
	}

	body := map[string]string{"grant_type": deviceGrant, "device_code": code.DeviceCode, "client_id": clientID}

	for {
		if err := c.sleep(ctx, every); err != nil {
			return "", err
		}
		if !deadline.IsZero() && c.now().After(deadline) {
			return "", expired()
		}

		var answer grant
		status, err := c.call(ctx, http.MethodPost, address+"/api/auth/device/token", "", body, &answer)
		if err != nil {
			return "", err
		}

		switch {
		case status == http.StatusOK && answer.AccessToken != "":
			return answer.AccessToken, nil
		case answer.Error == "authorization_pending":
		case answer.Error == "slow_down":
			every += slowDownStep
		case answer.Error == "expired_token":
			return "", expired()
		case answer.Error == "access_denied":
			return "", errors.New("the login was denied in the browser")
		case answer.Error != "":
			return "", refused(answer)
		default:
			return "", fmt.Errorf("Spotlight answered %d to the login", status)
		}
	}
}

func expired() error {
	return errors.New("the code expired before the login was approved. Run spotlight login again")
}

func refused(answer grant) error {
	if answer.ErrorDescription != "" {
		return fmt.Errorf("Spotlight refused the login: %s. %s", printable(answer.Error), printable(answer.ErrorDescription))
	}

	return fmt.Errorf("Spotlight refused the login: %s", printable(answer.Error))
}

func (c *client) user(ctx context.Context, address, token string) (string, error) {
	var current *session
	status, err := c.call(ctx, http.MethodGet, address+"/api/auth/get-session", token, nil, &current)
	if err != nil {
		return "", err
	}
	if status != http.StatusOK || current == nil || current.User.Email == "" {
		return "", fmt.Errorf("Spotlight did not accept the new login token. It answered %d", status)
	}

	return current.User.Email, nil
}

func (c *client) logout(ctx context.Context, args []string) error {
	address, err := c.address(flag.NewFlagSet("logout", flag.ContinueOnError), args)
	if err != nil {
		return err
	}

	path, err := credentials.Path(c.env)
	if err != nil {
		return err
	}

	file, err := credentials.Load(path)
	if err != nil {
		return err
	}

	login, found := file.Login(address)
	if !found {
		fmt.Fprintf(c.out, "You are not logged in to %s.\n", address)
		if file.Remove(address) {
			return file.Save()
		}
		return nil
	}

	if err := c.signOut(ctx, address, login.Token); err != nil {
		fmt.Fprintf(c.out, "Spotlight did not end the session: %v. The token stays valid until it expires.\n", err)
	}

	file.Remove(address)
	if err := file.Save(); err != nil {
		return err
	}

	fmt.Fprintf(c.out, "Logged out of %s.\n", address)
	return nil
}

func (c *client) signOut(ctx context.Context, address, token string) error {
	status, err := c.call(ctx, http.MethodPost, address+"/api/auth/sign-out", token, map[string]string{}, nil)
	if err != nil {
		return err
	}
	if status >= http.StatusMultipleChoices {
		return fmt.Errorf("it answered %d", status)
	}

	return nil
}

func (c *client) call(ctx context.Context, method, target, token string, body, into any) (int, error) {
	var sent io.Reader
	if body != nil {
		written, err := json.Marshal(body)
		if err != nil {
			return 0, err
		}
		sent = bytes.NewReader(written)
	}

	request, err := http.NewRequestWithContext(ctx, method, target, sent)
	if err != nil {
		return 0, err
	}
	request.Header.Set("Accept", "application/json")
	request.Header.Set(clientHeader, "cli/"+c.version)
	if body != nil {
		request.Header.Set("Content-Type", "application/json")
	}
	if token != "" {
		request.Header.Set("Authorization", "Bearer "+token)
	}

	response, err := c.http.Do(request)
	if err != nil {
		return 0, fmt.Errorf("reach Spotlight: %w", err)
	}
	defer response.Body.Close()

	read, err := io.ReadAll(response.Body)
	if err != nil {
		return 0, fmt.Errorf("read Spotlight's answer: %w", err)
	}

	if into != nil && len(bytes.TrimSpace(read)) > 0 && json.Unmarshal(read, into) != nil {
		if response.StatusCode >= http.StatusMultipleChoices {
			return response.StatusCode, nil
		}
		return 0, fmt.Errorf("Spotlight answered with %q", strings.TrimSpace(string(read)))
	}

	return response.StatusCode, nil
}
