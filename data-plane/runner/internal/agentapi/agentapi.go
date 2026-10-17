package agentapi

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

const maxInput = 8 << 20

type Tooler func(ctx context.Context, name string, input json.RawMessage) (json.RawMessage, error)

type ReviewCommentReplier func(ctx context.Context, reply protocol.ReviewCommentReply) error

type Tracer func(ctx context.Context, taskID string) (json.RawMessage, error)

type Historian func(ctx context.Context, request protocol.HistoryRequest) (json.RawMessage, error)

type Recaller func(ctx context.Context, request protocol.RecallRequest) (json.RawMessage, error)

type Rememberer func(ctx context.Context, remembered protocol.Remembering) (json.RawMessage, error)

type Proposer func(ctx context.Context, proposal protocol.CandidateProposal) (json.RawMessage, error)

type CauseRecorder func(ctx context.Context, record protocol.CauseRecord) (json.RawMessage, error)

type Error struct {
	Because string
}

func (e *Error) Error() string { return e.Because }

func (e *Error) ClientErrorMessage() (string, bool) { return e.Because, true }

type messageError interface {
	ClientErrorMessage() (string, bool)
}

type unfit interface {
	InvalidFields() ([]protocol.FieldError, bool)
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
	reply     ReviewCommentReplier
	trace     Tracer
	history   Historian
	recall    Recaller
	remember  Rememberer
	propose   Proposer
	cause     CauseRecorder

	mu         sync.Mutex
	handover   *protocol.Handover
	handedOver chan struct{}
	once       sync.Once
}

func Serve(options []string, noteLimit int, reply ReviewCommentReplier) (*Server, error) {
	raw := make([]byte, 32)
	if _, err := rand.Read(raw); err != nil {
		return nil, fmt.Errorf("issue a handover token: %w", err)
	}

	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		return nil, fmt.Errorf("listen for the agent: %w", err)
	}

	server := &Server{
		listener:   listener,
		token:      hex.EncodeToString(raw),
		options:    options,
		noteLimit:  noteLimit,
		reply:      reply,
		handedOver: make(chan struct{}),
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

func (s *Server) Causes(record CauseRecorder) {
	s.cause = record
}

func (s *Server) HandedOver() <-chan struct{} {
	return s.handedOver
}

func (s *Server) TakeHandover() *protocol.Handover {
	s.mu.Lock()
	defer s.mu.Unlock()

	handover := s.handover
	s.handover = nil
	return handover
}

func (s *Server) Close() error {
	return s.http.Close()
}

func (s *Server) ServeHTTP(writer http.ResponseWriter, request *http.Request) {
	if request.Header.Get("Authorization") != "Bearer "+s.token {
		fail(writer, http.StatusUnauthorized, "not this run's token")
		return
	}

	if request.Method == http.MethodGet && path.Clean(request.URL.Path) == strings.TrimSuffix(protocol.AgentAPIToolsPath, "/") {
		s.describe(writer)
		return
	}

	if request.Method != http.MethodPost {
		fail(writer, http.StatusMethodNotAllowed, "post a handover")
		return
	}

	if path.Clean(request.URL.Path) == strings.TrimSuffix(protocol.AgentAPIToolsPath, "/") {
		fail(writer, http.StatusNotFound, "name the tool: post to "+protocol.AgentAPIToolsPath+"<name>")
		return
	}

	if name, found := strings.CutPrefix(path.Clean(request.URL.Path), protocol.AgentAPIToolsPath); found {
		s.tool(writer, request, name)
		return
	}

	if path.Clean(request.URL.Path) == protocol.AgentAPIReviewCommentReplyPath {
		s.replyToReviewComment(writer, request)
		return
	}

	if path.Clean(request.URL.Path) == protocol.AgentAPITracePath {
		s.traceOf(writer, request)
		return
	}

	if path.Clean(request.URL.Path) == protocol.AgentAPIHistoryPath {
		s.historyOf(writer, request)
		return
	}

	if path.Clean(request.URL.Path) == protocol.AgentAPIRecallPath {
		s.recalled(writer, request)
		return
	}

	if path.Clean(request.URL.Path) == protocol.AgentAPIRememberPath {
		s.remembered(writer, request)
		return
	}

	if path.Clean(request.URL.Path) == protocol.AgentAPICandidatePath {
		s.proposed(writer, request)
		return
	}

	if path.Clean(request.URL.Path) == protocol.AgentAPICausePath {
		s.caused(writer, request)
		return
	}

	var handover protocol.Handover
	if err := json.NewDecoder(request.Body).Decode(&handover); err != nil {
		fail(writer, http.StatusBadRequest, "unreadable handover")
		return
	}

	next, allowed := s.option(handover.Next)
	if !allowed {
		fail(writer, http.StatusUnprocessableEntity, fmt.Sprintf(
			"%q is not one of: %s",
			handover.Next, strings.Join(s.options, ", "),
		))

		return
	}

	if written := noteLength(handover.Note); s.noteLimit > 0 && written > s.noteLimit {
		fail(writer, http.StatusUnprocessableEntity, fmt.Sprintf(
			"your note is %d characters and the limit is %d: say it shorter and hand over again",
			written, s.noteLimit,
		))

		return
	}

	s.mu.Lock()
	s.handover = &protocol.Handover{Next: next, Note: handover.Note}
	s.mu.Unlock()

	s.once.Do(func() { close(s.handedOver) })

	writer.WriteHeader(http.StatusNoContent)
}

func (s *Server) tool(writer http.ResponseWriter, request *http.Request, name string) {
	if s.use == nil || !slices.Contains(s.granted, name) {
		fail(writer, http.StatusForbidden, fmt.Sprintf(
			"this run has no tool %q enabled; it has: %s", name, toolList(s.granted),
		))

		return
	}

	input, err := io.ReadAll(io.LimitReader(request.Body, maxInput+1))
	if err != nil || len(input) > maxInput || !json.Valid(input) {
		fail(writer, http.StatusBadRequest, "unreadable input: hand the tool JSON")
		return
	}

	answer, err := s.use(request.Context(), name, input)
	if err != nil {
		fail(writer, http.StatusBadGateway, err.Error())
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

func toolList(tools []string) string {
	if len(tools) == 0 {
		return "nothing"
	}

	return strings.Join(tools, ", ")
}

func (s *Server) replyToReviewComment(writer http.ResponseWriter, request *http.Request) {
	if s.reply == nil {
		fail(writer, http.StatusNotImplemented, "this run cannot reply to a review comment")
		return
	}

	var reply protocol.ReviewCommentReply
	if err := json.NewDecoder(request.Body).Decode(&reply); err != nil {
		fail(writer, http.StatusBadRequest, "unreadable reply")
		return
	}

	if strings.TrimSpace(reply.Handle) == "" {
		fail(writer, http.StatusUnprocessableEntity, "name the review comment")
		return
	}

	if strings.TrimSpace(reply.Body) == "" {
		fail(writer, http.StatusUnprocessableEntity, "write the reply")
		return
	}

	if err := s.reply(request.Context(), reply); err != nil {
		var rejected messageError
		if errors.As(err, &rejected) {
			if because, ok := rejected.ClientErrorMessage(); ok {
				fail(writer, http.StatusUnprocessableEntity, because)
				return
			}
		}

		fail(writer, http.StatusBadGateway, err.Error())
		return
	}

	writer.WriteHeader(http.StatusNoContent)
}

func (s *Server) traceOf(writer http.ResponseWriter, request *http.Request) {
	if s.trace == nil {
		fail(writer, http.StatusNotImplemented, "this run cannot read a trace")
		return
	}

	var body protocol.TraceRequest
	if err := json.NewDecoder(request.Body).Decode(&body); err != nil {
		fail(writer, http.StatusBadRequest, "unreadable trace request")
		return
	}

	if strings.TrimSpace(body.Task) == "" {
		fail(writer, http.StatusUnprocessableEntity, "say which task")
		return
	}

	trace, err := s.trace(request.Context(), body.Task)
	if err != nil {
		fail(writer, http.StatusBadGateway, err.Error())
		return
	}

	writer.Header().Set("Content-Type", "application/json")
	writer.WriteHeader(http.StatusOK)
	_, _ = writer.Write(trace)
}

func (s *Server) historyOf(writer http.ResponseWriter, request *http.Request) {
	if s.history == nil {
		fail(writer, http.StatusNotImplemented, "this run cannot read a station's history")
		return
	}

	var body protocol.HistoryRequest
	if err := json.NewDecoder(io.LimitReader(request.Body, maxInput)).Decode(&body); err != nil {
		fail(writer, http.StatusBadRequest, "unreadable history request")
		return
	}

	if strings.TrimSpace(body.Station) == "" {
		fail(writer, http.StatusUnprocessableEntity, "say which station")
		return
	}

	s.answered(writer, func() (json.RawMessage, error) { return s.history(request.Context(), body) })
}

func (s *Server) recalled(writer http.ResponseWriter, request *http.Request) {
	if s.recall == nil {
		fail(writer, http.StatusNotImplemented, "this run cannot recall what its team remembers")
		return
	}

	var body protocol.RecallRequest
	if err := json.NewDecoder(io.LimitReader(request.Body, maxInput)).Decode(&body); err != nil {
		fail(writer, http.StatusBadRequest, "unreadable recall")
		return
	}

	if strings.TrimSpace(body.Words) == "" && strings.TrimSpace(body.Handle) == "" {
		fail(writer, http.StatusUnprocessableEntity, "say what to look for, or which memory, like M-12")
		return
	}

	s.answered(writer, func() (json.RawMessage, error) { return s.recall(request.Context(), body) })
}

func (s *Server) remembered(writer http.ResponseWriter, request *http.Request) {
	if s.remember == nil {
		fail(writer, http.StatusNotImplemented, "this run cannot propose a memory")
		return
	}

	var remembered protocol.Remembering
	if err := json.NewDecoder(io.LimitReader(request.Body, maxInput)).Decode(&remembered); err != nil {
		fail(writer, http.StatusBadRequest, "unreadable memory")
		return
	}

	if strings.TrimSpace(remembered.Kind) == "" || strings.TrimSpace(remembered.Body) == "" {
		fail(writer, http.StatusUnprocessableEntity, "say what kind of memory it is, and what to remember")
		return
	}

	s.answered(writer, func() (json.RawMessage, error) { return s.remember(request.Context(), remembered) })
}

func (s *Server) proposed(writer http.ResponseWriter, request *http.Request) {
	if s.propose == nil {
		fail(writer, http.StatusNotImplemented, "this run cannot propose a candidate: only a search's runs do")
		return
	}

	var proposal protocol.CandidateProposal
	if err := json.NewDecoder(io.LimitReader(request.Body, maxInput)).Decode(&proposal); err != nil {
		fail(writer, http.StatusBadRequest, "unreadable candidate")
		return
	}

	if !protocol.IsCandidateName(proposal.Name) {
		fail(writer, http.StatusUnprocessableEntity, fmt.Sprintf(
			"%q cannot name a candidate: a name is a slug of lowercase letters, digits and hyphens, starting with a letter or digit, at most 63 characters", proposal.Name,
		))
		return
	}

	if strings.TrimSpace(proposal.Hypothesis) == "" {
		fail(writer, http.StatusUnprocessableEntity, "say what you expect the candidate to change")
		return
	}

	if !jsonObject(proposal.Station) {
		fail(writer, http.StatusUnprocessableEntity, "the station block is a JSON object, as the line resource contains a station")
		return
	}

	answer, err := s.propose(request.Context(), proposal)

	var found unfit
	if err != nil && errors.As(err, &found) {
		if errs, ok := found.InvalidFields(); ok {
			writer.Header().Set("Content-Type", "application/problem+json")
			writer.WriteHeader(http.StatusUnprocessableEntity)
			_ = json.NewEncoder(writer).Encode(protocol.FieldErrors{Errors: errs})
			return
		}
	}

	s.answered(writer, func() (json.RawMessage, error) { return answer, err })
}

func (s *Server) caused(writer http.ResponseWriter, request *http.Request) {
	if s.cause == nil {
		fail(writer, http.StatusNotImplemented, "this run cannot record a cause: only a search's runs do")
		return
	}

	var record protocol.CauseRecord
	if err := json.NewDecoder(io.LimitReader(request.Body, maxInput)).Decode(&record); err != nil {
		fail(writer, http.StatusBadRequest, "unreadable cause")
		return
	}

	if strings.TrimSpace(record.TaskID) == "" {
		fail(writer, http.StatusUnprocessableEntity, "name the task the cause is for")
		return
	}

	if !protocol.IsSearchCause(record.Cause) {
		fail(writer, http.StatusUnprocessableEntity, fmt.Sprintf(
			"%q is no cause: a cause is one of %s", record.Cause, strings.Join(protocol.SearchCauses, ", "),
		))
		return
	}

	if strings.TrimSpace(record.Evidence) == "" {
		fail(writer, http.StatusUnprocessableEntity, "say what in the runs shows the cause")
		return
	}

	s.answered(writer, func() (json.RawMessage, error) { return s.cause(request.Context(), record) })
}

func jsonObject(raw json.RawMessage) bool {
	var object map[string]json.RawMessage
	return json.Unmarshal(raw, &object) == nil && object != nil
}

func (s *Server) answered(writer http.ResponseWriter, call func() (json.RawMessage, error)) {
	answer, err := call()
	if err != nil {
		var rejected messageError
		if errors.As(err, &rejected) {
			if because, ok := rejected.ClientErrorMessage(); ok {
				fail(writer, http.StatusUnprocessableEntity, because)
				return
			}
		}

		fail(writer, http.StatusBadGateway, err.Error())
		return
	}

	writer.Header().Set("Content-Type", "application/json")
	writer.WriteHeader(http.StatusOK)
	_, _ = writer.Write(answer)
}

func (s *Server) option(next string) (string, bool) {
	for _, allowed := range s.options {
		if strings.EqualFold(next, allowed) {
			return allowed, true
		}
	}

	return "", false
}

func noteLength(note string) int {
	return len(utf16.Encode([]rune(strings.TrimSpace(note))))
}

func fail(writer http.ResponseWriter, status int, because string) {
	writer.Header().Set("Content-Type", "text/plain; charset=utf-8")
	writer.WriteHeader(status)
	_, _ = writer.Write([]byte(because + "\n"))
}
