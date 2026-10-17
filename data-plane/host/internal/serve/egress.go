package serve

import (
	"context"
	"crypto/rand"
	"crypto/x509"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"net/url"
	"os"
	"slices"
	"strconv"
	"time"

	"usespotlight.ai/data-plane/host/internal/sandbox"
	"usespotlight.ai/data-plane/protocol"
)

type wayOut struct {
	host       *Host
	network    string
	container  string
	credential string
	authority  []byte
}

func (h *Host) egress(
	ctx context.Context, handed protocol.Handed, harnessKeys []protocol.HarnessKey, log *slog.Logger,
) (*wayOut, error) {
	if handed.EgressToken == "" {
		return &wayOut{host: h}, errors.New("the control plane handed no credential for the sandbox's egress")
	}

	way, err := h.wayOut(ctx, handed.RunnerID, map[string]string{LabelHost: h.opts.HostID, LabelRunner: handed.RunnerID},
		handed.EgressToken, harnessKeys, h.opts.EgressWait)
	if err == nil {
		log.Info("started the sandbox's egress", "egress", way.container)
	}

	return way, err
}

func (h *Host) wayOut(
	ctx context.Context, name string, labels map[string]string, token string, harnessKeys []protocol.HarnessKey,
	wait time.Duration,
) (*wayOut, error) {
	way := &wayOut{host: h, credential: rand.Text()}

	image, err := h.egressImage(ctx)
	if err != nil {
		return way, err
	}

	way.network, err = h.engine.Network(ctx, "spotlight-"+name, labels)
	if err != nil {
		return way, err
	}

	way.container, err = h.startEgress(ctx, image, name, labels, protocol.EgressHanded{
		URL:         h.opts.SandboxURL,
		Token:       token,
		Credential:  way.credential,
		Allow:       h.opts.Egress.Allow,
		Reads:       h.opts.Egress.Reads,
		HarnessKeys: harnessKeys,
	}, []sandbox.Join{{Network: way.network, Aliases: []string{EgressAlias}}})
	if err != nil {
		return way, err
	}

	if wait <= 0 {
		wait = egressWait
	}
	way.authority, err = h.awaited(ctx, way.container, protocol.EgressAuthority, wait, func(found []byte) bool {
		return x509.NewCertPool().AppendCertsFromPEM(found)
	})
	if errors.Is(err, errLate) {
		return way, fmt.Errorf("egress was not ready within %s", wait)
	}

	return way, err
}

func (h *Host) startEgress(
	ctx context.Context, image, name string, labels map[string]string, handed protocol.EgressHanded, joins []sandbox.Join,
) (string, error) {
	body, err := json.Marshal(handed)
	if err != nil {
		return "", err
	}

	env, files := h.opts.Egress.Env, []sandbox.File{{Path: protocol.EgressHandedPath, Mode: 0o400, Body: body}}
	if len(h.opts.Egress.Trust) > 0 {
		env = append(slices.Clone(env), "SSL_CERT_DIR="+EgressTrusts)
		files = append(files, sandbox.File{Path: EgressTrusts + "/trusted.pem", Mode: 0o644, DirMode: 0o755, Body: h.opts.Egress.Trust})
	}

	return h.engine.Start(ctx, sandbox.Spec{
		Name:       "spotlight-egress-" + name,
		Image:      image,
		Entrypoint: []string{"spotlight", "egress"},
		Env:        env,
		Labels:     labels,
		Files:      files,
		Network:    h.opts.Network,
		Joins:      joins,
		ExtraHosts: h.opts.ExtraHosts,
	})
}

func (h *Host) egressImage(ctx context.Context) (string, error) {
	h.mu.Lock()
	pulled := h.egressIs
	h.mu.Unlock()
	if pulled != "" {
		if _, err := h.engine.Inspect(ctx, pulled); err == nil {
			return pulled, nil
		}
	}

	image, err := h.pulled(ctx, h.opts.Egress.Image)
	if err != nil {
		return "", fmt.Errorf("pull the egress image %s: %w", h.opts.Egress.Image, err)
	}

	h.mu.Lock()
	h.egressIs = image.ID
	h.mu.Unlock()

	return image.ID, nil
}

var errLate = errors.New("egress wrote nothing in time")

func (h *Host) awaited(
	ctx context.Context, container, path string, wait time.Duration, ready func([]byte) bool,
) ([]byte, error) {
	waiting, cancel := context.WithTimeout(ctx, wait)
	defer cancel()

	ticker := time.NewTicker(egressPoll)
	defer ticker.Stop()

	for {
		found, err := h.engine.Read(waiting, container, path)
		if err == nil && ready(found) {
			return found, nil
		}
		if err != nil && !errors.Is(err, os.ErrNotExist) && waiting.Err() == nil {
			return nil, err
		}

		select {
		case <-waiting.Done():
			if ctx.Err() != nil {
				return nil, ctx.Err()
			}
			return nil, errLate
		case <-ticker.C:
		}
	}
}

func (w *wayOut) env() []string {
	proxy := (&url.URL{
		Scheme: "http",
		User:   url.UserPassword("sandbox", w.credential),
		Host:   EgressAlias + ":" + strconv.Itoa(protocol.EgressPort),
	}).String()
	local := "localhost,127.0.0.1,::1"

	return []string{
		"HTTP_PROXY=" + proxy,
		"HTTPS_PROXY=" + proxy,
		"http_proxy=" + proxy,
		"https_proxy=" + proxy,
		"NO_PROXY=" + local,
		"no_proxy=" + local,
		"SSL_CERT_FILE=" + BundlePath,
		"REQUESTS_CA_BUNDLE=" + BundlePath,
		"CURL_CA_BUNDLE=" + BundlePath,
		"GIT_SSL_CAINFO=" + BundlePath,
		"NODE_EXTRA_CA_CERTS=" + AuthorityPath,
	}
}

func (w *wayOut) files() []sandbox.File {
	return []sandbox.File{{Path: AuthorityPath, Mode: 0o644, DirMode: 0o755, Body: w.authority}}
}

func (w *wayOut) close() {
	ctx, cancel := context.WithTimeout(context.Background(), cleanupBudget)
	defer cancel()

	if w.container != "" {
		if err := w.host.engine.Destroy(ctx, w.container); err != nil {
			w.host.log.Error("could not destroy a sandbox's egress; the next start destroys it", "egress", w.container, "error", err)
		}
	}
	if w.network != "" {
		if err := w.host.engine.Unnetwork(ctx, w.network); err != nil {
			w.host.log.Error("could not remove a sandbox's network; the next start removes it", "network", w.network, "error", err)
		}
	}
}
