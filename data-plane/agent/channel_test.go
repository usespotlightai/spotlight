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
	answer   func(ctx context.Context, said protocol.Remark) error
	trace    func(ctx context.Context, taskID string) (json.RawMessage, error)
	history  func(asked protocol.HistoryRequest) (json.RawMessage, error)
	recall   func(asked protocol.RecallRequest) (json.RawMessage, error)
	remember func(asked protocol.Remembering) (json.RawMessage, error)

	mu       sync.Mutex
	declared *protocol.Outcome
}

const handoverToken = "handover-token"

func serveHandover(
	options []string,
	answer func(ctx context.Context, said protocol.Remark) error,
) (*channel, error) {
	served := &channel{options: options, answer: answer}
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

func (h *channel) Declared() *protocol.Outcome {
	h.mu.Lock()
	defer h.mu.Unlock()

	return h.declared
}

func (h *channel) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if r.Header.Get("Authorization") != "Bearer "+handoverToken {
		refuse(w, http.StatusUnauthorized, "not this run's token")
		return
	}

	tools := strings.TrimSuffix(protocol.HandoverToolsPath, "/")

	switch {
	case r.Method == http.MethodGet && r.URL.Path == tools:
		shown := []protocol.ToolManifest{}
		for _, tool := range h.manifest {
			if slices.Contains(h.granted, tool.Name) {
				shown = append(shown, tool)
			}
		}
		answerJSON(w, shown)
	case strings.HasPrefix(r.URL.Path, protocol.HandoverToolsPath):
		h.tool(w, r, strings.TrimPrefix(r.URL.Path, protocol.HandoverToolsPath))
	case r.URL.Path == protocol.HandoverRemarkPath:
		h.remark(w, r)
	case r.URL.Path == protocol.HandoverTracePath:
		h.traceOf(w, r)
	case r.URL.Path == protocol.HandoverHistoryPath:
		var asked protocol.HistoryRequest
		if h.history == nil || json.NewDecoder(r.Body).Decode(&asked) != nil {
			refuse(w, http.StatusBadRequest, "unreadable history request")
			return
		}
		answered(w)(h.history(asked))
	case r.URL.Path == protocol.HandoverRecallPath:
		var asked protocol.RecallRequest
		if h.recall == nil || json.NewDecoder(r.Body).Decode(&asked) != nil {
			refuse(w, http.StatusBadRequest, "unreadable recall")
			return
		}
		answered(w)(h.recall(asked))
	case r.URL.Path == protocol.HandoverRememberPath:
		var asked protocol.Remembering
		if h.remember == nil || json.NewDecoder(r.Body).Decode(&asked) != nil {
			refuse(w, http.StatusBadRequest, "unreadable memory")
			return
		}
		answered(w)(h.remember(asked))
	default:
		h.outcome(w, r)
	}
}

func (h *channel) tool(w http.ResponseWriter, r *http.Request, name string) {
	if h.use == nil || !slices.Contains(h.granted, name) {
		refuse(w, http.StatusForbidden, fmt.Sprintf("this run was not given %q", name))
		return
	}

	input, _ := io.ReadAll(r.Body)
	if !json.Valid(input) {
		refuse(w, http.StatusBadRequest, "unreadable input: hand the tool JSON")
		return
	}

	answered, err := h.use(r.Context(), name, input)
	if err != nil {
		refuse(w, http.StatusBadGateway, err.Error())
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_, _ = w.Write(answered)
}

func (h *channel) remark(w http.ResponseWriter, r *http.Request) {
	var said protocol.Remark
	if h.answer == nil || json.NewDecoder(r.Body).Decode(&said) != nil {
		refuse(w, http.StatusBadRequest, "unreadable answer")
		return
	}

	if strings.TrimSpace(said.Handle) == "" {
		refuse(w, http.StatusUnprocessableEntity, "say which remark")
		return
	}

	if err := h.answer(r.Context(), said); err != nil {
		refuse(w, http.StatusBadGateway, err.Error())
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func (h *channel) traceOf(w http.ResponseWriter, r *http.Request) {
	var asked protocol.TraceRequest
	if h.trace == nil || json.NewDecoder(r.Body).Decode(&asked) != nil {
		refuse(w, http.StatusBadRequest, "unreadable trace request")
		return
	}

	trace, err := h.trace(r.Context(), asked.Task)
	if err != nil {
		refuse(w, http.StatusBadGateway, err.Error())
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_, _ = w.Write(trace)
}

func (h *channel) outcome(w http.ResponseWriter, r *http.Request) {
	var spoken protocol.Outcome
	if json.NewDecoder(r.Body).Decode(&spoken) != nil {
		refuse(w, http.StatusBadRequest, "unreadable handover")
		return
	}

	at := slices.IndexFunc(h.options, func(option string) bool {
		return strings.EqualFold(option, spoken.Next)
	})
	if at < 0 {
		refuse(w, http.StatusUnprocessableEntity, fmt.Sprintf(
			"%q is not one of: %s", spoken.Next, strings.Join(h.options, ", "),
		))
		return
	}

	h.mu.Lock()
	h.declared = &protocol.Outcome{Next: h.options[at], Note: spoken.Note}
	h.mu.Unlock()

	w.WriteHeader(http.StatusNoContent)
}

func answered(w http.ResponseWriter) func(json.RawMessage, error) {
	return func(answer json.RawMessage, err error) {
		if err != nil {
			refuse(w, http.StatusUnprocessableEntity, err.Error())
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

func refuse(w http.ResponseWriter, status int, because string) {
	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	w.WriteHeader(status)
	_, _ = w.Write([]byte(because + "\n"))
}
