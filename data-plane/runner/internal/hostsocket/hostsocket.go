// Package hostsocket asks the host of the sandbox for what only the host can do, over the socket it mounts into the sandbox.
package hostsocket

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"strings"
	"time"

	"usespotlight.ai/data-plane/protocol"
)

// The host's working copy hook freezes everything written so far, so a snapshot can take minutes.
const snapshotWait = 15 * time.Minute

type Client struct {
	http *http.Client
}

func New(socket string) *Client {
	return &Client{http: &http.Client{Transport: &http.Transport{
		DialContext: func(ctx context.Context, _, _ string) (net.Conn, error) {
			var dialer net.Dialer
			return dialer.DialContext(ctx, "unix", socket)
		},
	}}}
}

// Snapshot has the host make snapshot name of the working copy that holds the workspace.
func (c *Client) Snapshot(ctx context.Context, name string) error {
	ctx, cancel := context.WithTimeout(ctx, snapshotWait)
	defer cancel()

	body, err := json.Marshal(protocol.HostSnapshotRequest{Snapshot: name})
	if err != nil {
		return err
	}

	request, err := http.NewRequestWithContext(ctx, http.MethodPost, "http://host"+protocol.HostSnapshotPath, bytes.NewReader(body))
	if err != nil {
		return err
	}
	request.Header.Set("Content-Type", "application/json")

	response, err := c.http.Do(request)
	if err != nil {
		return fmt.Errorf("ask the host: %w", err)
	}
	defer response.Body.Close()

	if response.StatusCode/100 != 2 {
		said, _ := io.ReadAll(io.LimitReader(response.Body, 4<<10))
		return fmt.Errorf("the host answered %s: %s", response.Status, strings.TrimSpace(string(said)))
	}

	return nil
}
