package wear

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"
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
	header   string
	value    []byte
	standIns []string
	held     bool
}

func (w *worn) inPlaceOf(header http.Header) bool {
	return slices.Contains(w.standIns, header.Get(w.header))
}

type Wearing struct {
	mu     sync.RWMutex
	toward map[string][]*worn
	log    *slog.Logger
}

func From(
	ctx context.Context, redeemed protocol.EgressRedemption, held []protocol.HeldByTheHost, limits Limits,
	opener Opener, reader func() (Reader, error), log *slog.Logger,
) *Wearing {
	wearing := &Wearing{toward: map[string][]*worn{}, log: log}

	for _, key := range held {
		host, header := reach.Normal(key.Host), http.CanonicalHeaderKey(key.Header)
		if refusal := heldRefusal(host, header, key, limits); refusal != "" {
			log.Warn("egress will not wear a key the host holds", "key", key.Name, "host", host, "reason", refusal)
			continue
		}
		wearing.toward[host] = append(wearing.toward[host], &worn{
			secret:   key.Name,
			header:   header,
			value:    []byte(key.Prefix + key.Value),
			standIns: []string{key.Prefix + protocol.StandInPrefix + key.Name},
			held:     true,
		})
		log.Info("holds a key of the host's for the run", "key", key.Name, "host", host, "header", key.Header)
	}

	for _, withheld := range redeemed.Withheld {
		log.Warn("the run wears a secret egress was not given", "secret", withheld.Secret, "reason", withheld.Reason)
	}

	for _, secret := range redeemed.Secrets {
		host, header := reach.Normal(secret.Host), http.CanonicalHeaderKey(secret.Header)

		if refusal := wearing.refusal(host, header, secret, limits); refusal != "" {
			log.Warn("egress will not wear a secret the run wears", "secret", secret.Secret, "host", host, "reason", refusal)
			continue
		}

		value, err := valueOf(ctx, redeemed.RunID, secret, opener, reader)
		if err == nil && strings.ContainsAny(value, "\r\n\x00") {
			err = fmt.Errorf("it holds more than one line, so it cannot be worn in a header")
		}
		if err != nil {
			log.Warn("could not hold a secret the run wears", "secret", secret.Secret, "host", secret.Host, "error", err)
			continue
		}

		standIn := protocol.StandInPrefix + secret.Secret
		wearing.toward[host] = append(wearing.toward[host], &worn{
			secret:   secret.Secret,
			header:   header,
			value:    []byte(secret.Prefix + value),
			standIns: slices.Compact([]string{standIn, secret.Prefix + standIn}),
		})
		log.Info("holds a secret for the run", "secret", secret.Secret, "host", host, "header", secret.Header)
	}

	return wearing
}

func heldRefusal(host, header string, key protocol.HeldByTheHost, limits Limits) string {
	switch {
	case !limits.Hosts.Admits(host):
		return "the host's allow-list does not admit " + host
	case header == "" || key.Value == "" || strings.ContainsAny(key.Value+key.Prefix, "\r\n\x00"):
		return "it is empty or more than one line"
	default:
		return ""
	}
}

func (w *Wearing) refusal(host, header string, secret protocol.RedeemedSecret, limits Limits) string {
	switch {
	case slices.ContainsFunc(w.toward[host], func(each *worn) bool { return each.held }):
		return "the host holds a key of its own for " + host
	case !limits.Hosts.Admits(host):
		return "the host's allow-list does not admit " + host
	case secret.ReadInNetwork != nil && !limits.reads(secret.ReadInNetwork.SecretID):
		return "the host does not let egress read " + secret.ReadInNetwork.SecretID
	case slices.ContainsFunc(w.toward[host], func(each *worn) bool { return each.header == header }):
		return "another secret is already worn in " + header + " toward " + host
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

func (w *Wearing) Onto(host string, header http.Header) {
	w.mu.RLock()
	defer w.mu.RUnlock()

	var wearing []*worn
	for _, each := range w.toward[reach.Normal(host)] {
		if each.inPlaceOf(header) {
			wearing = append(wearing, each)
		}
	}

	for _, each := range wearing {
		header.Del(each.header)
	}
	for name, values := range header {
		if slices.ContainsFunc(values, func(value string) bool { return strings.Contains(value, protocol.StandInPrefix) }) {
			delete(header, name)
			w.log.Warn("took a stand-in egress does not hold off a request", "host", host, "header", name)
		}
	}
	for _, each := range wearing {
		header.Add(each.header, string(each.value))
	}
}

func (w *Wearing) Forget() {
	w.mu.Lock()
	defer w.mu.Unlock()

	for host, held := range w.toward {
		for _, each := range held {
			clear(each.value)
		}
		delete(w.toward, host)
	}
}
