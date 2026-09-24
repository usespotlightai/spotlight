package control

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"

	"usespotlight.ai/runner/internal/protocol"
)

type Enrolment struct {
	TokenFile string
	Trust     string
	Name      string
}

func Exchange(ctx context.Context, baseURL string, workload Enrolment) (protocol.Exchanged, error) {
	base, err := url.Parse(baseURL)
	if err != nil || base.Scheme == "" || base.Host == "" {
		return protocol.Exchanged{}, fmt.Errorf("control plane url %q is not absolute", baseURL)
	}

	issued, err := os.ReadFile(workload.TokenFile)
	if err != nil {
		return protocol.Exchanged{}, fmt.Errorf("read the workload token: %w", err)
	}

	body, err := json.Marshal(protocol.Exchange{
		Trust: workload.Trust,
		Token: strings.TrimSpace(string(issued)),
		Name:  workload.Name,
	})
	if err != nil {
		return protocol.Exchanged{}, err
	}

	const path = "/api/runners/exchange"
	request, err := http.NewRequestWithContext(ctx, http.MethodPost, base.JoinPath(path).String(), bytes.NewReader(body))
	if err != nil {
		return protocol.Exchanged{}, err
	}
	request.Header.Set("Content-Type", "application/json")

	response, err := (&http.Client{Timeout: 30 * time.Second}).Do(request)
	if err != nil {
		return protocol.Exchanged{}, fmt.Errorf("exchange the workload token: %w", err)
	}
	defer response.Body.Close()

	if response.StatusCode >= 300 {
		return protocol.Exchanged{}, fmt.Errorf("exchange the workload token: %w", refused(http.MethodPost, path, response))
	}

	var exchanged protocol.Exchanged
	if err := json.NewDecoder(response.Body).Decode(&exchanged); err != nil {
		return protocol.Exchanged{}, fmt.Errorf("exchange the workload token: %w", err)
	}
	if exchanged.Token == "" {
		return protocol.Exchanged{}, fmt.Errorf("exchange the workload token: control plane returned no token")
	}

	return exchanged, nil
}

func Enrol(ctx context.Context, baseURL string, workload Enrolment, log *slog.Logger) (string, error) {
	backoff := retryFloor

	for {
		exchanged, err := Exchange(ctx, baseURL, workload)
		if err == nil {
			log.Info("enrolled as a platform workload", "runner", exchanged.RunnerID, "trust", workload.Trust)
			return exchanged.Token, nil
		}
		if ctx.Err() != nil {
			return "", ctx.Err()
		}

		log.Warn("could not enrol, still trying", "error", err, "retryIn", backoff)

		if !sleep(ctx, jitter(backoff)) {
			return "", ctx.Err()
		}
		backoff = min(backoff*2, retryCeiling)
	}
}
