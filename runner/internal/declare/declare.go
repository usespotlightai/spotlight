// Package declare lets the agent working a run say what should happen to its
// task next. The listener is the runner's, not the agent's, so the control
// plane token stays out of model-directed code, and it is raised per run on a
// loopback port of its own, so the run it speaks for cannot be mistaken.
package declare

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"net"
	"net/http"
	"strings"
	"sync"

	"usespotlight.ai/runner/internal/protocol"
)

// Granted to the agent explicitly, unlike the runner's own SPOTLIGHT_
// variables, which are stripped from what it inherits.
const (
	URLVar   = "SPOTLIGHT_HANDOVER_URL"
	TokenVar = "SPOTLIGHT_HANDOVER_TOKEN"
)

type Server struct {
	listener net.Listener
	http     *http.Server
	token    string
	options  []string

	mu       sync.Mutex
	declared *protocol.Outcome
	spoken   chan struct{}
	once     sync.Once
}

// Serve listens on a loopback port of the operating system's choosing. The
// token it mints is no secret from the agent, and good for nothing else.
func Serve(options []string) (*Server, error) {
	raw := make([]byte, 32)
	if _, err := rand.Read(raw); err != nil {
		return nil, fmt.Errorf("mint a handover token: %w", err)
	}

	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		return nil, fmt.Errorf("listen for the agent: %w", err)
	}

	server := &Server{
		listener: listener,
		token:    hex.EncodeToString(raw),
		options:  options,
		spoken:   make(chan struct{}),
	}
	server.http = &http.Server{Handler: server}

	go func() {
		err := server.http.Serve(listener)
		if err != nil && !errors.Is(err, http.ErrServerClosed) {
			return
		}
	}()

	return server, nil
}

func (s *Server) URL() string {
	return "http://" + s.listener.Addr().String() + "/"
}

func (s *Server) Token() string {
	return s.token
}

// Spoken closes when the agent first declares. An agent at a terminal never
// exits on its own, and this is the only word it says that means "finished".
func (s *Server) Spoken() <-chan struct{} {
	return s.spoken
}

// Declared is what the agent said, or nil if it said nothing. An agent that
// speaks twice has changed its mind, and the last word stands.
func (s *Server) Declared() *protocol.Outcome {
	s.mu.Lock()
	defer s.mu.Unlock()

	return s.declared
}

func (s *Server) Close() error {
	return s.http.Close()
}

func (s *Server) ServeHTTP(writer http.ResponseWriter, request *http.Request) {
	if request.Header.Get("Authorization") != "Bearer "+s.token {
		refuse(writer, http.StatusUnauthorized, "not this run's token")
		return
	}

	if request.Method != http.MethodPost {
		refuse(writer, http.StatusMethodNotAllowed, "post a handover")
		return
	}

	var spoken protocol.Outcome
	if err := json.NewDecoder(request.Body).Decode(&spoken); err != nil {
		refuse(writer, http.StatusBadRequest, "unreadable handover")
		return
	}

	next, allowed := s.option(spoken.Next)
	if !allowed {
		refuse(writer, http.StatusUnprocessableEntity, fmt.Sprintf(
			"%q is not one of: %s",
			spoken.Next, strings.Join(s.options, ", "),
		))

		return
	}

	s.mu.Lock()
	s.declared = &protocol.Outcome{Next: next, Note: spoken.Note}
	s.mu.Unlock()

	s.once.Do(func() { close(s.spoken) })

	writer.WriteHeader(http.StatusNoContent)
}

// option matches however the agent cased it and answers with the control
// plane's spelling.
func (s *Server) option(spoken string) (string, bool) {
	for _, allowed := range s.options {
		if strings.EqualFold(spoken, allowed) {
			return allowed, true
		}
	}

	return "", false
}

// refuse says why in plain text, because the agent reads what it is told.
func refuse(writer http.ResponseWriter, status int, because string) {
	writer.Header().Set("Content-Type", "text/plain; charset=utf-8")
	writer.WriteHeader(status)
	_, _ = writer.Write([]byte(because + "\n"))
}
