package send

import (
	"bytes"
	"context"
	"crypto/tls"
	"encoding/base64"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"strings"
	"syscall"
	"time"

	"usespotlight.ai/data-plane/egressing/guard"
	"usespotlight.ai/data-plane/protocol"
)

const usualTimeout = 10 * time.Second

type Allowed interface {
	Admits(host string) bool
	Names(host string) bool
}

type Sender struct {
	allowed   Allowed
	transport *http.Transport
}

func New(allowed Allowed) *Sender {
	return &Sender{
		allowed: allowed,
		transport: &http.Transport{
			Proxy:               nil,
			DialContext:         guard.Dialer().DialContext,
			ForceAttemptHTTP2:   true,
			TLSHandshakeTimeout: 15 * time.Second,
			DisableKeepAlives:   true,
		},
	}
}

func (s *Sender) Send(ctx context.Context, call protocol.HostCall) protocol.HostCallAnswer {
	timeout := time.Duration(call.TimeoutMs) * time.Millisecond
	if timeout <= 0 {
		timeout = usualTimeout
	}

	began := time.Now()
	answer, err := s.sent(ctx, call, timeout)
	answer.Ms = int(time.Since(began).Milliseconds())
	if err != nil {
		return protocol.HostCallAnswer{Ms: answer.Ms, Error: plain(err, timeout)}
	}

	return answer
}

func (s *Sender) sent(ctx context.Context, call protocol.HostCall, timeout time.Duration) (protocol.HostCallAnswer, error) {
	address, err := url.Parse(call.URL)
	if err != nil || address.Hostname() == "" {
		return protocol.HostCallAnswer{}, &guard.Refusal{Reason: fmt.Sprintf("The call's URL isn't a valid address. URL: %s", call.URL)}
	}
	if address.Scheme != "https" && address.Scheme != "http" {
		return protocol.HostCallAnswer{}, &guard.Refusal{Reason: fmt.Sprintf("Egress sends only http and https calls. Scheme: %s", address.Scheme)}
	}

	host := address.Hostname()
	if !s.allowed.Admits(host) {
		return protocol.HostCallAnswer{}, &guard.Refusal{Reason: fmt.Sprintf("The host's allow-list doesn't admit %s.", host)}
	}

	body, err := base64.StdEncoding.DecodeString(call.Body)
	if err != nil {
		return protocol.HostCallAnswer{}, &guard.Refusal{Reason: "The call's body isn't base64."}
	}

	sending, cancel := context.WithTimeout(guard.Naming(ctx, s.allowed.Names(host)), timeout)
	defer cancel()

	request, err := http.NewRequestWithContext(sending, call.Method, address.String(), bytes.NewReader(body))
	if err != nil {
		return protocol.HostCallAnswer{}, err
	}
	for name, value := range call.Headers {
		if strings.EqualFold(name, "host") {
			request.Host = value
			continue
		}
		request.Header.Set(name, value)
	}

	client := &http.Client{
		Transport:     s.transport,
		CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse },
	}
	response, err := client.Do(request)
	if err != nil {
		return protocol.HostCallAnswer{}, err
	}
	defer response.Body.Close()

	read, err := io.ReadAll(io.LimitReader(response.Body, protocol.AnswerBodyMost))
	if err != nil {
		return protocol.HostCallAnswer{}, err
	}

	headers := make(map[string]string, len(response.Header))
	for name, values := range response.Header {
		headers[strings.ToLower(name)] = strings.Join(values, ", ")
	}

	answer := protocol.HostCallAnswer{Status: response.StatusCode, Headers: headers}
	if len(read) > 0 {
		answer.Body = base64.StdEncoding.EncodeToString(read)
	}

	return answer, nil
}

func plain(err error, timeout time.Duration) string {
	var (
		refusal    *guard.Refusal
		unresolved *net.DNSError
		unverified *tls.CertificateVerificationError
	)

	switch {
	case errors.As(err, &refusal):
		return refusal.Reason
	case errors.Is(err, context.DeadlineExceeded) || timedOut(err):
		return fmt.Sprintf("The call timed out. Time limit: %s", timeout)
	case errors.Is(err, context.Canceled):
		return "Egress stopped before the call was answered."
	case errors.Is(err, syscall.ECONNREFUSED):
		return "The server refused the connection."
	case errors.Is(err, syscall.ECONNRESET):
		return "The server reset the connection."
	case errors.As(err, &unresolved):
		return fmt.Sprintf("Host name %s doesn't resolve.", unresolved.Name)
	case errors.As(err, &unverified):
		return fmt.Sprintf("The server's certificate isn't trusted. Error: %v", unverified.Err)
	}

	var failed *url.Error
	if errors.As(err, &failed) {
		err = failed.Err
	}
	return err.Error()
}

func timedOut(err error) bool {
	var timeout interface{ Timeout() bool }
	return errors.As(err, &timeout) && timeout.Timeout()
}
