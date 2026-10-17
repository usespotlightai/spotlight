package inject

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"net/url"
	"slices"
	"strings"
	"sync"

	"usespotlight.ai/data-plane/protocol"
	"usespotlight.ai/data-plane/reach"
)

type Opener interface {
	Open(sealed, runID, secret string) (string, error)
}

type Reader interface {
	Read(ctx context.Context, source protocol.ExternalSecretRef) (string, error)
}

type Limits struct {
	Hosts       interface{ Admits(host string) bool }
	SecretAllow []string
}

func (l Limits) allowsSecret(secretID string) bool {
	return slices.ContainsFunc(l.SecretAllow, func(entry string) bool {
		if prefix, pattern := strings.CutSuffix(entry, "*"); pattern {
			return strings.HasPrefix(secretID, prefix)
		}
		return entry == secretID
	})
}

type injected struct {
	secret   string
	location string
	name     string
	value    []byte
	bare     []byte
	prefix   string
	standIns []string
	fromHost bool
	plainOn  string
}

func (w *injected) matchesPlaceholder(header http.Header) bool {
	return w.location == protocol.LocationHeader && slices.Contains(w.standIns, header.Get(w.name))
}

func (w *injected) hasPlaceholder(name, value string) bool {
	return w.location == protocol.LocationQuery && w.name == name && slices.Contains(w.standIns, value)
}

func (w *injected) target() string {
	if w.location == protocol.LocationQuery {
		return "?" + w.name
	}
	return w.name
}

func located(location, name string) (string, string) {
	if location == protocol.LocationHeader {
		return location, http.CanonicalHeaderKey(name)
	}
	return location, name
}

type Injector struct {
	mu     sync.RWMutex
	byHost map[string][]*injected
	log    *slog.Logger
}

func From(
	ctx context.Context, fetched protocol.EgressSecrets, harnessKeys []protocol.HarnessKey, limits Limits,
	opener Opener, reader func() (Reader, error), log *slog.Logger,
) *Injector {
	injector := &Injector{byHost: map[string][]*injected{}, log: log}

	for _, key := range harnessKeys {
		host, header := reach.Normal(key.Host), http.CanonicalHeaderKey(key.Header)
		if problem := harnessKeyProblem(host, header, key, limits); problem != "" {
			log.Warn("egress will not inject a key the host has", "key", key.Name, "host", host, "reason", problem)
			continue
		}
		injector.byHost[host] = append(injector.byHost[host], &injected{
			secret:   key.Name,
			location: protocol.LocationHeader,
			name:     header,
			value:    []byte(key.Prefix + key.Value),
			bare:     []byte(key.Value),
			prefix:   key.Prefix,
			standIns: []string{key.Prefix + protocol.StandInPrefix + key.Name},
			fromHost: true,
		})
		log.Info("keeps a host key for the run", "key", key.Name, "host", host, "header", key.Header)
	}

	for _, denied := range fetched.Denied {
		log.Warn("the control plane denied egress a secret of the run", "secret", denied.Secret, "reason", denied.Reason)
	}

	for _, secret := range fetched.Secrets {
		host := reach.Normal(secret.Host)
		location, name := located(secret.Location, secret.Name)

		if problem := injector.problem(host, location, name, secret, limits); problem != "" {
			log.Warn("egress will not inject a secret of the run", "secret", secret.Secret, "host", host, "reason", problem)
			continue
		}

		value, err := valueOf(ctx, fetched.RunID, secret, opener, reader)
		if err == nil && strings.ContainsAny(value, "\r\n\x00") {
			err = fmt.Errorf("it has more than one line, so egress cannot inject it into a request")
		}
		if err != nil {
			log.Warn("could not keep a secret of the run", "secret", secret.Secret, "host", secret.Host, "error", err)
			continue
		}

		standIn := protocol.StandInPrefix + secret.Secret
		injector.byHost[host] = append(injector.byHost[host], &injected{
			secret:   secret.Secret,
			location: location,
			name:     name,
			value:    []byte(secret.Prefix + value),
			bare:     []byte(value),
			prefix:   secret.Prefix,
			standIns: slices.Compact([]string{standIn, secret.Prefix + standIn}),
		})
		log.Info("keeps a secret for the run", "secret", secret.Secret, "host", host, "location", location, "name", name)
	}

	return injector
}

func harnessKeyProblem(host, header string, key protocol.HarnessKey, limits Limits) string {
	switch {
	case !limits.Hosts.Admits(host):
		return "the host's allow-list does not admit " + host
	case header == "" || key.Value == "" || strings.ContainsAny(key.Value+key.Prefix, "\r\n\x00"):
		return "it is empty or more than one line"
	default:
		return ""
	}
}

func (w *Injector) problem(host, location, name string, secret protocol.FetchedSecret, limits Limits) string {
	target := (&injected{location: location, name: name}).target()

	switch {
	case slices.ContainsFunc(w.byHost[host], func(each *injected) bool { return each.fromHost }):
		return "the host has a key of its own for " + host
	case !limits.Hosts.Admits(host):
		return "the host's allow-list does not admit " + host
	case secret.ExternalRef != nil && !limits.allowsSecret(secret.ExternalRef.SecretID):
		return "the host does not let egress read " + secret.ExternalRef.SecretID
	case location != protocol.LocationHeader && location != protocol.LocationQuery:
		return "its location is neither a header nor a query parameter"
	case name == "":
		return "it names no " + location + " to inject it in"
	case slices.ContainsFunc(w.byHost[host], func(each *injected) bool { return each.target() == target }):
		return "another secret is already injected in " + target + " for " + host
	default:
		return ""
	}
}

func valueOf(
	ctx context.Context, runID string, secret protocol.FetchedSecret, opener Opener, reader func() (Reader, error),
) (string, error) {
	switch {
	case secret.Sealed != "":
		return opener.Open(secret.Sealed, runID, secret.Secret)
	case secret.ExternalRef != nil:
		read, err := reader()
		if err != nil {
			return "", err
		}
		return read.Read(ctx, *secret.ExternalRef)
	default:
		return "", fmt.Errorf("the control plane sent neither a sealed value nor where to read one")
	}
}

func (w *Injector) ForControlPlane(api *protocol.SpotlightAPI, controlPlane *url.URL, runID string, opener Opener) error {
	if api == nil {
		return nil
	}

	host := reach.Normal(controlPlane.Hostname())
	const prefix, header = "Bearer ", "Authorization"

	w.mu.Lock()
	defer w.mu.Unlock()

	target := (&injected{location: protocol.LocationHeader, name: header}).target()
	for _, each := range w.byHost[host] {
		if each.fromHost {
			return fmt.Errorf("the host has a key of its own for %s", host)
		}
		if each.target() == target {
			return fmt.Errorf("another secret is already injected in %s for %s", target, host)
		}
	}

	value, err := opener.Open(api.Sealed, runID, protocol.SpotlightAPISecret)
	if err != nil {
		return err
	}

	w.byHost[host] = append(w.byHost[host], &injected{
		secret:   protocol.SpotlightAPISecret,
		location: protocol.LocationHeader,
		name:     header,
		value:    []byte(prefix + value),
		bare:     []byte(value),
		prefix:   prefix,
		standIns: []string{protocol.SpotlightAPIStandIn, prefix + protocol.SpotlightAPIStandIn},
		plainOn:  plainPort(controlPlane),
	})
	w.log.Info("keeps the run's Spotlight token", "host", host)

	return nil
}

func plainPort(controlPlane *url.URL) string {
	if controlPlane.Scheme != "http" {
		return ""
	}
	if port := controlPlane.Port(); port != "" {
		return port
	}
	return "80"
}

func (w *Injector) InjectPlain(host, port string, r *http.Request) {
	w.mu.RLock()
	defer w.mu.RUnlock()

	var plain []*injected
	for _, each := range w.byHost[reach.Normal(host)] {
		if each.plainOn != "" && each.plainOn == port {
			plain = append(plain, each)
		}
	}
	w.injectHeader(host, plain, r.Header)
}

func (w *Injector) Hosts() []string {
	w.mu.RLock()
	defer w.mu.RUnlock()

	hosts := make([]string, 0, len(w.byHost))
	for host := range w.byHost {
		hosts = append(hosts, host)
	}
	slices.Sort(hosts)

	return hosts
}

func (w *Injector) InjectsFor(host string) bool {
	w.mu.RLock()
	defer w.mu.RUnlock()

	return len(w.byHost[reach.Normal(host)]) > 0
}

func (w *Injector) Inject(host string, r *http.Request) {
	w.mu.RLock()
	defer w.mu.RUnlock()

	secrets := w.byHost[reach.Normal(host)]
	w.injectHeader(host, secrets, r.Header)
	w.injectQuery(host, secrets, r.URL)
}

func (w *Injector) injectHeader(host string, secrets []*injected, header http.Header) {
	var matched []*injected
	for _, each := range secrets {
		if each.matchesPlaceholder(header) {
			matched = append(matched, each)
		}
	}

	for _, each := range matched {
		header.Del(each.name)
	}
	for name, values := range header {
		if slices.ContainsFunc(values, containsStandIn) {
			delete(header, name)
			w.log.Warn("took a stand-in that egress has no value for off a request", "host", host, "header", name)
		}
	}
	for _, each := range matched {
		header.Add(each.name, string(each.value))
	}
}

func (w *Injector) injectQuery(host string, secrets []*injected, target *url.URL) {
	if target.RawQuery == "" {
		return
	}

	segments := strings.Split(target.RawQuery, "&")
	kept := segments[:0]
	for _, segment := range segments {
		rawName, rawValue, _ := strings.Cut(segment, "=")
		name, value := unescaped(rawName), unescaped(rawValue)
		if !containsStandIn(segment) && !containsStandIn(name+"="+value) {
			kept = append(kept, segment)
			continue
		}

		index := slices.IndexFunc(secrets, func(each *injected) bool { return each.hasPlaceholder(name, value) })
		if index < 0 {
			w.log.Warn("took a stand-in that egress has no value for off a request", "host", host, "parameter", name)
			continue
		}

		kept = append(kept, rawName+"="+url.QueryEscape(string(secrets[index].value)))
	}

	target.RawQuery = strings.Join(kept, "&")
}

func unescaped(raw string) string {
	if read, err := url.QueryUnescape(raw); err == nil {
		return read
	}
	return raw
}

var standInMark = strings.TrimSuffix(protocol.StandInPrefix, ":")

func containsStandIn(text string) bool {
	return strings.Contains(strings.ToLower(text), standInMark)
}

func (w *Injector) Forget() {
	w.mu.Lock()
	defer w.mu.Unlock()

	for host, secrets := range w.byHost {
		for _, each := range secrets {
			clear(each.value)
			clear(each.bare)
		}
		delete(w.byHost, host)
	}
}
