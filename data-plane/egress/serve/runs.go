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

	"usespotlight.ai/data-plane/control"
	"usespotlight.ai/data-plane/egressing/wear"
	"usespotlight.ai/data-plane/protocol"
	"usespotlight.ai/data-plane/reach"
)

const (
	checkEvery   = 30 * time.Second
	sweepEvery   = 10 * time.Second
	recordEvery  = 5 * time.Second
	unusedFor    = 2 * time.Minute
	redeemAgain  = 5 * time.Second
	redeemBudget = time.Minute
	admitBudget  = 30 * time.Second
	refusedFor   = 10 * time.Second
	maxRefused   = 10_000
	admitRate    = 50
)

var errAdmitsTooFast = errors.New("egress admits too many sandboxes at once")

type run struct {
	credential   string
	workspace    string
	controlPlane string
	port         string
	reaches      []string
	admitting    chan struct{}
	failed       error

	redeeming sync.Mutex

	mu        sync.Mutex
	redeemed  bool
	triedAt   time.Time
	wearing   *wear.Wearing
	bound     map[string]bool
	allowed   reach.List
	transport *http.Transport
	forgotten bool

	used   atomic.Int64
	active atomic.Int32
}

type refusal struct {
	at  time.Time
	err error
}

func refused(err error) bool {
	var rejection *control.Rejection
	return errors.As(err, &rejection) && rejection.Status < http.StatusInternalServerError
}

func refusedThisEgress(err error) bool {
	var rejection *control.Rejection
	return errors.As(err, &rejection) &&
		(rejection.Status == http.StatusUnauthorized || rejection.Status == http.StatusForbidden)
}

func (e *Egress) admitted(ctx context.Context, credential, source string) (*run, error) {
	e.mu.Lock()
	if found, ok := e.runs[credential]; ok {
		found.active.Add(1)
		e.mu.Unlock()
		<-found.admitting
		if found.failed != nil {
			e.leave(found)
		}
		return found, found.failed
	}

	if refused, ok := e.refusedRecently(credential); ok {
		e.mu.Unlock()
		return nil, refused.err
	}
	release, tooFast := e.admits.take(source)
	if tooFast != "" {
		e.mu.Unlock()
		return nil, errAdmitsTooFast
	}
	release()

	found := &run{credential: credential, admitting: make(chan struct{})}
	found.active.Add(1)
	e.runs[credential] = found
	e.mu.Unlock()

	admitting, cancel := context.WithTimeout(context.WithoutCancel(ctx), admitBudget)
	defer cancel()

	admitted, err := e.control.AdmitEgress(admitting, credential)
	switch {
	case err != nil:
	case admitted.ControlPlaneHost == "":
		err = errors.New("the control plane named no host of its own")
	case admitted.ControlPlanePort <= 0 || admitted.ControlPlanePort > 65535:
		err = errors.New("the control plane named no port of its own")
	}
	if err != nil {
		if refusedThisEgress(err) {
			e.log.Warn("the control plane refused this egress; check its token", "error", err)
		}
		e.mu.Lock()
		if e.runs[credential] == found {
			delete(e.runs, credential)
		}
		if refused(err) {
			e.rememberRefused(credential, err)
		}
		e.mu.Unlock()
		found.failed = err
		close(found.admitting)
		e.leave(found)
		return nil, err
	}

	found.workspace = admitted.WorkspaceID
	found.controlPlane = reach.Normal(admitted.ControlPlaneHost)
	found.port = strconv.Itoa(admitted.ControlPlanePort)
	found.reaches = admitted.Reaches
	found.allowed = reach.List{}.With(admitted.Reaches...)
	found.touch(e.now())
	close(found.admitting)
	e.log.Info("admitted a sandbox", "runner", admitted.RunnerID, "workspace", admitted.WorkspaceID)

	return found, nil
}

func (e *Egress) refusedRecently(credential string) (refusal, bool) {
	refused, ok := e.refused[credential]
	if !ok {
		return refusal{}, false
	}
	if e.now().Sub(refused.at) >= refusedFor {
		delete(e.refused, credential)
		return refusal{}, false
	}
	return refused, true
}

func (e *Egress) rememberRefused(credential string, err error) {
	if len(e.refused) >= maxRefused {
		clear(e.refused)
	}
	e.refused[credential] = refusal{at: e.now(), err: err}
}

func (e *Egress) leave(found *run) {
	found.touch(e.now())
	if found.active.Add(-1) == 0 {
		found.letGoIfForgotten()
	}
}

func (e *Egress) redeem(ctx context.Context, r *run) error {
	return e.redeemed(ctx, r, false)
}

func (e *Egress) redeemNow(ctx context.Context, r *run) error {
	return e.redeemed(ctx, r, true)
}

func (e *Egress) redeemed(ctx context.Context, r *run, now bool) error {
	r.redeeming.Lock()
	defer r.redeeming.Unlock()

	at := e.now()
	r.mu.Lock()
	settled := r.redeemed || r.forgotten || (!now && !r.triedAt.IsZero() && at.Sub(r.triedAt) < redeemAgain)
	r.mu.Unlock()
	if settled {
		return nil
	}

	redeeming, cancel := context.WithTimeout(context.WithoutCancel(ctx), redeemBudget)
	defer cancel()

	redeemed, err := e.control.RedeemEgressFor(redeeming, r.credential, e.key.Recipient())
	if refused(err) {
		r.mu.Lock()
		r.triedAt = at
		r.mu.Unlock()
		if refusedThisEgress(err) {
			e.log.Warn("the control plane refused this egress a run's secrets; check its token", "error", err)
		} else {
			e.log.Info("the sandbox has no run to redeem yet", "error", err)
		}
		return nil
	}
	if err != nil {
		return err
	}

	log := e.log.With("run", redeemed.RunID)
	wearing := wear.From(redeeming, redeemed, nil, wear.Limits{Hosts: e.settings.Allow, Reads: e.settings.Reads}, e.key, e.reader, log)
	controlPlane := &url.URL{Scheme: "https", Host: r.controlPlane}
	if err := wearing.TowardControlPlane(redeemed.SpotlightAPI, controlPlane, redeemed.RunID, e.key); err != nil {
		log.Warn("could not keep the run's Spotlight token", "error", err)
	}

	allowed := e.settings.Allow.With(slices.Concat([]string{r.controlPlane}, r.reaches, redeemed.Reaches)...)
	bound := map[string]bool{}
	for _, host := range slices.Concat(redeemed.Bound, wearing.Hosts()) {
		if host = reach.Normal(host); allowed.Admits(host) {
			bound[host] = true
		}
	}

	r.mu.Lock()
	defer r.mu.Unlock()
	if r.forgotten {
		wearing.Forget()
		return nil
	}
	r.allowed = allowed
	r.bound = bound
	r.wearing = wearing
	r.transport = e.transportFor()
	r.redeemed = true
	log.Info("redeemed a run's secrets", "bound", r.boundHosts())

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

func (r *run) admits(host, port string) (admits, named bool) {
	r.mu.Lock()
	defer r.mu.Unlock()

	if host == r.controlPlane {
		return port == r.port, port == r.port
	}
	if !r.redeemed {
		return r.allowed.Names(host), r.allowed.Names(host)
	}
	return r.allowed.Admits(host), r.allowed.Names(host)
}

type forwarding struct {
	wearing   *wear.Wearing
	transport *http.Transport
	named     bool
}

func (r *run) bindsFor(host string) (forwarding, bool) {
	r.mu.Lock()
	defer r.mu.Unlock()

	if !r.redeemed || r.forgotten || !r.bound[host] || (host == r.controlPlane && r.port != "443") {
		return forwarding{}, false
	}
	return forwarding{wearing: r.wearing, transport: r.transport, named: r.allowed.Names(host)}, true
}

func (r *run) boundList() ([]string, bool) {
	r.mu.Lock()
	defer r.mu.Unlock()

	return r.boundHosts(), r.redeemed
}

func (r *run) boundHosts() []string {
	hosts := make([]string, 0, len(r.bound))
	for host := range r.bound {
		hosts = append(hosts, host)
	}
	slices.Sort(hosts)

	return hosts
}

func (r *run) forget() {
	r.mu.Lock()
	defer r.mu.Unlock()

	r.forgotten = true
	if r.transport != nil {
		r.transport.CloseIdleConnections()
	}
	if r.active.Load() == 0 && r.wearing != nil {
		r.wearing.Forget()
	}
}

func (r *run) letGoIfForgotten() {
	r.mu.Lock()
	defer r.mu.Unlock()

	if r.forgotten && r.wearing != nil {
		r.wearing.Forget()
	}
}

func (e *Egress) forget(ctx context.Context, runs []*run, why string) {
	e.mu.Lock()
	var forgotten []*run
	for _, found := range runs {
		if e.runs[found.credential] == found {
			forgotten = append(forgotten, found)
			delete(e.runs, found.credential)
		}
	}
	e.mu.Unlock()

	if len(forgotten) > 0 {
		e.records.flush(ctx)
	}
	for _, found := range forgotten {
		found.forget()
	}
	if len(forgotten) > 0 {
		e.log.Info("let go of runs", "runs", len(forgotten), "why", why)
	}
}

func admittedNow(found *run) bool {
	select {
	case <-found.admitting:
		return found.failed == nil
	default:
		return false
	}
}

func (e *Egress) admittedRuns() []*run {
	e.mu.Lock()
	defer e.mu.Unlock()

	runs := make([]*run, 0, len(e.runs))
	for _, found := range e.runs {
		if admittedNow(found) {
			runs = append(runs, found)
		}
	}
	return runs
}

func (e *Egress) checkActiveRuns(ctx context.Context) {
	for asked := range slices.Chunk(e.admittedRuns(), protocol.MaxRunsAtOnce) {
		credentials := make([]string, len(asked))
		for at, found := range asked {
			credentials[at] = found.credential
		}

		active, err := e.control.ActiveRuns(ctx, credentials)
		if err != nil {
			e.log.Warn("could not ask which runs are active, keeps them for now", "runs", len(asked), "error", err)
			continue
		}

		e.forget(ctx, slices.DeleteFunc(slices.Clone(asked), func(found *run) bool {
			return slices.Contains(active, found.credential)
		}), "their runs are no longer active")
	}
}

func (e *Egress) sweep(ctx context.Context) {
	cutoff := e.now().Add(-unusedFor).UnixNano()

	e.mu.Lock()
	var unused []*run
	for credential, found := range e.runs {
		if admittedNow(found) && found.active.Load() == 0 && found.used.Load() < cutoff {
			unused = append(unused, found)
			delete(e.runs, credential)
		}
	}
	e.mu.Unlock()

	if len(unused) > 0 {
		e.records.flush(ctx)
	}
	for _, found := range unused {
		found.forget()
	}
	if len(unused) > 0 {
		e.log.Info("let go of runs", "runs", len(unused), "why", "no use for "+unusedFor.String())
	}
	e.limits.sweep()
}

func (e *Egress) keep(ctx context.Context) {
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
