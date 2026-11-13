package resources

import (
	"context"
	"crypto/rand"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strconv"

	"usespotlight.ai/data-plane/control"
)

const (
	prefix       = "/api/v1/resources"
	idempotent   = "Idempotency-Key"
	ifMatch      = "If-Match"
	clientHeader = "Spotlight-Client"
)

var (
	ErrNotAdmin  = errors.New("only a workspace admin can do this")
	ErrNameTaken = errors.New("the name is taken")
)

type Workspace struct {
	ID   string `json:"id"`
	Name string `json:"name"`
	Slug string `json:"slug"`
}

type Secret struct {
	ID             string `json:"id"`
	Version        int    `json:"version"`
	Name           string `json:"name"`
	ValueWoVersion *int   `json:"valueWoVersion"`
}

type Binding struct {
	Host     string `json:"host"`
	Location string `json:"location"`
	Name     string `json:"name"`
	Prefix   string `json:"prefix"`
}

type Client struct {
	control *control.Client
	version string
}

func New(address, token, version string) (*Client, error) {
	api, err := control.New(address, token)
	if err != nil {
		return nil, err
	}
	return &Client{control: api, version: version}, nil
}

func (c *Client) Workspaces(ctx context.Context) ([]Workspace, error) {
	var listed struct {
		Items []Workspace `json:"items"`
	}
	if _, err := c.call(ctx, http.MethodGet, "/workspaces", nil, nil, &listed); err != nil {
		return nil, fmt.Errorf("list your workspaces: %w", err)
	}
	return listed.Items, nil
}

func (c *Client) Secrets(ctx context.Context, workspace string) ([]Secret, error) {
	var listed struct {
		Items []Secret `json:"items"`
	}
	if _, err := c.call(ctx, http.MethodGet, "/workspaces/"+url.PathEscape(workspace)+"/secrets", nil, nil, &listed); err != nil {
		return nil, fmt.Errorf("list the workspace's secrets: %w", err)
	}
	return listed.Items, nil
}

func (c *Client) SaveSecret(ctx context.Context, workspace string, held *Secret, name, value string, binding Binding) error {
	body := map[string]any{"name": name, "bindings": []Binding{binding}, "valueWo": value, "valueWoVersion": 1}
	if held == nil {
		_, err := c.call(ctx, http.MethodPost, "/workspaces/"+url.PathEscape(workspace)+"/secrets", once(), body, nil)
		return described("save "+name, err)
	}

	if held.ValueWoVersion != nil {
		body["valueWoVersion"] = *held.ValueWoVersion + 1
	}
	headers := http.Header{ifMatch: {strconv.Quote(strconv.Itoa(held.Version))}}
	_, err := c.call(ctx, http.MethodPut, "/secrets/"+url.PathEscape(held.ID), headers, body, nil)
	return described("replace "+name, err)
}

func (c *Client) PullPool(ctx context.Context, workspace, key, token, idempotencyKey string) error {
	headers := http.Header{idempotent: {idempotencyKey}}
	_, err := c.call(ctx, http.MethodPost, "/workspaces/"+url.PathEscape(workspace)+"/runner-pools", headers, map[string]any{"key": key, "token": token}, nil)
	var rejected *control.ResponseError
	if errors.As(err, &rejected) && rejected.Status == http.StatusConflict {
		return fmt.Errorf("make the pool %s: %w", key, ErrNameTaken)
	}
	return described("make the pool "+key, err)
}

func (c *Client) call(ctx context.Context, method, path string, headers http.Header, in, out any) (http.Header, error) {
	if headers == nil {
		headers = http.Header{}
	}
	headers.Set(clientHeader, "cli/"+c.version)
	return c.control.RequestWith(ctx, method, prefix+path, headers, in, out)
}

func once() http.Header {
	return http.Header{idempotent: {rand.Text()}}
}

func described(doing string, err error) error {
	var rejected *control.ResponseError
	switch {
	case err == nil:
		return nil
	case errors.As(err, &rejected) && rejected.Status == http.StatusForbidden:
		return fmt.Errorf("%s: %w", doing, ErrNotAdmin)
	case errors.As(err, &rejected):
		if message, ok := rejected.ClientErrorMessage(); ok {
			return fmt.Errorf("%s: %s", doing, message)
		}
	}
	return fmt.Errorf("%s: %w", doing, err)
}
