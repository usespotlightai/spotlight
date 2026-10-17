package wear

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
	Read(ctx context.Context, source protocol.ReadInNetwork) (string, error)
}

type Limits struct {
	Hosts interface{ Admits(host string) bool }
	Reads []string
}

func (l Limits) reads(secretID string) bool {
	return slices.ContainsFunc(l.Reads, func(entry string) bool {
		if prefix, pattern := strings.CutSuffix(entry, "*"); pattern {
			return strings.HasPrefix(secretID, prefix)
		}
		return entry == secretID
	})
}

type worn struct {
	secret   string
	carrier  string
	name     string
	value    []byte
	bare     []byte
	prefix   string
	standIns []string
	fromHost bool
	plainOn  string
}

func (w *worn) inPlaceOf(header http.Header) bool {
	return w.carrier == protocol.CarriedInHeader && slices.Contains(w.standIns, header.Get(w.name))
}

func (w *worn) standsIn(name, value string) bool {
	return w.carrier == protocol.CarriedInQuery && w.name == name && slices.Contains(w.standIns, value)
}

func (w *worn) slot() string {
	if w.carrier == protocol.CarriedInQuery {
		return "?" + w.name
	}
	return w.name
}

func carried(carrier, name string) (string, string) {
	if carrier == protocol.CarriedInHeader {
		return carrier, http.CanonicalHeaderKey(name)
	}
	return carrier, name
}

type Wearing struct {
	mu     sync.RWMutex
	toward map[string][]*worn
	log    *slog.Logger
}

func From(
	ctx context.Context, redeemed protocol.EgressRedemption, harnessKeys []protocol.HarnessKey, limits Limits,
	opener Opener, reader func() (Reader, error), log *slog.Logger,
) *Wearing {
	wearing := &Wearing{toward: map[string][]*worn{}, log: log}

	for _, key := range harnessKeys {
		host, header := reach.Normal(key.Host), http.CanonicalHeaderKey(key.Header)
		if refusal := harnessKeyRefusal(host, header, key, limits); refusal != "" {
			log.Warn("egress will not wear a key the host has", "key", key.Name, "host", host, "reason", refusal)
			continue
		}
		wearing.toward[host] = append(wearing.toward[host], &worn{
			secret:   key.Name,
			carrier:  protocol.CarriedInHeader,
			name:     header,
			value:    []byte(key.Prefix + key.Value),
			bare:     []byte(key.Value),
			prefix:   key.Prefix,
			standIns: []string{key.Prefix + protocol.StandInPrefix + key.Name},
			fromHost: true,
		})
		log.Info("keeps a host key for the run", "key", key.Name, "host", host, "header", key.Header)
	}

	for _, withheld := range redeemed.Withheld {
		log.Warn("the run wears a secret egress was not given", "secret", withheld.Secret, "reason", withheld.Reason)
	}

	for _, secret := range redeemed.Secrets {
		host := reach.Normal(secret.Host)
		carrier, name := carried(secret.Carrier, secret.Name)

		if refusal := wearing.refusal(host, carrier, name, secret, limits); refusal != "" {
			log.Warn("egress will not wear a secret the run wears", "secret", secret.Secret, "host", host, "reason", refusal)
			continue
		}

		value, err := valueOf(ctx, redeemed.RunID, secret, opener, reader)
		if err == nil && strings.ContainsAny(value, "\r\n\x00") {
			err = fmt.Errorf("it has more than one line, so it cannot be worn in a request")
		}
		if err != nil {
			log.Warn("could not keep a secret the run wears", "secret", secret.Secret, "host", secret.Host, "error", err)
			continue
		}

		standIn := protocol.StandInPrefix + secret.Secret
		wearing.toward[host] = append(wearing.toward[host], &worn{
			secret:   secret.Secret,
			carrier:  carrier,
			name:     name,
			value:    []byte(secret.Prefix + value),
			bare:     []byte(value),
			prefix:   secret.Prefix,
			standIns: slices.Compact([]string{standIn, secret.Prefix + standIn}),
		})
		log.Info("keeps a secret for the run", "secret", secret.Secret, "host", host, "carrier", carrier, "name", name)
	}

	return wearing
}

func harnessKeyRefusal(host, header string, key protocol.HarnessKey, limits Limits) string {
	switch {
	case !limits.Hosts.Admits(host):
		return "the host's allow-list does not admit " + host
	case header == "" || key.Value == "" || strings.ContainsAny(key.Value+key.Prefix, "\r\n\x00"):
		return "it is empty or more than one line"
	default:
		return ""
	}
}

func (w *Wearing) refusal(host, carrier, name string, secret protocol.RedeemedSecret, limits Limits) string {
	slot := (&worn{carrier: carrier, name: name}).slot()

	switch {
	case slices.ContainsFunc(w.toward[host], func(each *worn) bool { return each.fromHost }):
		return "the host has a key of its own for " + host
	case !limits.Hosts.Admits(host):
		return "the host's allow-list does not admit " + host
	case secret.ReadInNetwork != nil && !limits.reads(secret.ReadInNetwork.SecretID):
		return "the host does not let egress read " + secret.ReadInNetwork.SecretID
	case carrier != protocol.CarriedInHeader && carrier != protocol.CarriedInQuery:
		return "it is worn in neither a header nor a query parameter"
	case name == "":
		return "it names no " + carrier + " to be worn in"
	case slices.ContainsFunc(w.toward[host], func(each *worn) bool { return each.slot() == slot }):
		return "another secret is already worn in " + slot + " toward " + host
	default:
		return ""
	}
}

func valueOf(
	ctx context.Context, runID string, secret protocol.RedeemedSecret, opener Opener, reader func() (Reader, error),
) (string, error) {
	switch {
	case secret.Sealed != "":
		return opener.Open(secret.Sealed, runID, secret.Secret)
	case secret.ReadInNetwork != nil:
		read, err := reader()
		if err != nil {
			return "", err
		}
		return read.Read(ctx, *secret.ReadInNetwork)
	default:
		return "", fmt.Errorf("the control plane sent neither a sealed value nor where to read one")
	}
}

func (w *Wearing) TowardControlPlane(api *protocol.SpotlightAPI, controlPlane *url.URL, runID string, opener Opener) error {
	if api == nil {
		return nil
	}

	host := reach.Normal(controlPlane.Hostname())
	const prefix, header = "Bearer ", "Authorization"

	w.mu.Lock()
	defer w.mu.Unlock()

	slot := (&worn{carrier: protocol.CarriedInHeader, name: header}).slot()
	for _, each := range w.toward[host] {
		if each.fromHost {
			return fmt.Errorf("the host has a key of its own for %s", host)
		}
		if each.slot() == slot {
			return fmt.Errorf("another secret is already worn in %s toward %s", slot, host)
		}
	}

	value, err := opener.Open(api.Sealed, runID, protocol.SpotlightAPISecret)
	if err != nil {
		return err
	}

	w.toward[host] = append(w.toward[host], &worn{
		secret:   protocol.SpotlightAPISecret,
		carrier:  protocol.CarriedInHeader,
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

func (w *Wearing) OntoPlain(host, port string, r *http.Request) {
	w.mu.RLock()
	defer w.mu.RUnlock()

	var plain []*worn
	for _, each := range w.toward[reach.Normal(host)] {
		if each.plainOn != "" && each.plainOn == port {
			plain = append(plain, each)
		}
	}
	w.ontoHeader(host, plain, r.Header)
}

func (w *Wearing) Hosts() []string {
	w.mu.RLock()
	defer w.mu.RUnlock()

	hosts := make([]string, 0, len(w.toward))
	for host := range w.toward {
		hosts = append(hosts, host)
	}
	slices.Sort(hosts)

	return hosts
}

func (w *Wearing) Wears(host string) bool {
	w.mu.RLock()
	defer w.mu.RUnlock()

	return len(w.toward[reach.Normal(host)]) > 0
}

func (w *Wearing) Onto(host string, r *http.Request) {
	w.mu.RLock()
	defer w.mu.RUnlock()

	secrets := w.toward[reach.Normal(host)]
	w.ontoHeader(host, secrets, r.Header)
	w.ontoQuery(host, secrets, r.URL)
}

func (w *Wearing) ontoHeader(host string, secrets []*worn, header http.Header) {
	var wearing []*worn
	for _, each := range secrets {
		if each.inPlaceOf(header) {
			wearing = append(wearing, each)
		}
	}

	for _, each := range wearing {
		header.Del(each.name)
	}
	for name, values := range header {
		if slices.ContainsFunc(values, standsIn) {
			delete(header, name)
			w.log.Warn("took a stand-in that egress has no value for off a request", "host", host, "header", name)
		}
	}
	for _, each := range wearing {
		header.Add(each.name, string(each.value))
	}
}

func (w *Wearing) ontoQuery(host string, secrets []*worn, target *url.URL) {
	if target.RawQuery == "" {
		return
	}

	segments := strings.Split(target.RawQuery, "&")
	kept := segments[:0]
	for _, segment := range segments {
		rawName, rawValue, _ := strings.Cut(segment, "=")
		name, value := unescaped(rawName), unescaped(rawValue)
		if !standsIn(segment) && !standsIn(name+"="+value) {
			kept = append(kept, segment)
			continue
		}

		index := slices.IndexFunc(secrets, func(each *worn) bool { return each.standsIn(name, value) })
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

func standsIn(text string) bool {
	return strings.Contains(strings.ToLower(text), standInMark)
}

func (w *Wearing) Forget() {
	w.mu.Lock()
	defer w.mu.Unlock()

	for host, secrets := range w.toward {
		for _, each := range secrets {
			clear(each.value)
			clear(each.bare)
		}
		delete(w.toward, host)
	}
}
