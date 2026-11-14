package v2

import (
	"cmp"
	"context"
	"encoding/json"

	"usespotlight.ai/data-plane/protocol"
	"usespotlight.ai/data-plane/runner/internal/acp"
)

var journaled = map[string]bool{
	"session/update":             true,
	"session/request_permission": true,
}

func (c *Client) framed(line []byte, method string) {
	if method != "" && !journaled[method] {
		return
	}
	c.emit(acp.Frame(Protocol, line))
}

func (c *Client) notified(method string, params json.RawMessage) {
	switch method {
	case "session/update":
		c.updated(params)
	case "$/cancel_request":
		var cancelled struct {
			RequestID json.RawMessage `json:"requestId"`
		}
		if json.Unmarshal(params, &cancelled) == nil {
			c.stopAsking(string(cancelled.RequestID))
		}
	}
}

func (c *Client) updated(params json.RawMessage) {
	var frame struct {
		SessionID string          `json:"sessionId"`
		Update    json.RawMessage `json:"update"`
	}
	if json.Unmarshal(params, &frame) != nil {
		return
	}
	c.work.Touch()

	var kind struct {
		SessionUpdate string `json:"sessionUpdate"`
	}
	_ = json.Unmarshal(frame.Update, &kind)

	root := frame.SessionID == c.session()
	var started []protocol.Event
	repeats := false
	switch {
	case kind.SessionUpdate == "state_update" && root:
		var update state
		if json.Unmarshal(frame.Update, &update) == nil {
			c.stateChanged(update)
		}
		return
	case kind.SessionUpdate == "state_update":
		return
	case kind.SessionUpdate == "user_message" && root:
		started = c.echoed()
	case root:
		started, repeats = c.heard()
	}

	c.translating.Lock()
	var events []protocol.Event
	dropped := false
	if repeats {
		events, dropped = c.translator.unrepeated(frame.Update)
	}
	if !dropped {
		events = append(events, c.translator.translate(frame.SessionID, frame.Update)...)
	}
	c.translating.Unlock()

	c.emit(append(started, events...)...)
}

func (c *Client) requested(id json.RawMessage, method string, params json.RawMessage) {
	if method != "session/request_permission" {
		c.conn.Reject(id, "this client does not do that")
		return
	}

	asking, stop := context.WithCancel(c.life)
	c.mu.Lock()
	c.asking[string(id)] = stop
	c.mu.Unlock()

	asked, options := c.asked(params)
	go func() {
		defer c.stopAsking(string(id))
		c.permit(asking, id, asked, options)
	}()
}

func (c *Client) stopAsking(id string) {
	c.mu.Lock()
	stop := c.asking[id]
	delete(c.asking, id)
	c.mu.Unlock()

	if stop != nil {
		stop()
	}
}

func (c *Client) asked(params json.RawMessage) (acp.Asked, []acp.Option) {
	var request struct {
		SessionID string `json:"sessionId"`
		Title     string `json:"title"`
		Subject   *struct {
			Type     string    `json:"type"`
			ToolCall toolPatch `json:"toolCall"`
			Command  string    `json:"command"`
			Cwd      string    `json:"cwd"`
		} `json:"subject"`
		Options []acp.Option `json:"options"`
	}
	_ = json.Unmarshal(params, &request)

	asked := acp.Asked{SessionID: request.SessionID, Title: request.Title}
	if request.Subject == nil {
		return asked, request.Options
	}

	switch request.Subject.Type {
	case "tool_call":
		c.translating.Lock()
		call, events := c.translator.patched(c.translator.sessionOf(request.SessionID), request.Subject.ToolCall)
		c.translating.Unlock()
		c.emit(events...)

		if call != nil {
			asked.ToolCallID = call.ID
			asked.Kind = call.Kind
			asked.Title = cmp.Or(call.Title, asked.Title)
			asked.Input = call.Input
		}
	case "command":
		asked.Kind = "execute"
		asked.Title = cmp.Or(request.Subject.Command, asked.Title)
		asked.Input, _ = json.Marshal(map[string]string{"command": request.Subject.Command, "cwd": request.Subject.Cwd})
	}

	return asked, request.Options
}

func (c *Client) permit(ctx context.Context, id json.RawMessage, asked acp.Asked, options []acp.Option) {
	verdict := c.answer(ctx, asked)
	if ctx.Err() != nil {
		return
	}

	if verdict == acp.Cancel {
		_ = c.conn.Notify("session/cancel", map[string]any{"sessionId": asked.SessionID})
		c.conn.Reply(id, map[string]any{"outcome": map[string]any{"outcome": "cancelled"}})
		return
	}

	chosen := acp.Pick(options, "reject")
	if verdict == acp.Allow {
		chosen = cmp.Or(acp.Pick(options, "allow"), chosen)
	}

	if chosen == "" {
		c.conn.Reject(id, "no option this client could choose")
		return
	}

	c.conn.Reply(id, map[string]any{
		"outcome": map[string]any{"outcome": "selected", "optionId": chosen},
	})
}
