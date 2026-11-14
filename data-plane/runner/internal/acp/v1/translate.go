package v1

import (
	"encoding/json"
	"strconv"
	"strings"

	"usespotlight.ai/data-plane/protocol"
	"usespotlight.ai/data-plane/runner/internal/acp"
)

const bridgeServer = "mcp__acp__"

var bridgeTools = map[string]bool{
	"Read": true, "Write": true, "Edit": true, "MultiEdit": true,
	"Bash": true, "BashOutput": true, "KillShell": true,
}

type notification struct {
	SessionID string `json:"sessionId"`
	Update    struct {
		SessionUpdate string `json:"sessionUpdate"`
		Meta          struct {
			ClaudeCode struct {
				ToolName string `json:"toolName"`
			} `json:"claudeCode"`
		} `json:"_meta"`
		Content            json.RawMessage      `json:"content"`
		ToolCallID         string               `json:"toolCallId"`
		Title              *string              `json:"title"`
		Kind               *string              `json:"kind"`
		Status             *string              `json:"status"`
		RawInput           json.RawMessage      `json:"rawInput"`
		RawOutput          json.RawMessage      `json:"rawOutput"`
		Locations          *[]location          `json:"locations"`
		Entries            []protocol.PlanEntry `json:"entries"`
		Used               *int                 `json:"used"`
		Size               *int                 `json:"size"`
		Cost               *protocol.Cost       `json:"cost"`
		SessionID          string               `json:"sessionId"`
		Description        string               `json:"description"`
		State              *childState          `json:"state"`
		SenderSessionID    string               `json:"senderSessionId"`
		RecipientSessionID string               `json:"recipientSessionId"`
	} `json:"update"`
}

type location struct {
	Path string `json:"path"`
	Line *int   `json:"line"`
}

type childState struct {
	State      string  `json:"state"`
	StopReason *string `json:"stopReason"`
}

type block struct {
	Type    string  `json:"type"`
	Text    string  `json:"text"`
	Path    string  `json:"path"`
	OldText *string `json:"oldText"`
	NewText *string `json:"newText"`
	Content struct {
		Text string `json:"text"`
	} `json:"content"`
}

type speech struct {
	role protocol.MessageRole
	id   string
}

type translator struct {
	root     string
	tools    map[string]*protocol.ToolChanged
	speaking map[string]speech
	messages int
}

func newTranslator() *translator {
	return &translator{tools: map[string]*protocol.ToolChanged{}, speaking: map[string]speech{}}
}

func (t *translator) opened(root string) {
	t.root = root
}

func (t *translator) turned() {
	clear(t.speaking)
}

func (t *translator) sessionOf(id string) string {
	if id == t.root {
		return ""
	}
	return id
}

func (t *translator) translate(params json.RawMessage) []protocol.Event {
	var frame notification
	if json.Unmarshal(params, &frame) != nil {
		return nil
	}

	session := t.sessionOf(frame.SessionID)
	update := frame.Update

	switch update.SessionUpdate {
	case "agent_message_chunk":
		return t.said(session, protocol.MessageFromAgent, update.Content)
	case "agent_thought_chunk":
		return t.said(session, protocol.MessageThought, update.Content)
	case "user_message_chunk":
		return t.said(session, protocol.MessageFromUser, update.Content)
	case "tool_call", "tool_call_update":
		return t.called(session, frame)
	case "plan":
		delete(t.speaking, session)
		entries := update.Entries
		if entries == nil {
			entries = []protocol.PlanEntry{}
		}
		return []protocol.Event{protocol.HarnessEvent(protocol.EventPlanChanged, protocol.PlanChanged{Session: session, Entries: entries})}
	case "usage_update":
		if update.Used == nil || update.Size == nil {
			return nil
		}
		return []protocol.Event{protocol.HarnessEvent(protocol.EventContextChanged, protocol.ContextChanged{
			Session: session, Used: *update.Used, Size: *update.Size, Cost: update.Cost,
		})}
	case "subagent_update":
		if update.SessionID == "" {
			return nil
		}
		delete(t.speaking, session)
		changed := protocol.ChildChanged{
			Session:     session,
			Child:       update.SessionID,
			Title:       stringOf(update.Title),
			Description: update.Description,
		}
		if update.State != nil {
			changed.State, changed.Stop = childStateOf(*update.State)
		}
		return []protocol.Event{protocol.HarnessEvent(protocol.EventChildChanged, changed)}
	case "session_message":
		text := textIn(update.Content)
		if text == "" {
			return nil
		}
		return []protocol.Event{protocol.HarnessEvent(protocol.EventChildMessage, protocol.ChildMessage{
			Session: session,
			From:    t.sessionOf(update.SenderSessionID),
			To:      t.sessionOf(update.RecipientSessionID),
			Text:    text,
		})}
	default:
		return nil
	}
}

func (t *translator) said(session string, role protocol.MessageRole, content json.RawMessage) []protocol.Event {
	var one block
	if json.Unmarshal(content, &one) != nil || one.Text == "" {
		return nil
	}

	current, speaking := t.speaking[session]
	if !speaking || current.role != role {
		t.messages++
		current = speech{role: role, id: "m" + strconv.Itoa(t.messages)}
		t.speaking[session] = current
	}

	return []protocol.Event{protocol.HarnessEvent(protocol.EventMessage, protocol.AgentMessage{
		Session: session, ID: current.id, Role: role, Text: one.Text,
	})}
}

func (t *translator) called(session string, frame notification) []protocol.Event {
	update := frame.Update
	if update.ToolCallID == "" {
		return nil
	}

	key := session + "\x00" + update.ToolCallID
	call, known := t.tools[key]
	if !known && update.SessionUpdate == "tool_call_update" {
		return nil
	}
	if !known {
		delete(t.speaking, session)
		call = &protocol.ToolChanged{Session: session, ID: update.ToolCallID, Title: "a tool"}
		t.tools[key] = call
	}

	if name := nameOf(update.Meta.ClaudeCode.ToolName); name != "" {
		call.Name = name
	}
	if update.Title != nil {
		call.Title = *update.Title
	}
	if update.Kind != nil {
		call.Kind = *update.Kind
	}
	if update.Status != nil {
		call.Status = protocol.ToolStatus(*update.Status)
	}
	if acp.Present(update.RawInput) {
		call.Input = update.RawInput
	}
	if acp.Present(update.RawOutput) {
		call.Output = update.RawOutput
	}
	if update.Locations != nil {
		call.Locations = locationsOf(*update.Locations)
	}

	blocks := blocksOf(update.Content)
	if files := filesIn(blocks); len(files) > 0 {
		call.Files = files
	}

	events := []protocol.Event{protocol.HarnessEvent(protocol.EventToolChanged, *call)}
	if text := toolTextIn(blocks); text != "" {
		events = append(events, protocol.HarnessEvent(protocol.EventToolOutput, protocol.ToolOutput{
			Session: session, ID: call.ID, Text: text, Replace: true,
		}))
	}

	return events
}

func nameOf(named string) string {
	named = strings.TrimSpace(named)
	if tool, bridged := strings.CutPrefix(named, bridgeServer); bridged && bridgeTools[tool] {
		return tool
	}
	return named
}

func childStateOf(state childState) (protocol.SessionStateName, protocol.TurnStop) {
	switch state.State {
	case "running":
		return protocol.SessionRunning, ""
	case "requires_action":
		return protocol.SessionNeedsAction, ""
	case "idle":
		if state.StopReason == nil {
			return protocol.SessionIdle, ""
		}
		return protocol.SessionIdle, StopOf(*state.StopReason)
	default:
		return "", ""
	}
}

func StopOf(reason string) protocol.TurnStop {
	switch reason {
	case "end_turn":
		return protocol.TurnStopEnded
	case "max_tokens", "max_turn_requests":
		return protocol.TurnStopCutShort
	case "refusal":
		return protocol.TurnStopRefused
	case "cancelled":
		return protocol.TurnStopCancelled
	default:
		return protocol.TurnStopFailed
	}
}

func blocksOf(content json.RawMessage) []block {
	var blocks []block
	if json.Unmarshal(content, &blocks) == nil {
		return blocks
	}
	var one block
	if json.Unmarshal(content, &one) == nil && one.Text != "" {
		return []block{{Type: "content", Content: struct {
			Text string `json:"text"`
		}{Text: one.Text}}}
	}
	return nil
}

func filesIn(blocks []block) []protocol.FileChange {
	var files []protocol.FileChange
	for _, each := range blocks {
		if each.Type != "diff" || each.Path == "" {
			continue
		}
		operation := protocol.FileChanged
		if each.OldText == nil {
			operation = protocol.FileCreated
		}
		files = append(files, protocol.FileChange{
			Path: each.Path, Operation: operation, Before: each.OldText, After: each.NewText,
		})
	}
	return files
}

func toolTextIn(blocks []block) string {
	texts := make([]string, 0, len(blocks))
	for _, each := range blocks {
		if each.Content.Text != "" {
			texts = append(texts, each.Content.Text)
		}
	}
	return strings.TrimSpace(strings.Join(texts, "\n"))
}

func textIn(content json.RawMessage) string {
	var blocks []block
	if json.Unmarshal(content, &blocks) != nil {
		return ""
	}
	texts := make([]string, 0, len(blocks))
	for _, each := range blocks {
		if each.Text != "" {
			texts = append(texts, each.Text)
		}
	}
	return strings.TrimSpace(strings.Join(texts, "\n"))
}

func locationsOf(locations []location) []protocol.ToolLocation {
	found := make([]protocol.ToolLocation, 0, len(locations))
	for _, each := range locations {
		if each.Path != "" {
			found = append(found, protocol.ToolLocation{Path: each.Path, Line: each.Line})
		}
	}
	return found
}

func stringOf(value *string) string {
	if value == nil {
		return ""
	}
	return *value
}
