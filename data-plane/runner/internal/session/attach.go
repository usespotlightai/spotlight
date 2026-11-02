package session

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"usespotlight.ai/data-plane/protocol"
	"usespotlight.ai/data-plane/runner/internal/agentapi"
)

const attachTimeout = 4 * time.Minute

func attaching(journal Journal, transport http.RoundTripper, runID string) agentapi.Attacher {
	storage := &http.Client{Timeout: attachTimeout, Transport: transport}

	return func(ctx context.Context, file protocol.HandedFile) (string, error) {
		grant, err := journal.GrantAttachment(ctx, runID, protocol.AttachmentRequest{
			Name:        file.Name,
			ContentType: file.ContentType,
			Size:        int64(len(file.Data)),
		})
		if err != nil {
			return "", err
		}

		request, err := http.NewRequestWithContext(ctx, http.MethodPut, grant.URL, bytes.NewReader(file.Data))
		if err != nil {
			return "", fmt.Errorf("upload the file: %w", err)
		}
		request.ContentLength = int64(len(file.Data))
		for name, value := range grant.Headers {
			request.Header.Set(name, value)
		}

		response, err := storage.Do(request)
		if err != nil {
			return "", fmt.Errorf("upload the file: %w", err)
		}
		defer response.Body.Close()

		if response.StatusCode >= 300 {
			body, _ := io.ReadAll(io.LimitReader(response.Body, 512))
			return "", fmt.Errorf("upload the file: storage answered %s: %s", response.Status, strings.TrimSpace(string(body)))
		}

		return grant.ID, nil
	}
}
