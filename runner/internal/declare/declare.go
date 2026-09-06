// Package declare lets the agent working a run say what should happen to its
// task next. The listener is the runner's, not the agent's, so the control
// plane token stays out of model-directed code, and it is raised per run on a
// loopback port of its own, so the run it speaks for cannot be mistaken.
package declare

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"net"
	"net/http"
	"path"
	"strings"
	"sync"
	"unicode/utf16"

	"usespotlight.ai/runner/internal/protocol"
)

// Granted to the agent explicitly, unlike the runner's own SPOTLIGHT_
// variables, which are stripped from what it inherits.
// Review is the control plane's word for a person. It arrives among the
// options like any other, but it does not name a station.
const Review = "review"

const (
	URLVar   = "SPOTLIGHT_HANDOVER_URL"
	TokenVar = "SPOTLIGHT_HANDOVER_TOKEN"
)

// PullRequestPath is where the agent asks for one, behind the same token.
const PullRequestPath = "/pull-request"

// RemarkPath is where the agent answers something said on the pull request.
const RemarkPath = "/remark"

// TracePath is where the agent reads a task's trace, behind the same token.
const TracePath = "/trace"

// Opener is the runner's, so nothing that reaches GitHub is in the agent's.
type Opener func(ctx context.Context, asked protocol.PullRequest) (string, error)

// Answerer is likewise the runner's, for answering what was said on one.
type Answerer func(ctx context.Context, said protocol.Remark) error

// Tracer is the runner's too: it reads a trace from the control plane with the
// runner's token, so the agent never holds one.
type Tracer func(ctx context.Context, taskID string) (json.RawMessage, error)

type Server struct {
	listener  net.Listener
	http      *http.Server
	token     string
	options   []string
	noteLimit int
	open      Opener
	answer    Answerer
	trace     Tracer

	mu       sync.Mutex
	declared *protocol.Outcome
	spoken   chan struct{}
	once     sync.Once
}

// Serve listens on a loopback port of the operating system's choosing. The
// token it mints is no secret from the agent, and good for nothing else.
func Serve(
	options []string, noteLimit int, open Opener, answer Answerer,
) (*Server, error) {
	raw := make([]byte, 32)
	if _, err := rand.Read(raw); err != nil {
		return nil, fmt.Errorf("mint a handover token: %w", err)
	}

	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		return nil, fmt.Errorf("listen for the agent: %w", err)
	}

	server := &Server{
		listener:  listener,
		token:     hex.EncodeToString(raw),
		options:   options,
		noteLimit: noteLimit,
		open:      open,
		answer:    answer,
		spoken:    make(chan struct{}),
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

// Traces sets what answers the agent's requests to read a task's trace. Left
// unset, the run cannot read one.
func (s *Server) Traces(trace Tracer) {
	s.trace = trace
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

	if path.Clean(request.URL.Path) == PullRequestPath {
		s.pullRequest(writer, request)
		return
	}

	if path.Clean(request.URL.Path) == RemarkPath {
		s.remark(writer, request)
		return
	}

	if path.Clean(request.URL.Path) == TracePath {
		s.traceOf(writer, request)
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

	// Said here, while the agent is still working and can shorten it. The
	// control plane refuses the same note, and by then the run is over.
	if written := noteLength(spoken.Note); s.noteLimit > 0 && written > s.noteLimit {
		refuse(writer, http.StatusUnprocessableEntity, fmt.Sprintf(
			"your note is %d characters and the limit is %d: say it shorter and hand over again",
			written, s.noteLimit,
		))

		return
	}

	s.mu.Lock()
	s.declared = &protocol.Outcome{Next: next, Note: spoken.Note}
	s.mu.Unlock()

	s.once.Do(func() { close(s.spoken) })

	writer.WriteHeader(http.StatusNoContent)
}

func (s *Server) remark(writer http.ResponseWriter, request *http.Request) {
	if s.answer == nil {
		refuse(writer, http.StatusNotImplemented, "this run cannot answer one")
		return
	}

	var said protocol.Remark
	if err := json.NewDecoder(request.Body).Decode(&said); err != nil {
		refuse(writer, http.StatusBadRequest, "unreadable answer")
		return
	}

	if strings.TrimSpace(said.Handle) == "" {
		refuse(writer, http.StatusUnprocessableEntity, "say which remark")
		return
	}

	if strings.TrimSpace(said.Body) == "" {
		refuse(writer, http.StatusUnprocessableEntity, "say something back")
		return
	}

	if err := s.answer(request.Context(), said); err != nil {
		refuse(writer, http.StatusBadGateway, err.Error())
		return
	}

	writer.WriteHeader(http.StatusNoContent)
}

func (s *Server) traceOf(writer http.ResponseWriter, request *http.Request) {
	if s.trace == nil {
		refuse(writer, http.StatusNotImplemented, "this run cannot read a trace")
		return
	}

	var asked protocol.TraceRequest
	if err := json.NewDecoder(request.Body).Decode(&asked); err != nil {
		refuse(writer, http.StatusBadRequest, "unreadable trace request")
		return
	}

	if strings.TrimSpace(asked.Task) == "" {
		refuse(writer, http.StatusUnprocessableEntity, "say which task")
		return
	}

	trace, err := s.trace(request.Context(), asked.Task)
	if err != nil {
		refuse(writer, http.StatusBadGateway, err.Error())
		return
	}

	writer.Header().Set("Content-Type", "application/json")
	writer.WriteHeader(http.StatusOK)
	_, _ = writer.Write(trace)
}

func (s *Server) pullRequest(writer http.ResponseWriter, request *http.Request) {
	if s.open == nil {
		refuse(writer, http.StatusNotImplemented, "this run cannot open one")
		return
	}

	var asked protocol.PullRequest
	if err := json.NewDecoder(request.Body).Decode(&asked); err != nil {
		refuse(writer, http.StatusBadRequest, "unreadable request")
		return
	}

	if strings.TrimSpace(asked.Title) == "" {
		refuse(writer, http.StatusUnprocessableEntity, "say what to call it")
		return
	}

	where, err := s.open(request.Context(), asked)
	if err != nil {
		refuse(writer, http.StatusBadGateway, err.Error())
		return
	}

	writer.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(writer).Encode(protocol.Opened{URL: where})
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

// noteLength counts the way the control plane counts, so a note that passes
// here is not refused there: JavaScript measures a string in UTF-16 units.
func noteLength(note string) int {
	return len(utf16.Encode([]rune(strings.TrimSpace(note))))
}

// refuse says why in plain text, because the agent reads what it is told.
func refuse(writer http.ResponseWriter, status int, because string) {
	writer.Header().Set("Content-Type", "text/plain; charset=utf-8")
	writer.WriteHeader(status)
	_, _ = writer.Write([]byte(because + "\n"))
}
