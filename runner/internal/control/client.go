// Package control speaks to the control plane, outbound only.
//
// Registration, long-polling for work, and lease renewal all live here. The
// poll doubles as the heartbeat: stop polling and the control plane requeues
// the run for someone else. Long-polling rather than a persistent socket keeps
// this working through corporate egress proxies and needs nothing routed back.
package control

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"usespotlight.ai/runner/internal/protocol"
)

// PollTimeout is how long the control plane may hold a claim open before
// answering empty. Short enough that a lost connection is noticed.
const PollTimeout = 10 * time.Second

const InputPollTimeout = 25 * time.Second

type Client struct {
	base  *url.URL
	token string
	http  *http.Client

	runnerID string
}

func New(baseURL, token string) (*Client, error) {
	base, err := url.Parse(baseURL)
	if err != nil || base.Scheme == "" || base.Host == "" {
		return nil, fmt.Errorf("control plane url %q is not absolute", baseURL)
	}

	return &Client{
		base:  base,
		token: token,
		// Generous: a claim is long-polled and the server decides when to
		// answer. Per-request contexts impose the real deadlines.
		http: &http.Client{Timeout: 2 * time.Minute},
	}, nil
}

func (c *Client) RunnerID() string { return c.runnerID }

func (c *Client) Register(ctx context.Context, in protocol.Registration) error {
	var out protocol.Registered
	if err := c.do(ctx, http.MethodPost, "/api/runners", in, &out); err != nil {
		return fmt.Errorf("register: %w", err)
	}
	if out.RunnerID == "" {
		return fmt.Errorf("register: control plane returned no runner id")
	}

	c.runnerID = out.RunnerID
	return nil
}

// Claim long-polls for work. It returns nil, nil when the queue is empty,
// which is the ordinary case and not an error.
func (c *Client) Claim(ctx context.Context) (*protocol.Run, error) {
	ctx, cancel := context.WithTimeout(ctx, PollTimeout+15*time.Second)
	defer cancel()

	var run protocol.Run
	path := fmt.Sprintf("/api/runners/%s/claim", url.PathEscape(c.runnerID))

	status, err := c.request(ctx, http.MethodPost, path, nil, &run)
	if err != nil {
		return nil, fmt.Errorf("claim: %w", err)
	}
	if status == http.StatusNoContent {
		return nil, nil
	}

	return &run, nil
}

func (c *Client) RenewLease(ctx context.Context, runID string) error {
	path := fmt.Sprintf("/api/runs/%s/lease", url.PathEscape(runID))
	if err := c.do(ctx, http.MethodPost, path, nil, nil); err != nil {
		return fmt.Errorf("renew lease: %w", err)
	}
	return nil
}

// AppendEvents adds to the run's journal. Events carry their own sequence, so
// a retried batch is recognisable rather than duplicated.
func (c *Client) AppendEvents(ctx context.Context, runID string, events []protocol.Event) error {
	if len(events) == 0 {
		return nil
	}

	// Wrapped rather than a bare array: an object leaves room to say something
	// about the batch later without breaking every runner in the fleet.
	batch := struct {
		Events []protocol.Event `json:"events"`
	}{Events: events}

	path := fmt.Sprintf("/api/runs/%s/events", url.PathEscape(runID))
	if err := c.do(ctx, http.MethodPost, path, batch, nil); err != nil {
		return fmt.Errorf("append events: %w", err)
	}
	return nil
}

func (c *Client) AwaitInput(ctx context.Context, runID string) ([]protocol.Input, error) {
	ctx, cancel := context.WithTimeout(ctx, InputPollTimeout+15*time.Second)
	defer cancel()

	var pending protocol.PendingInput
	path := fmt.Sprintf("/api/runs/%s/input", url.PathEscape(runID))

	if _, err := c.request(ctx, http.MethodGet, path, nil, &pending); err != nil {
		return nil, fmt.Errorf("await input: %w", err)
	}

	return pending.Input, nil
}

func (c *Client) Complete(ctx context.Context, runID string, done protocol.Completion) error {
	path := fmt.Sprintf("/api/runs/%s/completion", url.PathEscape(runID))
	if err := c.do(ctx, http.MethodPost, path, done, nil); err != nil {
		return fmt.Errorf("complete: %w", err)
	}
	return nil
}

func (c *Client) do(ctx context.Context, method, path string, in, out any) error {
	_, err := c.request(ctx, method, path, in, out)
	return err
}

func (c *Client) request(ctx context.Context, method, path string, in, out any) (int, error) {
	var body io.Reader
	if in != nil {
		encoded, err := json.Marshal(in)
		if err != nil {
			return 0, err
		}
		body = bytes.NewReader(encoded)
	}

	request, err := http.NewRequestWithContext(ctx, method, c.base.JoinPath(path).String(), body)
	if err != nil {
		return 0, err
	}
	request.Header.Set("Authorization", "Bearer "+c.token)
	// Every runner shares one enrollment token, so this is what says which of
	// them is calling. A claim, not a credential: the run's own record of who
	// holds it is what actually decides.
	if c.runnerID != "" {
		request.Header.Set("X-Spotlight-Runner", c.runnerID)
	}
	if in != nil {
		request.Header.Set("Content-Type", "application/json")
	}

	response, err := c.http.Do(request)
	if err != nil {
		return 0, err
	}
	defer response.Body.Close()

	if response.StatusCode >= 300 {
		detail, _ := io.ReadAll(io.LimitReader(response.Body, 1024))
		return response.StatusCode, fmt.Errorf(
			"%s %s: %s: %s",
			method, path, response.Status, strings.TrimSpace(string(detail)),
		)
	}

	if out != nil && response.StatusCode != http.StatusNoContent {
		if err := json.NewDecoder(response.Body).Decode(out); err != nil {
			return response.StatusCode, fmt.Errorf("%s %s: %w", method, path, err)
		}
	}

	return response.StatusCode, nil
}
