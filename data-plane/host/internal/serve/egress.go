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

type egressSidecar struct {
	host       *Host
	name       string
	labels     map[string]string
	keys       []protocol.HarnessKey
	wait       time.Duration
	network    string
	container  string
	credential string
	authority  []byte
}

func (h *Host) egress(
	ctx context.Context, assignment protocol.Assignment, harnessKeys []protocol.HarnessKey, log *slog.Logger,
) (*egressSidecar, error) {
	if assignment.EgressToken == "" {
		return &egressSidecar{host: h}, errors.New("the assignment has no credential for the sandbox's egress")
	}

	sidecar, err := h.egressSidecar(ctx, assignment.RunnerID, map[string]string{LabelHost: h.opts.HostID, LabelRunner: assignment.RunnerID},
		assignment.EgressToken, harnessKeys, h.opts.EgressWait)
	if err == nil {
		log.Info("started the sandbox's egress", "egress", sidecar.container)
	}

	return sidecar, err
}

func (h *Host) egressSidecar(
	ctx context.Context, name string, labels map[string]string, token string, harnessKeys []protocol.HarnessKey,
	wait time.Duration,
) (*egressSidecar, error) {
	if wait <= 0 {
		wait = egressWait
	}
	sidecar := &egressSidecar{host: h, name: name, labels: labels, keys: harnessKeys, wait: wait, credential: rand.Text()}

	var err error
	sidecar.network, err = h.engine.Network(ctx, "spotlight-"+name, labels)
	if err != nil {
		return sidecar, err
	}

	return sidecar, sidecar.start(ctx, token)
}

func (s *egressSidecar) rekey(ctx context.Context, token string) error {
	if token == "" {
		return errors.New("the assignment has no credential for the sandbox's egress")
	}

	if s.container != "" {
		if err := s.host.engine.Destroy(ctx, s.container); err != nil {
			return fmt.Errorf("stop the last run's egress: %w", err)
		}
		s.container, s.authority = "", nil
	}

	return s.start(ctx, token)
}

func (s *egressSidecar) start(ctx context.Context, token string) error {
	h := s.host

	image, err := h.egressImage(ctx)
	if err != nil {
		return err
	}

	s.container, err = h.startEgress(ctx, image, s.name, s.labels, protocol.EgressConfig{
		URL:         h.now().SandboxURL,
		Token:       token,
		Credential:  s.credential,
		Allow:       h.now().Egress.Allow,
		SecretAllow: h.now().Egress.SecretAllow,
		HarnessKeys: s.keys,
	}, []sandbox.Join{{Network: s.network, Aliases: []string{EgressAlias}}})
	if err != nil {
		return err
	}

	s.authority, err = h.awaited(ctx, s.container, protocol.EgressAuthority, s.wait, func(found []byte) bool {
		return x509.NewCertPool().AppendCertsFromPEM(found)
	})
	if errors.Is(err, errLate) {
		return fmt.Errorf("egress was not ready within %s", s.wait)
	}

	return err
}

func (h *Host) startEgress(
	ctx context.Context, image, name string, labels map[string]string, config protocol.EgressConfig, joins []sandbox.Join,
) (string, error) {
	body, err := json.Marshal(config)
	if err != nil {
		return "", err
	}

	env, files := h.now().Egress.Env, []sandbox.File{{Path: protocol.EgressConfigPath, Mode: 0o400, Body: body}}
	if len(h.now().Egress.CABundle) > 0 {
		env = append(slices.Clone(env), "SSL_CERT_DIR="+EgressCABundleDir)
		files = append(files, sandbox.File{Path: EgressCABundleDir + "/trusted.pem", Mode: 0o644, DirMode: 0o755, Body: h.now().Egress.CABundle})
	}

	return h.engine.Start(ctx, sandbox.Spec{
		Name:       "spotlight-egress-" + name,
		Image:      image,
		Entrypoint: []string{"spotlight", "egress"},
		Env:        env,
		Labels:     labels,
		Files:      files,
		Network:    h.now().Network,
		Joins:      joins,
		ExtraHosts: h.now().ExtraHosts,
	})
}

func (h *Host) egressImage(ctx context.Context) (string, error) {
	ref := h.now().Egress.Image
	h.mu.Lock()
	pulled := h.egressIs
	if h.egressFor != ref {
		pulled = ""
	}
	h.mu.Unlock()
	if pulled != "" {
		if _, err := h.engine.Inspect(ctx, pulled); err == nil {
			return pulled, nil
		}
	}

	image, err := h.pulled(ctx, ref)
	if err != nil {
		return "", fmt.Errorf("pull the egress image %s: %w", ref, err)
	}

	h.mu.Lock()
	h.egressIs, h.egressFor = image.ID, ref
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

func (s *egressSidecar) env() []string {
	proxy := (&url.URL{
		Scheme: "http",
		User:   url.UserPassword("sandbox", s.credential),
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

func (s *egressSidecar) files() []sandbox.File {
	return []sandbox.File{s.authorityFile()}
}

func (s *egressSidecar) authorityFile() sandbox.File {
	return sandbox.File{Path: AuthorityPath, Mode: 0o644, DirMode: 0o755, Body: s.authority}
}

func (s *egressSidecar) close() {
	ctx, cancel := context.WithTimeout(context.Background(), cleanupBudget)
	defer cancel()

	if s.container != "" {
		if err := s.host.engine.Destroy(ctx, s.container); err != nil {
			s.host.log.Error("could not destroy a sandbox's egress; the next start destroys it", "egress", s.container, "error", err)
		}
	}
	if s.network != "" {
		if err := s.host.engine.Unnetwork(ctx, s.network); err != nil {
			s.host.log.Error("could not remove a sandbox's network; the next start removes it", "network", s.network, "error", err)
		}
	}
}
