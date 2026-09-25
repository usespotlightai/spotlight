package control

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"time"

	"usespotlight.ai/runner/internal/protocol"
)

type Pool struct {
	client *Client
	offer  protocol.Registration
	seated *Client
}

func NewPool(baseURL, token string) (*Pool, error) {
	client, err := New(baseURL, token)
	if err != nil {
		return nil, err
	}

	return &Pool{client: client}, nil
}

func (p *Pool) Installable(ctx context.Context) ([]protocol.Installable, error) {
	if p.client == nil {
		return nil, errSeated
	}

	var out []protocol.Installable
	const path = "/api/pools/harnesses"

	status, err := p.client.request(ctx, http.MethodGet, path, nil, &out)
	if err != nil {
		return nil, fmt.Errorf("ask the pool what to look for: %w", refusal(status, err))
	}

	return out, nil
}

func (p *Pool) Register(_ context.Context, offer protocol.Registration) error {
	p.offer = offer
	return nil
}

func (p *Pool) Claim(ctx context.Context) (*protocol.Claimed, error) {
	if p.client == nil {
		return nil, errSeated
	}

	ctx, cancel := context.WithTimeout(ctx, PollTimeout+15*time.Second)
	defer cancel()

	var claimed protocol.PoolClaimed
	const path = "/api/pools/claim"

	status, err := p.client.request(ctx, http.MethodPost, path, p.offer, &claimed)
	if err != nil {
		return nil, fmt.Errorf("claim from the pool: %w", refusal(status, err))
	}
	if status == http.StatusNoContent {
		return nil, nil
	}
	if claimed.Token == "" || claimed.RunnerID == "" {
		return nil, fmt.Errorf("claim from the pool: control plane returned no runner token")
	}

	p.seated = &Client{
		base:     p.client.base,
		token:    claimed.Token,
		http:     p.client.http,
		runnerID: claimed.RunnerID,
	}
	p.client = nil

	return &claimed.Work, nil
}

func (p *Pool) Seated() *Client { return p.seated }

var errSeated = errors.New("the pool token was already swapped for one piece of work")

func refusal(status int, err error) error {
	if status == http.StatusUnauthorized {
		return fmt.Errorf("%w: %w", ErrRefused, err)
	}
	return err
}
