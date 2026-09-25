package pool

import (
	"context"
	"fmt"
	"net/http"
	"net/url"
	"time"

	"usespotlight.ai/data-plane/internal/control"
	"usespotlight.ai/data-plane/internal/protocol"
)

type Client struct {
	control *control.Client
	host    string
}

func New(baseURL string, credential control.Credential, host string) (*Client, error) {
	client, err := control.Authorized(baseURL, credential)
	if err != nil {
		return nil, err
	}

	return &Client{control: client, host: host}, nil
}

func (c *Client) Harnesses(ctx context.Context) ([]protocol.Installable, error) {
	var out []protocol.Installable
	if _, err := c.control.Request(ctx, http.MethodGet, "/api/hosts/harnesses", nil, &out); err != nil {
		return nil, fmt.Errorf("ask what harnesses to look for: %w", err)
	}

	return out, nil
}

func (c *Client) Claim(ctx context.Context, harnesses []protocol.HarnessReport) (*protocol.Handed, error) {
	ctx, cancel := context.WithTimeout(ctx, control.PollTimeout+15*time.Second)
	defer cancel()

	var handed protocol.Handed
	status, err := c.control.Request(ctx, http.MethodPost, "/api/hosts/claim",
		protocol.HostClaim{Host: c.host, Harnesses: harnesses}, &handed)
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
