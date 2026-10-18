package serve

import (
	"cmp"
	"context"
	"crypto/tls"
	"errors"
	"net/http"
	"net/url"
	"slices"
	"strconv"
	"sync"
	"sync/atomic"
	"time"

	"usespotlight.ai/data-plane/allowlist"
	"usespotlight.ai/data-plane/control"
	"usespotlight.ai/data-plane/egresskit/inject"
	"usespotlight.ai/data-plane/protocol"
)

const (
	checkEvery      = 30 * time.Second
	sweepEvery      = 10 * time.Second
	recordEvery     = 5 * time.Second
	unusedFor       = 2 * time.Minute
	fetchAgain      = 5 * time.Second
	fetchBudget     = time.Minute
	authorizeBudget = 30 * time.Second
	rejectionTTL    = 10 * time.Second
	maxRejections   = 10_000
	authorizeRate   = 50
)

var errAuthorizeTooFast = errors.New("egress authorizes too many sandboxes at once")

type run struct {
	credential        string
	workspace         string
	controlPlane      string
	port              string
	extraAllowedHosts []string
	authorizing       chan struct{}
	failed            error

	fetching sync.Mutex

	mu        sync.Mutex
	fetched   bool
	triedAt   time.Time
	injector  *inject.Injector
	bound     map[string]bool
	allowed   allowlist.List
	transport *http.Transport
	evicted   bool

	used   atomic.Int64
	active atomic.Int32
}

type rejection struct {
	at  time.Time
	err error
}

func isRejected(err error) bool {
	var answer *control.ResponseError
	return errors.As(err, &answer) && answer.Status < http.StatusInternalServerError
}

func isEgressAuthFailure(err error) bool {
	var answer *control.ResponseError
	return errors.As(err, &answer) &&
		(answer.Status == http.StatusUnauthorized || answer.Status == http.StatusForbidden)
}

func (e *Egress) authorized(ctx context.Context, credential, source string) (*run, error) {
	e.mu.Lock()
	if found, ok := e.runs[credential]; ok {
		found.active.Add(1)
		e.mu.Unlock()
		<-found.authorizing
		if found.failed != nil {
			e.leave(found)
		}
		return found, found.failed
	}

	if failure, ok := e.recentRejection(credential); ok {
		e.mu.Unlock()
		return nil, failure.err
	}
	release, tooFast := e.authorizeLimits.take(source)
	if tooFast != "" {
		e.mu.Unlock()
		return nil, errAuthorizeTooFast
	}
	release()

	found := &run{credential: credential, authorizing: make(chan struct{})}
	found.active.Add(1)
	e.runs[credential] = found
	e.mu.Unlock()

	authorizing, cancel := context.WithTimeout(context.WithoutCancel(ctx), authorizeBudget)
	defer cancel()

	authorized, err := e.control.AuthorizeEgress(authorizing, credential)
	switch {
	case err != nil:
	case authorized.ControlPlaneHost == "":
		err = errors.New("the control plane named no host of its own")
	case authorized.ControlPlanePort <= 0 || authorized.ControlPlanePort > 65535:
		err = errors.New("the control plane named no port of its own")
	}
	if err != nil {
		if isEgressAuthFailure(err) {
			e.log.Warn("the control plane did not accept this egress; check its token", "error", err)
		}
		e.mu.Lock()
		if e.runs[credential] == found {
			delete(e.runs, credential)
		}
		if isRejected(err) {
			e.rememberRejection(credential, err)
		}
		e.mu.Unlock()
		found.failed = err
		close(found.authorizing)
		e.leave(found)
		return nil, err
	}

	found.workspace = authorized.WorkspaceID
	found.controlPlane = allowlist.Normal(authorized.ControlPlaneHost)
	found.port = strconv.Itoa(authorized.ControlPlanePort)
	found.extraAllowedHosts = authorized.ExtraAllowedHosts
	found.allowed = allowlist.List{}.With(authorized.ExtraAllowedHosts...)
	found.touch(e.now())
	close(found.authorizing)
	e.log.Info("authorized a sandbox", "runner", authorized.RunnerID, "workspace", authorized.WorkspaceID)

	return found, nil
}

func (e *Egress) recentRejection(credential string) (rejection, bool) {
	failure, ok := e.rejections[credential]
	if !ok {
		return rejection{}, false
	}
	if e.now().Sub(failure.at) >= rejectionTTL {
		delete(e.rejections, credential)
		return rejection{}, false
	}
	return failure, true
}

func (e *Egress) rememberRejection(credential string, err error) {
	if len(e.rejections) >= maxRejections {
		clear(e.rejections)
	}
	e.rejections[credential] = rejection{at: e.now(), err: err}
}

func (e *Egress) leave(found *run) {
	found.touch(e.now())
	if found.active.Add(-1) == 0 {
		found.evictIfStale()
	}
}

func (e *Egress) fetchSecrets(ctx context.Context, r *run) error {
	return e.fetchedSecrets(ctx, r, false)
}

func (e *Egress) fetchSecretsNow(ctx context.Context, r *run) error {
	return e.fetchedSecrets(ctx, r, true)
}

func (e *Egress) fetchedSecrets(ctx context.Context, r *run, now bool) error {
	r.fetching.Lock()
	defer r.fetching.Unlock()

	at := e.now()
	r.mu.Lock()
	done := r.fetched || r.evicted || (!now && !r.triedAt.IsZero() && at.Sub(r.triedAt) < fetchAgain)
	r.mu.Unlock()
	if done {
		return nil
	}

	fetching, cancel := context.WithTimeout(context.WithoutCancel(ctx), fetchBudget)
	defer cancel()

	fetched, err := e.control.FetchRunSecretsFor(fetching, r.credential, e.key.Recipient())
	if isRejected(err) {
		r.mu.Lock()
		r.triedAt = at
		r.mu.Unlock()
		if isEgressAuthFailure(err) {
			e.log.Warn("the control plane did not accept this egress when it fetched a run's secrets; check its token", "error", err)
		} else {
			e.log.Info("the sandbox has no run to fetch secrets for yet", "error", err)
		}
		return nil
	}
	if err != nil {
		return err
	}

	log := e.log.With("run", fetched.RunID)
	injector := inject.From(fetching, fetched, nil, inject.Limits{Hosts: e.settings.Allow, SecretAllow: e.settings.SecretAllow}, e.key, e.reader, log)
	controlPlane := &url.URL{Scheme: "https", Host: r.controlPlane}
	if err := injector.ForControlPlane(fetched.SpotlightAPI, controlPlane, fetched.RunID, e.key); err != nil {
		log.Warn("could not store the run's Spotlight token", "error", err)
	}

	allowed := e.settings.Allow.With(slices.Concat([]string{r.controlPlane}, r.extraAllowedHosts, fetched.ExtraAllowedHosts)...)
	bound := map[string]bool{}
	for _, host := range slices.Concat(fetched.Bound, injector.Hosts()) {
		if host = allowlist.Normal(host); allowed.Allows(host) {
			bound[host] = true
		}
	}

	r.mu.Lock()
	defer r.mu.Unlock()
	if r.evicted {
		injector.Wipe()
		return nil
	}
	r.allowed = allowed
	r.bound = bound
	r.injector = injector
	r.transport = e.transportFor()
	r.fetched = true
	log.Info("fetched a run's secrets", "bound", r.boundHosts())

	return nil
}

func (e *Egress) transportFor() *http.Transport {
	return &http.Transport{
		Proxy:                 nil,
		DialContext:           e.dial,
		TLSClientConfig:       &tls.Config{RootCAs: e.settings.RootCAs, MinVersion: tls.VersionTLS12},
		ForceAttemptHTTP2:     true,
		MaxIdleConns:          20,
		IdleConnTimeout:       90 * time.Second,
		TLSHandshakeTimeout:   15 * time.Second,
		ExpectContinueTimeout: time.Second,
	}
}

func (r *run) touch(at time.Time) {
	r.used.Store(at.UnixNano())
}

func (r *run) controlPlaneAt(host, port string) bool {
	return host == r.controlPlane && port == r.port
}

func (r *run) allows(host, port string) (allowed, named bool) {
	r.mu.Lock()
	defer r.mu.Unlock()

	if host == r.controlPlane {
		return port == r.port, port == r.port
	}
	if !r.fetched {
		return r.allowed.ExplicitlyListed(host), r.allowed.ExplicitlyListed(host)
	}
	return r.allowed.Allows(host), r.allowed.ExplicitlyListed(host)
}

type forwarding struct {
	injector  *inject.Injector
	transport *http.Transport
	named     bool
}

func (r *run) bindsFor(host string) (forwarding, bool) {
	r.mu.Lock()
	defer r.mu.Unlock()

	if !r.fetched || r.evicted || !r.bound[host] || (host == r.controlPlane && r.port != "443") {
		return forwarding{}, false
	}
	return forwarding{injector: r.injector, transport: r.transport, named: r.allowed.ExplicitlyListed(host)}, true
}

func (r *run) boundList() ([]string, bool) {
	r.mu.Lock()
	defer r.mu.Unlock()

	return r.boundHosts(), r.fetched
}

func (r *run) boundHosts() []string {
	hosts := make([]string, 0, len(r.bound))
	for host := range r.bound {
		hosts = append(hosts, host)
	}
	slices.Sort(hosts)

	return hosts
}

func (r *run) evict() {
	r.mu.Lock()
	defer r.mu.Unlock()

	r.evicted = true
	if r.transport != nil {
		r.transport.CloseIdleConnections()
	}
	if r.active.Load() == 0 && r.injector != nil {
		r.injector.Wipe()
	}
}

func (r *run) evictIfStale() {
	r.mu.Lock()
	defer r.mu.Unlock()

	if r.evicted && r.injector != nil {
		r.injector.Wipe()
	}
}

func (e *Egress) evict(ctx context.Context, runs []*run, why string) {
	e.mu.Lock()
	var evicted []*run
	for _, found := range runs {
		if e.runs[found.credential] == found {
			evicted = append(evicted, found)
			delete(e.runs, found.credential)
		}
	}
	e.mu.Unlock()

	if len(evicted) > 0 {
		e.records.flush(ctx)
	}
	for _, found := range evicted {
		found.evict()
	}
	if len(evicted) > 0 {
		e.log.Info("evicted runs", "runs", len(evicted), "why", why)
	}
}

func authorizedNow(found *run) bool {
	select {
	case <-found.authorizing:
		return found.failed == nil
	default:
		return false
	}
}

func (e *Egress) authorizedRuns() []*run {
	e.mu.Lock()
	defer e.mu.Unlock()

	runs := make([]*run, 0, len(e.runs))
	for _, found := range e.runs {
		if authorizedNow(found) {
			runs = append(runs, found)
		}
	}
	return runs
}

func (e *Egress) checkActiveRuns(ctx context.Context) {
	for batch := range slices.Chunk(e.authorizedRuns(), protocol.MaxRunsAtOnce) {
		credentials := make([]string, len(batch))
		for at, found := range batch {
			credentials[at] = found.credential
		}

		active, err := e.control.ActiveRuns(ctx, credentials)
		if err != nil {
			e.log.Warn("could not read which runs are active, keeps them for now", "runs", len(batch), "error", err)
			continue
		}

		e.evict(ctx, slices.DeleteFunc(slices.Clone(batch), func(found *run) bool {
			return slices.Contains(active, found.credential)
		}), "their runs are no longer active")
	}
}

func (e *Egress) sweep(ctx context.Context) {
	cutoff := e.now().Add(-unusedFor).UnixNano()

	e.mu.Lock()
	var unused []*run
	for credential, found := range e.runs {
		if authorizedNow(found) && found.active.Load() == 0 && found.used.Load() < cutoff {
			unused = append(unused, found)
			delete(e.runs, credential)
		}
	}
	e.mu.Unlock()

	if len(unused) > 0 {
		e.records.flush(ctx)
	}
	for _, found := range unused {
		found.evict()
	}
	if len(unused) > 0 {
		e.log.Info("evicted runs", "runs", len(unused), "why", "no use for "+unusedFor.String())
	}
	e.limits.sweep()
}

func (e *Egress) maintain(ctx context.Context) {
	checks := time.NewTicker(cmp.Or(e.settings.CheckEvery, checkEvery))
	defer checks.Stop()
	sweeps := time.NewTicker(sweepEvery)
	defer sweeps.Stop()
	recording := time.NewTicker(cmp.Or(e.settings.RecordEvery, recordEvery))
	defer recording.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-checks.C:
			e.checkActiveRuns(ctx)
		case <-sweeps.C:
			e.sweep(ctx)
		case <-recording.C:
			e.records.flush(ctx)
		}
	}
}
