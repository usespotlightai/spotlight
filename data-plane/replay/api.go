package replay

import (
	"bytes"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"usespotlight.ai/data-plane/protocol"
)

const (
	clientHeader      = "Spotlight-Client"
	idempotencyHeader = "Idempotency-Key"
)

type tokenSource func(renewed bool) (string, error)

type api struct {
	base    string
	tokens  tokenSource
	renews  bool
	version string
	http    *http.Client
}

type problem struct {
	Type   string                `json:"type"`
	Status int                   `json:"status"`
	Title  string                `json:"title"`
	Detail string                `json:"detail"`
	Errors []protocol.FieldError `json:"errors"`
}

type answered struct {
	status int
	said   problem
}

func (a *answered) Error() string {
	var told strings.Builder

	switch {
	case a.said.Detail != "" && len(a.said.Errors) == 0:
		told.WriteString(a.said.Detail)
	case a.said.Title != "":
		told.WriteString(a.said.Title)
	default:
		fmt.Fprintf(&told, "Spotlight answered %d", a.status)
	}

	for _, each := range a.said.Errors {
		fmt.Fprintf(&told, "\n  %s: %s", each.Path, each.Message)
	}

	return told.String()
}

func newAPI(base, token, version string) *api {
	return newAPIWith(base, version, func(bool) (string, error) { return token, nil }, false)
}

func newAPIWith(base, version string, tokens tokenSource, renews bool) *api {
	return &api{
		base:    strings.TrimSuffix(base, "/"),
		tokens:  tokens,
		renews:  renews,
		version: version,
		http:    &http.Client{Timeout: 2 * time.Minute},
	}
}

func (a *api) get(path string, into any) error {
	return a.call(http.MethodGet, path, nil, nil, into)
}

func (a *api) read(path string, raw *json.RawMessage, into any) error {
	if err := a.get(path, raw); err != nil {
		return err
	}

	if err := json.Unmarshal(*raw, into); err != nil {
		return fmt.Errorf("Spotlight answered with %q", string(*raw))
	}

	return nil
}

func (a *api) post(path string, body, into any) error {
	return a.call(http.MethodPost, path, body, nil, into)
}

func (a *api) create(path string, body, into any) error {
	return a.createOnce(path, newKey(), body, into)
}

func (a *api) createOnce(path, key string, body, into any) error {
	once := map[string]string{idempotencyHeader: key}

	err := a.call(http.MethodPost, path, body, once, into)
	if transient(err) {
		err = a.call(http.MethodPost, path, body, once, into)
	}

	return err
}

func (a *api) call(method, path string, body any, headers map[string]string, into any) error {
	var written []byte
	if body != nil {
		marshalled, err := json.Marshal(body)
		if err != nil {
			return err
		}
		written = marshalled
	}

	err := a.attempt(method, path, written, headers, into, false)

	var refused *answered
	if a.renews && errors.As(err, &refused) && refused.status == http.StatusUnauthorized {
		err = a.attempt(method, path, written, headers, into, true)
	}

	return err
}

func (a *api) attempt(method, path string, written []byte, headers map[string]string, into any, renewed bool) error {
	token, err := a.tokens(renewed)
	if err != nil {
		return err
	}

	var sent io.Reader
	if written != nil {
		sent = bytes.NewReader(written)
	}

	request, err := http.NewRequest(method, a.base+path, sent)
	if err != nil {
		return err
	}
	request.Header.Set("Authorization", "Bearer "+token)
	request.Header.Set("Accept", "application/json")
	request.Header.Set(clientHeader, "cli/"+a.version)
	if written != nil {
		request.Header.Set("Content-Type", "application/json")
	}
	for name, value := range headers {
		request.Header.Set(name, value)
	}

	response, err := a.http.Do(request)
	if err != nil {
		return fmt.Errorf("reach Spotlight: %w", err)
	}
	defer response.Body.Close()

	read, err := io.ReadAll(response.Body)
	if err != nil {
		return fmt.Errorf("read Spotlight's answer: %w", err)
	}

	if response.StatusCode >= http.StatusMultipleChoices {
		refused := &answered{status: response.StatusCode}
		_ = json.Unmarshal(read, &refused.said)
		return refused
	}

	if into == nil || len(bytes.TrimSpace(read)) == 0 {
		return nil
	}

	if err := json.Unmarshal(read, into); err != nil {
		return fmt.Errorf("Spotlight answered with %q", string(read))
	}

	return nil
}

func transient(err error) bool {
	if err == nil {
		return false
	}

	var refused *answered
	if errors.As(err, &refused) {
		return refused.status >= http.StatusInternalServerError
	}

	return true
}

func newKey() string {
	key := make([]byte, 16)
	_, _ = rand.Read(key)
	return hex.EncodeToString(key)
}
