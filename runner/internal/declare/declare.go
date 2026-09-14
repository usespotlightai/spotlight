// Package declare: the runner's per-run loopback listener keeps the control plane token out of model-directed code.
package declare

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"path"
	"slices"
	"strings"
	"sync"
	"unicode/utf16"

	"usespotlight.ai/runner/internal/protocol"
)

// Arrives among the options but names a person, not a station.
const Review = "review"

const Done = "done"

const (
	URLVar   = "SPOTLIGHT_HANDOVER_URL"
	TokenVar = "SPOTLIGHT_HANDOVER_TOKEN"
)

const ToolsPath = "/tools/"

const RemarkPath = "/remark"

const TracePath = "/trace"

const mostInput = 1 << 20

type Tooler func(ctx context.Context, name string, input json.RawMessage) (json.RawMessage, error)

type Answerer func(ctx context.Context, said protocol.Remark) error

// Uses the runner's token, so the agent never holds one.
type Tracer func(ctx context.Context, taskID string) (json.RawMessage, error)

type Server struct {
	listener  net.Listener
	http      *http.Server
	token     string
	options   []string
	noteLimit int
	granted   []string
	manifest  []protocol.ToolManifest
	use       Tooler
	answer    Answerer
	trace     Tracer

	mu       sync.Mutex
	declared *protocol.Outcome
	spoken   chan struct{}
	once     sync.Once
}

// Loopback only; the minted token is no secret from the agent and grants nothing else.
func Serve(options []string, noteLimit int, answer Answerer) (*Server, error) {
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

func (s *Server) Tools(granted []string, use Tooler) {
	s.granted = granted
	s.use = use
}

func (s *Server) Manifest(tools []protocol.ToolManifest) {
	s.manifest = tools
}

func (s *Server) Traces(trace Tracer) {
	s.trace = trace
}

// An agent at a terminal never exits on its own; this is its only "finished".
func (s *Server) Spoken() <-chan struct{} {
	return s.spoken
}

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

	if request.Method == http.MethodGet && path.Clean(request.URL.Path) == strings.TrimSuffix(ToolsPath, "/") {
		s.describe(writer)
		return
	}

	if request.Method != http.MethodPost {
		refuse(writer, http.StatusMethodNotAllowed, "post a handover")
		return
	}

	if path.Clean(request.URL.Path) == strings.TrimSuffix(ToolsPath, "/") {
		refuse(writer, http.StatusNotFound, "name the tool: post to "+ToolsPath+"<name>")
		return
	}

	if name, found := strings.CutPrefix(path.Clean(request.URL.Path), ToolsPath); found {
		s.tool(writer, request, name)
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

func (s *Server) tool(writer http.ResponseWriter, request *http.Request, name string) {
	if s.use == nil || !slices.Contains(s.granted, name) {
		refuse(writer, http.StatusForbidden, fmt.Sprintf(
			"this run was not given %q; it was given: %s", name, given(s.granted),
		))

		return
	}

	input, err := io.ReadAll(io.LimitReader(request.Body, mostInput+1))
	if err != nil || len(input) > mostInput || !json.Valid(input) {
		refuse(writer, http.StatusBadRequest, "unreadable input: hand the tool JSON")
		return
	}

	answer, err := s.use(request.Context(), name, input)
	if err != nil {
		refuse(writer, http.StatusBadGateway, err.Error())
		return
	}

	writer.Header().Set("Content-Type", "application/json")
	writer.WriteHeader(http.StatusOK)
	_, _ = writer.Write(answer)
}

func (s *Server) describe(writer http.ResponseWriter) {
	shown := []protocol.ToolManifest{}

	for _, tool := range s.manifest {
		if slices.Contains(s.granted, tool.Name) {
			shown = append(shown, tool)
		}
	}

	writer.Header().Set("Content-Type", "application/json")
	writer.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(writer).Encode(shown)
}

func given(tools []string) string {
	if len(tools) == 0 {
		return "nothing"
	}

	return strings.Join(tools, ", ")
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

func (s *Server) option(spoken string) (string, bool) {
	for _, allowed := range s.options {
		if strings.EqualFold(spoken, allowed) {
			return allowed, true
		}
	}

	return "", false
}

// Counts UTF-16 units, as the control plane's JavaScript does.
func noteLength(note string) int {
	return len(utf16.Encode([]rune(strings.TrimSpace(note))))
}

func refuse(writer http.ResponseWriter, status int, because string) {
	writer.Header().Set("Content-Type", "text/plain; charset=utf-8")
	writer.WriteHeader(status)
	_, _ = writer.Write([]byte(because + "\n"))
}
