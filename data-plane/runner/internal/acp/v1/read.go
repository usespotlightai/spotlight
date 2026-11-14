package v1

import (
	"cmp"
	"encoding/json"
	"os"
	"path/filepath"
	"strings"

	"usespotlight.ai/data-plane/protocol"
	"usespotlight.ai/data-plane/runner/internal/acp"
)

func (c *Client) answered(id int, result json.RawMessage, failed *acp.ResponseError) {
	c.mu.Lock()
	turn, prompted := c.prompts[id]
	delete(c.prompts, id)
	c.mu.Unlock()

	if prompted {
		c.promptAnswered(turn, result, failed)
	}
}

func (c *Client) promptAnswered(turn int, result json.RawMessage, failed *acp.ResponseError) {
	if failed != nil {
		c.turnEnded(protocol.TurnEnded{Turn: turn, Stop: protocol.TurnStopFailed, Error: failed.Message})
		return
	}

	var out Result
	_ = json.Unmarshal(result, &out)
	c.turnEnded(protocol.TurnEnded{
		Turn: turn, Stop: StopOf(out.StopReason), Reason: out.StopReason, Usage: usageOf(out.Usage),
	})
}

func (c *Client) framed(line []byte, method string) {
	if !c.frames || c.isReplaying() || (method != "" && !journaled[method]) {
		return
	}
	c.emit(acp.Frame(Protocol, line))
}

var journaled = map[string]bool{
	"session/update":             true,
	"session/request_permission": true,
}

func (c *Client) isReplaying() bool {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.replaying
}

func (c *Client) notified(method string, params json.RawMessage) {
	if c.isReplaying() {
		return
	}

	if method != "session/update" {
		return
	}
	c.work.Touch()

	c.mu.Lock()
	c.heard++
	c.mu.Unlock()

	c.translating.Lock()
	events := c.translator.translate(params)
	c.translating.Unlock()

	c.emit(events...)
}

func (c *Client) requested(id json.RawMessage, method string, params json.RawMessage) {
	switch method {
	case "session/request_permission":
		go c.permit(id, params)
	case "fs/read_text_file":
		c.readFile(id, params)
	case "fs/write_text_file":
		c.writeFile(id, params)
	default:
		c.reject(id, "this client does not do that")
	}
}

func (c *Client) permit(id json.RawMessage, params json.RawMessage) {
	var asked struct {
		SessionID string `json:"sessionId"`
		ToolCall  struct {
			ToolCallID string          `json:"toolCallId"`
			Kind       string          `json:"kind"`
			Title      string          `json:"title"`
			RawInput   json.RawMessage `json:"rawInput"`
		} `json:"toolCall"`
		Options []acp.Option `json:"options"`
	}
	_ = json.Unmarshal(params, &asked)

	input := asked.ToolCall.RawInput
	if string(input) == "null" {
		input = nil
	}

	verdict := c.answer(c.life, acp.Asked{
		SessionID:  asked.SessionID,
		ToolCallID: asked.ToolCall.ToolCallID,
		Kind:       asked.ToolCall.Kind,
		Title:      asked.ToolCall.Title,
		Input:      input,
	})

	if verdict == acp.Cancel {
		_ = c.conn.Notify("session/cancel", map[string]any{"sessionId": asked.SessionID})
		c.reply(id, map[string]any{"outcome": map[string]any{"outcome": "cancelled"}})
		return
	}

	chosen := acp.Pick(asked.Options, "reject")
	if verdict == acp.Allow {
		chosen = cmp.Or(acp.Pick(asked.Options, "allow"), chosen)
	}

	if chosen == "" {
		c.reject(id, "no option this client could choose")
		return
	}

	c.reply(id, map[string]any{
		"outcome": map[string]any{"outcome": "selected", "optionId": chosen},
	})
}

func (c *Client) within(path string) (string, bool) {
	full := path
	if !filepath.IsAbs(full) {
		full = filepath.Join(c.root, full)
	}
	full = filepath.Clean(full)

	root := filepath.Clean(c.root)
	if full != root && !strings.HasPrefix(full, root+string(filepath.Separator)) {
		return "", false
	}

	return full, true
}

func (c *Client) readFile(id json.RawMessage, params json.RawMessage) {
	var request struct {
		Path string `json:"path"`
	}
	_ = json.Unmarshal(params, &request)

	full, ok := c.within(request.Path)
	if !ok {
		c.reject(id, "outside the workspace")
		return
	}

	content, err := os.ReadFile(full)
	if err != nil {
		c.reject(id, err.Error())
		return
	}

	c.reply(id, map[string]any{"content": string(content)})
}

func (c *Client) writeFile(id json.RawMessage, params json.RawMessage) {
	var request struct {
		Path    string `json:"path"`
		Content string `json:"content"`
	}
	_ = json.Unmarshal(params, &request)

	full, ok := c.within(request.Path)
	if !ok {
		c.reject(id, "outside the workspace")
		return
	}

	if err := os.MkdirAll(filepath.Dir(full), 0o755); err != nil {
		c.reject(id, err.Error())
		return
	}
	if err := os.WriteFile(full, []byte(request.Content), 0o644); err != nil {
		c.reject(id, err.Error())
		return
	}

	c.reply(id, map[string]any{})
}

func (c *Client) reply(id json.RawMessage, result any) {
	c.conn.Reply(id, result)
}

func (c *Client) reject(id json.RawMessage, because string) {
	c.conn.Reject(id, because)
}
