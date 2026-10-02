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

	"usespotlight.ai/data-plane/protocol"
)

const mostInput = 8 << 20

type Tooler func(ctx context.Context, name string, input json.RawMessage) (json.RawMessage, error)

type Answerer func(ctx context.Context, said protocol.Remark) error

type Tracer func(ctx context.Context, taskID string) (json.RawMessage, error)

type Historian func(ctx context.Context, asked protocol.HistoryRequest) (json.RawMessage, error)

type Recaller func(ctx context.Context, asked protocol.RecallRequest) (json.RawMessage, error)

type Rememberer func(ctx context.Context, remembered protocol.Remembering) (json.RawMessage, error)

type Proposer func(ctx context.Context, proposal protocol.CandidateProposal) (json.RawMessage, error)

type Refusal struct {
	Because string
}

func (r *Refusal) Error() string { return r.Because }

func (r *Refusal) Refused() (string, bool) { return r.Because, true }

type refusing interface {
	Refused() (string, bool)
}

type unfit interface {
	Unfit() ([]protocol.FieldError, bool)
}

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
	history   Historian
	recall    Recaller
	remember  Rememberer
	propose   Proposer

	mu       sync.Mutex
	declared *protocol.Outcome
	spoken   chan struct{}
	once     sync.Once
}

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

func (s *Server) Histories(history Historian) {
	s.history = history
}

func (s *Server) Memories(recall Recaller, remember Rememberer) {
	s.recall = recall
	s.remember = remember
}

func (s *Server) Candidates(propose Proposer) {
	s.propose = propose
}

func (s *Server) Spoken() <-chan struct{} {
	return s.spoken
}

func (s *Server) Take() *protocol.Outcome {
	s.mu.Lock()
	defer s.mu.Unlock()

	declared := s.declared
	s.declared = nil
	return declared
}

func (s *Server) Close() error {
	return s.http.Close()
}

func (s *Server) ServeHTTP(writer http.ResponseWriter, request *http.Request) {
	if request.Header.Get("Authorization") != "Bearer "+s.token {
		refuse(writer, http.StatusUnauthorized, "not this run's token")
		return
	}

	if request.Method == http.MethodGet && path.Clean(request.URL.Path) == strings.TrimSuffix(protocol.HandoverToolsPath, "/") {
		s.describe(writer)
		return
	}

	if request.Method != http.MethodPost {
		refuse(writer, http.StatusMethodNotAllowed, "post a handover")
		return
	}

	if path.Clean(request.URL.Path) == strings.TrimSuffix(protocol.HandoverToolsPath, "/") {
		refuse(writer, http.StatusNotFound, "name the tool: post to "+protocol.HandoverToolsPath+"<name>")
		return
	}

	if name, found := strings.CutPrefix(path.Clean(request.URL.Path), protocol.HandoverToolsPath); found {
		s.tool(writer, request, name)
		return
	}

	if path.Clean(request.URL.Path) == protocol.HandoverRemarkPath {
		s.remark(writer, request)
		return
	}

	if path.Clean(request.URL.Path) == protocol.HandoverTracePath {
		s.traceOf(writer, request)
		return
	}

	if path.Clean(request.URL.Path) == protocol.HandoverHistoryPath {
		s.historyOf(writer, request)
		return
	}

	if path.Clean(request.URL.Path) == protocol.HandoverRecallPath {
		s.recalled(writer, request)
		return
	}

	if path.Clean(request.URL.Path) == protocol.HandoverRememberPath {
		s.remembered(writer, request)
		return
	}

	if path.Clean(request.URL.Path) == protocol.HandoverCandidatePath {
		s.proposed(writer, request)
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
		var refused refusing
		if errors.As(err, &refused) {
			if because, ok := refused.Refused(); ok {
				refuse(writer, http.StatusUnprocessableEntity, because)
				return
			}
		}

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

func (s *Server) historyOf(writer http.ResponseWriter, request *http.Request) {
	if s.history == nil {
		refuse(writer, http.StatusNotImplemented, "this run cannot read a station's history")
		return
	}

	var asked protocol.HistoryRequest
	if err := json.NewDecoder(io.LimitReader(request.Body, mostInput)).Decode(&asked); err != nil {
		refuse(writer, http.StatusBadRequest, "unreadable history request")
		return
	}

	if strings.TrimSpace(asked.Station) == "" {
		refuse(writer, http.StatusUnprocessableEntity, "say which station")
		return
	}

	s.answered(writer, func() (json.RawMessage, error) { return s.history(request.Context(), asked) })
}

func (s *Server) recalled(writer http.ResponseWriter, request *http.Request) {
	if s.recall == nil {
		refuse(writer, http.StatusNotImplemented, "this run cannot recall what its team remembers")
		return
	}

	var asked protocol.RecallRequest
	if err := json.NewDecoder(io.LimitReader(request.Body, mostInput)).Decode(&asked); err != nil {
		refuse(writer, http.StatusBadRequest, "unreadable recall")
		return
	}

	if strings.TrimSpace(asked.Words) == "" && strings.TrimSpace(asked.Handle) == "" {
		refuse(writer, http.StatusUnprocessableEntity, "say what to look for, or which memory, like M-12")
		return
	}

	s.answered(writer, func() (json.RawMessage, error) { return s.recall(request.Context(), asked) })
}

func (s *Server) remembered(writer http.ResponseWriter, request *http.Request) {
	if s.remember == nil {
		refuse(writer, http.StatusNotImplemented, "this run cannot propose a memory")
		return
	}

	var remembered protocol.Remembering
	if err := json.NewDecoder(io.LimitReader(request.Body, mostInput)).Decode(&remembered); err != nil {
		refuse(writer, http.StatusBadRequest, "unreadable memory")
		return
	}

	if strings.TrimSpace(remembered.Kind) == "" || strings.TrimSpace(remembered.Body) == "" {
		refuse(writer, http.StatusUnprocessableEntity, "say what kind of memory it is, and what to remember")
		return
	}

	s.answered(writer, func() (json.RawMessage, error) { return s.remember(request.Context(), remembered) })
}

func (s *Server) proposed(writer http.ResponseWriter, request *http.Request) {
	if s.propose == nil {
		refuse(writer, http.StatusNotImplemented, "this run cannot propose a candidate: only a search's runs do")
		return
	}

	var proposal protocol.CandidateProposal
	if err := json.NewDecoder(io.LimitReader(request.Body, mostInput)).Decode(&proposal); err != nil {
		refuse(writer, http.StatusBadRequest, "unreadable candidate")
		return
	}

	if !protocol.IsCandidateName(proposal.Name) {
		refuse(writer, http.StatusUnprocessableEntity, fmt.Sprintf(
			"%q cannot name a candidate: a name is a slug of lowercase letters, digits and hyphens, starting with a letter or digit, at most 63 characters", proposal.Name,
		))
		return
	}

	if strings.TrimSpace(proposal.Hypothesis) == "" {
		refuse(writer, http.StatusUnprocessableEntity, "say what you expect the candidate to change")
		return
	}

	if !jsonObject(proposal.Station) {
		refuse(writer, http.StatusUnprocessableEntity, "the station block is a JSON object, as the line resource holds a station")
		return
	}

	answer, err := s.propose(request.Context(), proposal)

	var found unfit
	if err != nil && errors.As(err, &found) {
		if errs, ok := found.Unfit(); ok {
			writer.Header().Set("Content-Type", "application/problem+json")
			writer.WriteHeader(http.StatusUnprocessableEntity)
			_ = json.NewEncoder(writer).Encode(protocol.FieldErrors{Errors: errs})
			return
		}
	}

	s.answered(writer, func() (json.RawMessage, error) { return answer, err })
}

func jsonObject(raw json.RawMessage) bool {
	var object map[string]json.RawMessage
	return json.Unmarshal(raw, &object) == nil && object != nil
}

func (s *Server) answered(writer http.ResponseWriter, asking func() (json.RawMessage, error)) {
	answer, err := asking()
	if err != nil {
		var refused refusing
		if errors.As(err, &refused) {
			if because, ok := refused.Refused(); ok {
				refuse(writer, http.StatusUnprocessableEntity, because)
				return
			}
		}

		refuse(writer, http.StatusBadGateway, err.Error())
		return
	}

	writer.Header().Set("Content-Type", "application/json")
	writer.WriteHeader(http.StatusOK)
	_, _ = writer.Write(answer)
}

func (s *Server) option(spoken string) (string, bool) {
	for _, allowed := range s.options {
		if strings.EqualFold(spoken, allowed) {
			return allowed, true
		}
	}

	return "", false
}

func noteLength(note string) int {
	return len(utf16.Encode([]rune(strings.TrimSpace(note))))
}

func refuse(writer http.ResponseWriter, status int, because string) {
	writer.Header().Set("Content-Type", "text/plain; charset=utf-8")
	writer.WriteHeader(status)
	_, _ = writer.Write([]byte(because + "\n"))
}
