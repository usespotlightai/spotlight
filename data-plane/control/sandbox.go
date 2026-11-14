package control

import (
	"context"
	"fmt"
	"net/http"
	"net/url"

	"usespotlight.ai/data-plane/protocol"
)

type Sandbox struct {
	client *Client
	id     string
}

func ForSandbox(baseURL, sandboxID, token string) (*Sandbox, error) {
	if sandboxID == "" || token == "" {
		return nil, fmt.Errorf("the sandbox has no id or credential")
	}

	client, err := New(baseURL, token)
	if err != nil {
		return nil, err
	}

	return &Sandbox{client: client, id: sandboxID}, nil
}

func (s *Sandbox) ID() string { return s.id }

func (s *Sandbox) Through(transport http.RoundTripper) {
	s.client.Through(transport)
}

func (s *Sandbox) archivePath() string {
	return fmt.Sprintf("/api/sandboxes/%s/working-copy-archive", url.PathEscape(s.id))
}

func (s *Sandbox) WorkingCopyArchive(ctx context.Context) (*protocol.StoredArchive, error) {
	var stored protocol.StoredArchive
	status, err := s.client.request(ctx, http.MethodGet, s.archivePath(), nil, &stored)
	if err != nil {
		return nil, fmt.Errorf("read the working copy the sandbox restores: %w", err)
	}
	if status == http.StatusNoContent {
		return nil, nil
	}

	return &stored, nil
}

func (s *Sandbox) GrantArchive(ctx context.Context, size int64, sha256 string) (protocol.ArchiveGrant, error) {
	var granted protocol.ArchiveGrant
	body := protocol.ArchiveRequest{Size: size, SHA256: sha256}
	if err := s.client.do(ctx, http.MethodPost, s.archivePath(), body, &granted); err != nil {
		return protocol.ArchiveGrant{}, fmt.Errorf("request a sandbox archive: %w", err)
	}

	return granted, nil
}

func (s *Sandbox) CompleteArchive(ctx context.Context, archiveID string) error {
	path := s.archivePath() + "/" + url.PathEscape(archiveID) + "/complete"

	if err := s.client.do(ctx, http.MethodPost, path, nil, nil); err != nil {
		return fmt.Errorf("complete the sandbox archive: %w", err)
	}

	return nil
}

func (s *Sandbox) archiveLeasePath(runID string) string {
	return fmt.Sprintf("/api/sandboxes/%s/archive-leases/%s", url.PathEscape(s.id), url.PathEscape(runID))
}

func (s *Sandbox) HoldArchiveLease(ctx context.Context, runID string) error {
	if err := s.client.do(ctx, http.MethodPut, s.archiveLeasePath(runID), nil, nil); err != nil {
		return fmt.Errorf("hold the sandbox for the archive: %w", err)
	}

	return nil
}

func (s *Sandbox) ReleaseArchiveLease(ctx context.Context, runID string) error {
	if err := s.client.do(ctx, http.MethodDelete, s.archiveLeasePath(runID), nil, nil); err != nil {
		return fmt.Errorf("release the sandbox after the archive: %w", err)
	}

	return nil
}

func (s *Sandbox) AppendArchiveEvents(ctx context.Context, runID string, attempt int, events []protocol.Event) error {
	if len(events) == 0 {
		return nil
	}

	batch := struct {
		Attempt int              `json:"attempt"`
		Events  []protocol.Event `json:"events"`
	}{Attempt: attempt, Events: events}

	if err := s.client.do(ctx, http.MethodPost, s.archiveLeasePath(runID)+"/events", batch, nil); err != nil {
		return fmt.Errorf("append the archive's events: %w", err)
	}

	return nil
}
