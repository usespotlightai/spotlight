package pool

import (
	"context"
	"fmt"
	"net/http"
	"net/url"
	"time"

	"usespotlight.ai/data-plane/control"
	"usespotlight.ai/data-plane/host/internal/serve"
	"usespotlight.ai/data-plane/protocol"
)

type Client struct {
	control *control.Client
	base    string
	host    string
}

func New(baseURL string, credential control.Credential, host string) (*Client, error) {
	client, err := control.Authorized(baseURL, credential)
	if err != nil {
		return nil, err
	}

	return &Client{control: client, base: baseURL, host: host}, nil
}

func (c *Client) ForRun(assignment protocol.Assignment) (serve.RunClient, error) {
	return control.ForRun(c.base, assignment)
}

func (c *Client) Requirements(ctx context.Context) (protocol.HostRequirements, error) {
	var out protocol.HostRequirements
	if _, err := c.control.Request(ctx, http.MethodGet, "/api/hosts/requirements", nil, &out); err != nil {
		return protocol.HostRequirements{}, fmt.Errorf("read what to serve: %w", err)
	}

	return out, nil
}

func (c *Client) Claim(ctx context.Context, offer protocol.HostClaim) (*protocol.Assignment, error) {
	ctx, cancel := context.WithTimeout(ctx, control.PollTimeout+15*time.Second)
	defer cancel()

	var assignment protocol.Assignment
	offer.Host = c.host
	status, err := c.control.Request(ctx, http.MethodPost, "/api/hosts/claim", offer, &assignment)
	if err != nil {
		return nil, fmt.Errorf("claim: %w", err)
	}
	if status == http.StatusNoContent {
		return nil, nil
	}
	if assignment.StartsSandboxOnly() {
		if assignment.SandboxID == "" || assignment.SandboxToken == "" {
			return nil, fmt.Errorf("claim: the sandbox has no id or credential")
		}
		return &assignment, nil
	}
	if assignment.Token == "" || assignment.RunnerID == "" {
		return nil, fmt.Errorf("claim: the assignment has no one-run credential")
	}

	return &assignment, nil
}

func (c *Client) ClaimCall(ctx context.Context) (*protocol.HostCall, error) {
	return c.control.ClaimCall(ctx, c.host)
}

func (c *Client) RecordCallResponse(ctx context.Context, id string, response protocol.HostCallResponse) error {
	response.Host = c.host
	return c.control.RecordCallResponse(ctx, id, response)
}

func (c *Client) Heartbeat(ctx context.Context, heartbeat protocol.HostHeartbeat) (protocol.HeartbeatResponse, error) {
	var response protocol.HeartbeatResponse
	if _, err := c.control.Request(ctx, http.MethodPut, c.path(), heartbeat, &response); err != nil {
		return protocol.HeartbeatResponse{}, fmt.Errorf("send a heartbeat: %w", err)
	}

	return response, nil
}

func (c *Client) Deregister(ctx context.Context) error {
	if _, err := c.control.Request(ctx, http.MethodDelete, c.path(), nil, nil); err != nil {
		return fmt.Errorf("deregister: %w", err)
	}

	return nil
}

func (c *Client) path() string {
	return "/api/hosts/" + url.PathEscape(c.host)
}
