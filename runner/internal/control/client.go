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

const PollTimeout = 10 * time.Second

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
		http:  &http.Client{Timeout: 2 * time.Minute},
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

func (c *Client) Installable(ctx context.Context) ([]protocol.Installable, error) {
	var out []protocol.Installable
	if err := c.do(ctx, http.MethodGet, "/api/runners/harnesses", nil, &out); err != nil {
		return nil, fmt.Errorf("ask what to look for: %w", err)
	}

	return out, nil
}

// An error is no answer, not an empty one: never read it as permission to delete.
func (c *Client) Kept(ctx context.Context) ([]string, error) {
	var out protocol.Kept
	if err := c.do(ctx, http.MethodGet, "/api/runners/workspaces", nil, &out); err != nil {
		return nil, fmt.Errorf("ask what to keep: %w", err)
	}

	return out.Keys, nil
}

func (c *Client) UseTool(
	ctx context.Context, runID, name string, input json.RawMessage,
) (json.RawMessage, error) {
	var out json.RawMessage
	path := "/api/runs/" + runID + "/tools/" + url.PathEscape(name)

	if err := c.do(ctx, http.MethodPost, path, input, &out); err != nil {
		return nil, fmt.Errorf("use %s: %w", name, err)
	}

	return out, nil
}

func (c *Client) AnswerRemark(
	ctx context.Context, runID string, said protocol.Remark,
) error {
	path := "/api/runs/" + runID + "/remark"

	if err := c.do(ctx, http.MethodPost, path, said, nil); err != nil {
		return fmt.Errorf("answer a remark: %w", err)
	}

	return nil
}

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

func (c *Client) Said(ctx context.Context, runID string) ([]protocol.Said, error) {
	path := fmt.Sprintf("/api/runs/%s/messages", url.PathEscape(runID))

	var said []protocol.Said
	if err := c.do(ctx, http.MethodGet, path, nil, &said); err != nil {
		return nil, fmt.Errorf("read what was said: %w", err)
	}

	return said, nil
}

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

func (c *Client) AppendEvents(ctx context.Context, runID string, events []protocol.Event) error {
	if len(events) == 0 {
		return nil
	}

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

func (c *Client) Attachment(
	ctx context.Context, runID, attachmentID string, into io.Writer,
) error {
	path := fmt.Sprintf(
		"/api/runs/%s/attachments/%s",
		url.PathEscape(runID), url.PathEscape(attachmentID),
	)

	response, err := c.send(ctx, http.MethodGet, path, nil)
	if err != nil {
		return fmt.Errorf("fetch an attachment: %w", err)
	}
	defer response.Body.Close()

	if response.StatusCode >= 300 {
		return fmt.Errorf("fetch an attachment: %w", refused(http.MethodGet, path, response))
	}

	if _, err := io.Copy(into, response.Body); err != nil {
		return fmt.Errorf("fetch an attachment: %s %s: %w", http.MethodGet, path, err)
	}

	return nil
}

func (c *Client) DraftChangeStack(ctx context.Context, runID, repository, diff string) error {
	path := fmt.Sprintf("/api/runs/%s/change-stacks", url.PathEscape(runID))
	handed := protocol.ChangeStackDraft{Diff: diff, Repository: repository}

	if err := c.do(ctx, http.MethodPost, path, handed, nil); err != nil {
		return fmt.Errorf("hand over what a run changed: %w", err)
	}

	return nil
}

func (c *Client) ChangeStackChecks(ctx context.Context, runID string) (protocol.StackChecks, error) {
	path := fmt.Sprintf("/api/runs/%s/change-stack-checks", url.PathEscape(runID))

	var out protocol.StackChecks
	if err := c.do(ctx, http.MethodGet, path, nil, &out); err != nil {
		return protocol.StackChecks{}, fmt.Errorf("ask what change stacks to check: %w", err)
	}

	return out, nil
}

func (c *Client) RecordChangeStackCheck(
	ctx context.Context, runID, stackID string, checked protocol.StackChecked,
) error {
	path := fmt.Sprintf(
		"/api/runs/%s/change-stack-checks/%s",
		url.PathEscape(runID), url.PathEscape(stackID),
	)

	if err := c.do(ctx, http.MethodPost, path, checked, nil); err != nil {
		return fmt.Errorf("report a change stack check: %w", err)
	}

	return nil
}

func (c *Client) do(ctx context.Context, method, path string, in, out any) error {
	_, err := c.request(ctx, method, path, in, out)
	return err
}

func (c *Client) request(ctx context.Context, method, path string, in, out any) (int, error) {
	response, err := c.send(ctx, method, path, in)
	if err != nil {
		return 0, err
	}
	defer response.Body.Close()

	if response.StatusCode >= 300 {
		return response.StatusCode, refused(method, path, response)
	}

	if out != nil && response.StatusCode != http.StatusNoContent {
		if err := json.NewDecoder(response.Body).Decode(out); err != nil {
			return response.StatusCode, fmt.Errorf("%s %s: %w", method, path, err)
		}
	}

	return response.StatusCode, nil
}

func (c *Client) send(ctx context.Context, method, path string, in any) (*http.Response, error) {
	var body io.Reader
	if in != nil {
		encoded, err := json.Marshal(in)
		if err != nil {
			return nil, err
		}
		body = bytes.NewReader(encoded)
	}

	request, err := http.NewRequestWithContext(ctx, method, c.base.JoinPath(path).String(), body)
	if err != nil {
		return nil, err
	}
	request.Header.Set("Authorization", "Bearer "+c.token)
	if in != nil {
		request.Header.Set("Content-Type", "application/json")
	}

	return c.http.Do(request)
}

func refused(method, path string, response *http.Response) error {
	detail, _ := io.ReadAll(io.LimitReader(response.Body, 1024))
	return fmt.Errorf(
		"%s %s: %s: %s",
		method, path, response.Status, strings.TrimSpace(string(detail)),
	)
}
