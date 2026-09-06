// Package control speaks to the control plane over HTTP. Outbound only, so it
// works through an egress proxy and needs no inbound route.
//
// The claim poll doubles as the heartbeat: stop polling and the run is
// requeued for someone else.
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
// answering empty.
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
		// Claims are long-polled. The real deadlines come from the
		// per-request contexts.
		http: &http.Client{Timeout: 2 * time.Minute},
	}, nil
}

func (c *Client) RunnerID() string { return c.runnerID }

func (c *Client) Register(ctx context.Context, in protocol.Registration) error {
	var out protocol.Registered
	if err := c.do(ctx, http.MethodPost, "/api/runners/register", in, &out); err != nil {
		return fmt.Errorf("register: %w", err)
	}
	if out.RunnerID == "" {
		return fmt.Errorf("register: control plane returned no runner id")
	}

	c.runnerID = out.RunnerID
	return nil
}

// Installable asks what to look for. The control plane knows the harnesses;
// the runner only needs to know whether each one is here.
func (c *Client) Installable(ctx context.Context) ([]protocol.Installable, error) {
	var out []protocol.Installable
	if err := c.do(ctx, http.MethodGet, "/api/runners/harnesses", nil, &out); err != nil {
		return nil, fmt.Errorf("ask what to look for: %w", err)
	}

	return out, nil
}

// Kept asks which workspaces to hold on to. An error means no answer, not an
// empty answer: the caller must not read silence as permission to delete.
func (c *Client) Kept(ctx context.Context) ([]string, error) {
	var out protocol.Kept
	if err := c.do(ctx, http.MethodGet, "/api/runners/workspaces", nil, &out); err != nil {
		return nil, fmt.Errorf("ask what to keep: %w", err)
	}

	return out.Keys, nil
}

// OpenPullRequest asks the control plane to open one for this run's branch.
// What reaches GitHub is Spotlight's, so nothing here carries a credential of
// its own beyond the runner's own token.
func (c *Client) OpenPullRequest(
	ctx context.Context, runID string, asked protocol.PullRequest,
) (string, error) {
	var out protocol.Opened
	path := "/api/runs/" + runID + "/pull-request"

	if err := c.do(ctx, http.MethodPost, path, asked, &out); err != nil {
		return "", fmt.Errorf("open a pull request: %w", err)
	}

	return out.URL, nil
}

// AnswerRemark says something back on the pull request, and resolves the
// thread where the agent asked for that.
func (c *Client) AnswerRemark(
	ctx context.Context, runID string, said protocol.Remark,
) error {
	path := "/api/runs/" + runID + "/remark"

	if err := c.do(ctx, http.MethodPost, path, said, nil); err != nil {
		return fmt.Errorf("answer a remark: %w", err)
	}

	return nil
}

// Trace reads another task's run trace, so the agent can study it. The control
// plane allows it only where that task is in the same team as this run.
func (c *Client) Trace(
	ctx context.Context, runID, taskID string,
) (json.RawMessage, error) {
	var out json.RawMessage
	path := "/api/runs/" + runID + "/trace/" + taskID

	if err := c.do(ctx, http.MethodGet, path, nil, &out); err != nil {
		return nil, fmt.Errorf("read a trace: %w", err)
	}

	return out, nil
}

// Claim long-polls for work. An empty queue returns nil, nil, not an error.
func (c *Client) Claim(ctx context.Context) (*protocol.Run, error) {
	ctx, cancel := context.WithTimeout(ctx, PollTimeout+15*time.Second)
	defer cancel()

	var run protocol.Run
	const path = "/api/runners/claim"

	status, err := c.request(ctx, http.MethodPost, path, nil, &run)
	if err != nil {
		return nil, fmt.Errorf("claim: %w", err)
	}
	if status == http.StatusNoContent {
		return nil, nil
	}

	return &run, nil
}

// Said reads what a person has typed at the agent working this run and that
// no turn has been given yet.
func (c *Client) Said(ctx context.Context, runID string) ([]protocol.Said, error) {
	path := fmt.Sprintf("/api/runs/%s/messages", url.PathEscape(runID))

	var said []protocol.Said
	if err := c.do(ctx, http.MethodGet, path, nil, &said); err != nil {
		return nil, fmt.Errorf("read what was said: %w", err)
	}

	return said, nil
}

// Delivered says the agent has been given everything up to this note, so it
// is not handed the same words twice.
func (c *Client) Delivered(ctx context.Context, runID string, upTo int) error {
	path := fmt.Sprintf("/api/runs/%s/messages/delivered", url.PathEscape(runID))
	body := struct {
		UpTo int `json:"upTo"`
	}{UpTo: upTo}

	if err := c.do(ctx, http.MethodPost, path, body, nil); err != nil {
		return fmt.Errorf("mark what was said delivered: %w", err)
	}

	return nil
}

// RenewLease keeps the claim alive and reports whether a person has since
// asked the run to stop. The heartbeat doubles as how a stop reaches the runner.
func (c *Client) RenewLease(ctx context.Context, runID string) (bool, error) {
	path := fmt.Sprintf("/api/runs/%s/lease", url.PathEscape(runID))

	var out struct {
		Stop bool `json:"stop"`
	}
	if err := c.do(ctx, http.MethodPost, path, nil, &out); err != nil {
		return false, fmt.Errorf("renew lease: %w", err)
	}

	return out.Stop, nil
}

// AppendEvents adds to the run's journal. Events carry their own sequence, so
// a retried batch is not duplicated.
func (c *Client) AppendEvents(ctx context.Context, runID string, events []protocol.Event) error {
	if len(events) == 0 {
		return nil
	}

	// Wrapped in an object so batch-level fields can be added later without
	// breaking older runners.
	batch := struct {
		Events []protocol.Event `json:"events"`
	}{Events: events}

	path := fmt.Sprintf("/api/runs/%s/events", url.PathEscape(runID))
	if err := c.do(ctx, http.MethodPost, path, batch, nil); err != nil {
		return fmt.Errorf("append events: %w", err)
	}
	return nil
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
	// The token is the runner's own, so it says which runner is calling. There
	// is no separate header to claim an identity with.
	request.Header.Set("Authorization", "Bearer "+c.token)
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
