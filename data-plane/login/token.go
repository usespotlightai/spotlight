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
	"os/signal"
	"strings"
	"syscall"

	"usespotlight.ai/data-plane/credentials"
)

const (
	tokenVar           = "SPOTLIGHT_API_TOKEN"
	trustVar           = "SPOTLIGHT_OIDC_TRUST"
	audienceVar        = "SPOTLIGHT_OIDC_AUDIENCE"
	workloadVar        = "SPOTLIGHT_OIDC_TOKEN"
	actionsRequestURL  = "ACTIONS_ID_TOKEN_REQUEST_URL"
	actionsRequestAuth = "ACTIONS_ID_TOKEN_REQUEST_TOKEN"
	defaultAudience    = "spotlight"
	exchangePath       = "/api/v1/workspace-tokens/exchange"
)

func Token(args []string, version string) int {
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	return exit("spotlight token", newClient(version).token(ctx, args))
}

func (c *client) token(ctx context.Context, args []string) error {
	set := flag.NewFlagSet(tokenHelp.Path, flag.ContinueOnError)
	address, err := c.address(set, args)
	if err != nil {
		return err
	}

	token, err := c.chosenToken(ctx, address)
	if err != nil {
		return err
	}

	_, err = fmt.Fprintln(c.out, token)
	return err
}

func (c *client) chosenToken(ctx context.Context, address string) (string, error) {
	if token := strings.TrimSpace(c.env(tokenVar)); token != "" {
		return token, nil
	}

	if trust := strings.TrimSpace(c.env(trustVar)); trust != "" {
		return c.exchanged(ctx, address, trust)
	}

	stored, err := credentials.Stored(c.env, address)
	if err != nil {
		return "", err
	}
	if stored == "" {
		return "", fmt.Errorf("no token for %s. Run spotlight login, or set %s, or %s in CI", address, tokenVar, trustVar)
	}

	return stored, nil
}

func (c *client) exchanged(ctx context.Context, address, trust string) (string, error) {
	workload, err := c.workloadToken(ctx)
	if err != nil {
		return "", err
	}

	body, err := json.Marshal(map[string]string{"trust": trust, "token": workload})
	if err != nil {
		return "", err
	}

	var answered struct {
		Token string `json:"token"`
	}
	if err := c.post(ctx, address+exchangePath, body, &answered); err != nil {
		return "", fmt.Errorf("Spotlight at %s did not exchange the OIDC token through the OIDC trust %s: %w", address, trust, err)
	}
	if answered.Token == "" {
		return "", fmt.Errorf("Spotlight at %s answered the exchange with no token", address)
	}

	return answered.Token, nil
}

func (c *client) workloadToken(ctx context.Context) (string, error) {
	if token := strings.TrimSpace(c.env(workloadVar)); token != "" {
		return token, nil
	}

	requestURL, requestAuth := c.env(actionsRequestURL), c.env(actionsRequestAuth)
	if requestURL == "" || requestAuth == "" {
		return "", fmt.Errorf("%s is set, but no OIDC token was found. Set %s, or run in a GitHub Actions job with the permission id-token: write", trustVar, workloadVar)
	}

	audience := strings.TrimSpace(c.env(audienceVar))
	if audience == "" {
		audience = defaultAudience
	}

	asked, err := url.Parse(requestURL)
	if err != nil {
		return "", fmt.Errorf("%s is not a URL: %w", actionsRequestURL, err)
	}
	query := asked.Query()
	query.Set("audience", audience)
	asked.RawQuery = query.Encode()

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, asked.String(), nil)
	if err != nil {
		return "", err
	}
	req.Header.Set("Authorization", "Bearer "+requestAuth)
	req.Header.Set("Accept", "application/json")

	var answered struct {
		Value string `json:"value"`
	}
	if err := c.send(req, &answered); err != nil {
		return "", fmt.Errorf("GitHub Actions did not give an OIDC token; the job needs the permission id-token: write: %w", err)
	}
	if answered.Value == "" {
		return "", errors.New("GitHub Actions answered no OIDC token")
	}

	return answered.Value, nil
}

func (c *client) post(ctx context.Context, address string, body []byte, into any) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, address, bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")
	req.Header.Set(clientHeader, "cli/"+c.version)

	return c.send(req, into)
}

func (c *client) send(req *http.Request, into any) error {
	resp, err := c.http.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if err != nil {
		return err
	}
	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		return fmt.Errorf("it answered %d: %s", resp.StatusCode, printable(strings.TrimSpace(string(body))))
	}

	return json.Unmarshal(body, into)
}
