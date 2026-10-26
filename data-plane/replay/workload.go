package replay

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"

	"usespotlight.ai/data-plane/credentials"
)

const (
	trustVar           = "SPOTLIGHT_OIDC_TRUST"
	oidcTokenVar       = "SPOTLIGHT_OIDC_TOKEN"
	oidcAudienceVar    = "SPOTLIGHT_OIDC_AUDIENCE"
	actionsURLVar      = "ACTIONS_ID_TOKEN_REQUEST_URL"
	actionsTokenVar    = "ACTIONS_ID_TOKEN_REQUEST_TOKEN"
	defaultAudience    = "spotlight"
	exchangePath       = "/api/workspace-tokens/exchange"
	workloadAnswerTime = time.Minute
	renewBefore        = 5 * time.Minute
)

type workloadTokens func(audience string) (string, error)

func workloadFrom(env func(string) string, client *http.Client) (workloadTokens, error) {
	if token := env(oidcTokenVar); token != "" {
		return func(string) (string, error) { return token, nil }, nil
	}

	actionsURL, token := env(actionsURLVar), env(actionsTokenVar)
	if actionsURL == "" || token == "" {
		return nil, fmt.Errorf("%s needs an OIDC token: set %s, or run in GitHub Actions with permissions: id-token: write", trustVar, oidcTokenVar)
	}

	return func(audience string) (string, error) {
		return actionsToken(client, actionsURL, token, audience)
	}, nil
}

func actionsToken(client *http.Client, requestURL, requestToken, audience string) (string, error) {
	target, err := url.Parse(requestURL)
	if err != nil {
		return "", fmt.Errorf("%s is not a URL: %w", actionsURLVar, err)
	}

	query := target.Query()
	query.Set("audience", audience)
	target.RawQuery = query.Encode()

	request, err := http.NewRequest(http.MethodGet, target.String(), nil)
	if err != nil {
		return "", err
	}
	request.Header.Set("Authorization", "Bearer "+requestToken)
	request.Header.Set("Accept", "application/json")

	response, err := client.Do(request)
	if err != nil {
		return "", fmt.Errorf("GitHub Actions did not answer the OIDC token request: %w", err)
	}
	defer response.Body.Close()

	body, err := io.ReadAll(response.Body)
	if err != nil {
		return "", err
	}

	if response.StatusCode != http.StatusOK {
		return "", fmt.Errorf("GitHub Actions answered the OIDC token request with %d: %s; the job needs permissions: id-token: write",
			response.StatusCode, strings.TrimSpace(string(body)))
	}

	var answered struct {
		Value string `json:"value"`
	}
	if err := json.Unmarshal(body, &answered); err != nil {
		return "", fmt.Errorf("GitHub Actions answered an OIDC token this cannot read: %w", err)
	}
	if answered.Value == "" {
		return "", errors.New("GitHub Actions answered no OIDC token")
	}

	return answered.Value, nil
}

type exchanging struct {
	base     string
	trust    string
	audience string
	version  string
	workload workloadTokens
	client   *http.Client
	now      func() time.Time

	mu      sync.Mutex
	cached  string
	renewAt time.Time
}

func renewalOf(expiresAt, now time.Time) time.Time {
	if remaining := expiresAt.Sub(now); remaining < 2*renewBefore {
		return now.Add(remaining / 2)
	}

	return expiresAt.Add(-renewBefore)
}

func (e *exchanging) token(renewed bool) (string, error) {
	e.mu.Lock()
	defer e.mu.Unlock()

	if e.cached != "" && !renewed && e.now().Before(e.renewAt) {
		return e.cached, nil
	}

	workload, err := e.workload(e.audience)
	if err != nil {
		return "", fmt.Errorf("could not get an OIDC token for the audience %s: %w", e.audience, err)
	}

	sent, err := json.Marshal(map[string]string{"trust": e.trust, "token": workload})
	if err != nil {
		return "", err
	}

	request, err := http.NewRequest(http.MethodPost, strings.TrimSuffix(e.base, "/")+exchangePath, bytes.NewReader(sent))
	if err != nil {
		return "", err
	}
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("Accept", "application/json")
	request.Header.Set(clientHeader, "cli/"+e.version)

	response, err := e.client.Do(request)
	if err != nil {
		return "", fmt.Errorf("reach Spotlight to exchange the OIDC token: %w", err)
	}
	defer response.Body.Close()

	body, err := io.ReadAll(response.Body)
	if err != nil {
		return "", err
	}

	if response.StatusCode != http.StatusOK {
		return "", fmt.Errorf("the OIDC trust %s did not accept the OIDC token: %s", e.trust, problemOf(response.StatusCode, body))
	}

	var issued struct {
		Token     string `json:"token"`
		ExpiresAt string `json:"expiresAt"`
	}
	if err := json.Unmarshal(body, &issued); err != nil || issued.Token == "" {
		return "", errors.New("Spotlight answered the exchange with no token this can read")
	}

	expiresAt, err := time.Parse(time.RFC3339, issued.ExpiresAt)
	if err != nil {
		return "", fmt.Errorf("the issued token's expiry %q is not a time", issued.ExpiresAt)
	}

	e.cached = issued.Token
	e.renewAt = renewalOf(expiresAt, e.now())

	return e.cached, nil
}

func problemOf(status int, body []byte) string {
	var errorBody struct {
		Detail  string `json:"detail"`
		Title   string `json:"title"`
		Message any    `json:"message"`
	}
	_ = json.Unmarshal(body, &errorBody)

	switch {
	case errorBody.Detail != "":
		return errorBody.Detail
	case errorBody.Title != "":
		return errorBody.Title
	}

	if message, ok := errorBody.Message.(string); ok && message != "" {
		return message
	}

	return fmt.Sprintf("Spotlight answered %d", status)
}

func checkAPI(env func(string) string, version string, now func() time.Time) (*api, error) {
	base := env(urlVar)
	if base == "" {
		return nil, fmt.Errorf("set %s, and %s, %s or a login from spotlight login, to check a plan\n%s", urlVar, tokenVar, trustVar, checkHelp.Synopsis())
	}

	if token := env(tokenVar); token != "" {
		return newAPI(base, token, version), nil
	}

	trust := env(trustVar)
	if trust == "" {
		token, err := credentials.Stored(env, base)
		if err != nil {
			return nil, fmt.Errorf("read the login for %s: %w", base, err)
		}
		if token == "" {
			return nil, fmt.Errorf("no credentials for %s. Set %s, a workspace token that may plan, or %s, an OIDC trust to exchange the job's OIDC token through, or run spotlight login\n%s", base, tokenVar, trustVar, checkHelp.Synopsis())
		}
		return newAPI(base, token, version), nil
	}

	client := &http.Client{Timeout: workloadAnswerTime}
	workload, err := workloadFrom(env, client)
	if err != nil {
		return nil, err
	}

	audience := env(oidcAudienceVar)
	if audience == "" {
		audience = defaultAudience
	}

	source := &exchanging{
		base:     base,
		trust:    trust,
		audience: audience,
		version:  version,
		workload: workload,
		client:   client,
		now:      now,
	}

	return newAPIWith(base, version, source.token, true), nil
}
