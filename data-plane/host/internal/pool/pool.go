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

func (c *Client) Seat(handed protocol.Handed) (serve.Worker, error) {
	return control.Seated(c.base, handed)
}

func (c *Client) Requirements(ctx context.Context) (protocol.HostRequirements, error) {
	var out protocol.HostRequirements
	if _, err := c.control.Request(ctx, http.MethodGet, "/api/hosts/requirements", nil, &out); err != nil {
		return protocol.HostRequirements{}, fmt.Errorf("ask what to serve: %w", err)
	}

	return out, nil
}

func (c *Client) Claim(ctx context.Context, offer protocol.HostClaim) (*protocol.Handed, error) {
	ctx, cancel := context.WithTimeout(ctx, control.PollTimeout+15*time.Second)
	defer cancel()

	var handed protocol.Handed
	offer.Host = c.host
	status, err := c.control.Request(ctx, http.MethodPost, "/api/hosts/claim", offer, &handed)
	if err != nil {
		return nil, fmt.Errorf("claim: %w", err)
	}
	if status == http.StatusNoContent {
		return nil, nil
	}
	if handed.Token == "" || handed.RunnerID == "" {
		return nil, fmt.Errorf("claim: the control plane handed no one-run credential")
	}

	return &handed, nil
}

func (c *Client) ClaimCall(ctx context.Context) (*protocol.HostCall, error) {
	return c.control.ClaimCall(ctx, c.host)
}

func (c *Client) AnswerCall(ctx context.Context, id string, answer protocol.HostCallAnswer) error {
	answer.Host = c.host
	return c.control.AnswerCall(ctx, id, answer)
}

func (c *Client) Present(ctx context.Context, presence protocol.HostPresence) (protocol.HostStanding, error) {
	var standing protocol.HostStanding
	if _, err := c.control.Request(ctx, http.MethodPut, c.path(), presence, &standing); err != nil {
		return protocol.HostStanding{}, fmt.Errorf("report presence: %w", err)
	}

	return standing, nil
}

func (c *Client) Leave(ctx context.Context) error {
	if _, err := c.control.Request(ctx, http.MethodDelete, c.path(), nil, nil); err != nil {
		return fmt.Errorf("say it is leaving: %w", err)
	}

	return nil
}

func (c *Client) path() string {
	return "/api/hosts/" + url.PathEscape(c.host)
}
