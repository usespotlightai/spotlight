package agent

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"slices"
	"strings"
	"sync"

	"usespotlight.ai/data-plane/protocol"
)

type channel struct {
	server   *httptest.Server
	options  []string
	granted  []string
	manifest []protocol.ToolManifest
	use      func(ctx context.Context, name string, input json.RawMessage) (json.RawMessage, error)
	reply    func(ctx context.Context, reply protocol.ReviewCommentReply) error
	trace    func(ctx context.Context, taskID string) (json.RawMessage, error)
	history  func(asked protocol.HistoryRequest) (json.RawMessage, error)
	recall   func(asked protocol.RecallRequest) (json.RawMessage, error)
	remember func(asked protocol.Remembering) (json.RawMessage, error)
	propose  func(asked protocol.CandidateProposal) (int, string)
	cause    func(asked protocol.CauseRecord) (int, string)

	mu       sync.Mutex
	handover *protocol.Handover
}

const handoverToken = "handover-token"

func serveHandover(
	options []string,
	reply func(ctx context.Context, reply protocol.ReviewCommentReply) error,
) (*channel, error) {
	served := &channel{options: options, reply: reply}
	served.server = httptest.NewServer(served)

	return served, nil
}

func (h *channel) URL() string { return h.server.URL + "/" }

func (h *channel) Token() string { return handoverToken }

func (h *channel) Close() error {
	h.server.Close()
	return nil
}

func (h *channel) Tools(
	granted []string,
	use func(ctx context.Context, name string, input json.RawMessage) (json.RawMessage, error),
) {
	h.granted = granted
	h.use = use
}

func (h *channel) Manifest(tools []protocol.ToolManifest) { h.manifest = tools }

func (h *channel) Traces(trace func(ctx context.Context, taskID string) (json.RawMessage, error)) {
	h.trace = trace
}

func (h *channel) Histories(history func(asked protocol.HistoryRequest) (json.RawMessage, error)) {
	h.history = history
}

func (h *channel) Memories(
	recall func(asked protocol.RecallRequest) (json.RawMessage, error),
	remember func(asked protocol.Remembering) (json.RawMessage, error),
) {
	h.recall = recall
	h.remember = remember
}

func (h *channel) Candidates(propose func(asked protocol.CandidateProposal) (int, string)) {
	h.propose = propose
}

func (h *channel) Causes(cause func(asked protocol.CauseRecord) (int, string)) {
	h.cause = cause
}

func (h *channel) Handover() *protocol.Handover {
	h.mu.Lock()
	defer h.mu.Unlock()

	return h.handover
}

func (h *channel) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if r.Header.Get("Authorization") != "Bearer "+handoverToken {
		fail(w, http.StatusUnauthorized, "not this run's token")
		return
	}

	tools := strings.TrimSuffix(protocol.AgentAPIToolsPath, "/")

	switch {
	case r.Method == http.MethodGet && r.URL.Path == tools:
		shown := []protocol.ToolManifest{}
		for _, tool := range h.manifest {
			if slices.Contains(h.granted, tool.Name) {
				shown = append(shown, tool)
			}
		}
		answerJSON(w, shown)
	case strings.HasPrefix(r.URL.Path, protocol.AgentAPIToolsPath):
		h.tool(w, r, strings.TrimPrefix(r.URL.Path, protocol.AgentAPIToolsPath))
	case r.URL.Path == protocol.AgentAPIReviewCommentReplyPath:
		h.replyToReviewComment(w, r)
	case r.URL.Path == protocol.AgentAPITracePath:
		h.traceOf(w, r)
	case r.URL.Path == protocol.AgentAPIHistoryPath:
		var asked protocol.HistoryRequest
		if h.history == nil || json.NewDecoder(r.Body).Decode(&asked) != nil {
			fail(w, http.StatusBadRequest, "unreadable history request")
			return
		}
		answered(w)(h.history(asked))
	case r.URL.Path == protocol.AgentAPIRecallPath:
		var asked protocol.RecallRequest
		if h.recall == nil || json.NewDecoder(r.Body).Decode(&asked) != nil {
			fail(w, http.StatusBadRequest, "unreadable recall")
			return
		}
		answered(w)(h.recall(asked))
	case r.URL.Path == protocol.AgentAPIRememberPath:
		var asked protocol.Remembering
		if h.remember == nil || json.NewDecoder(r.Body).Decode(&asked) != nil {
			fail(w, http.StatusBadRequest, "unreadable memory")
			return
		}
		answered(w)(h.remember(asked))
	case r.URL.Path == protocol.AgentAPICandidatePath:
		if h.propose == nil {
			fail(w, http.StatusNotImplemented, "this run cannot propose a candidate: only a search's runs do")
			return
		}
		var asked protocol.CandidateProposal
		if json.NewDecoder(r.Body).Decode(&asked) != nil {
			fail(w, http.StatusBadRequest, "unreadable candidate")
			return
		}
		status, body := h.propose(asked)
		if strings.HasPrefix(body, "{") {
			w.Header().Set("Content-Type", "application/json")
		}
		w.WriteHeader(status)
		_, _ = w.Write([]byte(body))
	case r.URL.Path == protocol.AgentAPICausePath:
		if h.cause == nil {
			fail(w, http.StatusNotImplemented, "this run cannot record a cause: only a search's runs do")
			return
		}
		var asked protocol.CauseRecord
		if json.NewDecoder(r.Body).Decode(&asked) != nil {
			fail(w, http.StatusBadRequest, "unreadable cause")
			return
		}
		status, body := h.cause(asked)
		w.WriteHeader(status)
		_, _ = w.Write([]byte(body))
	default:
		h.recordHandover(w, r)
	}
}

func (h *channel) tool(w http.ResponseWriter, r *http.Request, name string) {
	if h.use == nil || !slices.Contains(h.granted, name) {
		fail(w, http.StatusForbidden, fmt.Sprintf("this run was not given %q", name))
		return
	}

	input, _ := io.ReadAll(r.Body)
	if !json.Valid(input) {
		fail(w, http.StatusBadRequest, "unreadable input: hand the tool JSON")
		return
	}

	answered, err := h.use(r.Context(), name, input)
	if err != nil {
		fail(w, http.StatusBadGateway, err.Error())
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_, _ = w.Write(answered)
}

func (h *channel) replyToReviewComment(w http.ResponseWriter, r *http.Request) {
	var reply protocol.ReviewCommentReply
	if h.reply == nil || json.NewDecoder(r.Body).Decode(&reply) != nil {
		fail(w, http.StatusBadRequest, "unreadable reply")
		return
	}

	if strings.TrimSpace(reply.Handle) == "" {
		fail(w, http.StatusUnprocessableEntity, "name the review comment")
		return
	}

	if err := h.reply(r.Context(), reply); err != nil {
		fail(w, http.StatusBadGateway, err.Error())
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func (h *channel) traceOf(w http.ResponseWriter, r *http.Request) {
	var asked protocol.TraceRequest
	if h.trace == nil || json.NewDecoder(r.Body).Decode(&asked) != nil {
		fail(w, http.StatusBadRequest, "unreadable trace request")
		return
	}

	trace, err := h.trace(r.Context(), asked.Task)
	if err != nil {
		fail(w, http.StatusBadGateway, err.Error())
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_, _ = w.Write(trace)
}

func (h *channel) recordHandover(w http.ResponseWriter, r *http.Request) {
	var handover protocol.Handover
	if json.NewDecoder(r.Body).Decode(&handover) != nil {
		fail(w, http.StatusBadRequest, "unreadable handover")
		return
	}

	at := slices.IndexFunc(h.options, func(option string) bool {
		return strings.EqualFold(option, handover.Next)
	})
	if at < 0 {
		fail(w, http.StatusUnprocessableEntity, fmt.Sprintf(
			"%q is not one of: %s", handover.Next, strings.Join(h.options, ", "),
		))
		return
	}

	h.mu.Lock()
	h.handover = &protocol.Handover{Next: h.options[at], Note: handover.Note}
	h.mu.Unlock()

	w.WriteHeader(http.StatusNoContent)
}

func answered(w http.ResponseWriter) func(json.RawMessage, error) {
	return func(answer json.RawMessage, err error) {
		if err != nil {
			fail(w, http.StatusUnprocessableEntity, err.Error())
			return
		}

		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write(answer)
	}
}

func answerJSON(w http.ResponseWriter, body any) {
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(body)
}

func fail(w http.ResponseWriter, status int, because string) {
	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	w.WriteHeader(status)
	_, _ = w.Write([]byte(because + "\n"))
}
