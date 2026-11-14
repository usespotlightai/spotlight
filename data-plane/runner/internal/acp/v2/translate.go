package v2

import (
	"cmp"
	"encoding/base64"
	"encoding/json"
	"slices"
	"strings"
	"unicode/utf8"

	"usespotlight.ai/data-plane/protocol"
	"usespotlight.ai/data-plane/runner/internal/acp"
)

type update struct {
	SessionUpdate      string          `json:"sessionUpdate"`
	MessageID          string          `json:"messageId"`
	Content            json.RawMessage `json:"content"`
	ToolCallID         string          `json:"toolCallId"`
	TerminalID         string          `json:"terminalId"`
	Command            *string         `json:"command"`
	Output             *encoded        `json:"output"`
	Data               string          `json:"data"`
	Plan               *plan           `json:"plan"`
	Used               *int            `json:"used"`
	Size               *int            `json:"size"`
	Cost               *protocol.Cost  `json:"cost"`
	SessionID          string          `json:"sessionId"`
	Title              *string         `json:"title"`
	Description        *string         `json:"description"`
	State              *state          `json:"state"`
	SenderSessionID    string          `json:"senderSessionId"`
	RecipientSessionID string          `json:"recipientSessionId"`
}

type encoded struct {
	Data string `json:"data"`
}

type plan struct {
	Type    string               `json:"type"`
	Entries []protocol.PlanEntry `json:"entries"`
}

type state struct {
	State      string          `json:"state"`
	StopReason *string         `json:"stopReason"`
	Error      *failure        `json:"error"`
	Usage      json.RawMessage `json:"usage"`
	Background *[]background   `json:"background"`
}

type failure struct {
	Message string `json:"message"`
}

type background struct {
	Type       string `json:"type"`
	TerminalID string `json:"terminalId"`
	ToolCallID string `json:"toolCallId"`
	SessionID  string `json:"sessionId"`
}

type toolPatch struct {
	ToolCallID string           `json:"toolCallId"`
	Name       *string          `json:"name"`
	Title      *string          `json:"title"`
	Kind       *string          `json:"kind"`
	Status     *string          `json:"status"`
	Content    *json.RawMessage `json:"content"`
	Locations  *[]location      `json:"locations"`
	RawInput   json.RawMessage  `json:"rawInput"`
	RawOutput  json.RawMessage  `json:"rawOutput"`
}

type location struct {
	Path string `json:"path"`
	Line *int   `json:"line"`
}

type block struct {
	Type       string `json:"type"`
	Text       string `json:"text"`
	TerminalID string `json:"terminalId"`
	Content    struct {
		Type string `json:"type"`
		Text string `json:"text"`
	} `json:"content"`
	Changes []struct {
		Operation string `json:"operation"`
		Path      string `json:"path"`
		OldPath   string `json:"oldPath"`
	} `json:"changes"`
	Patch *struct {
		Text string `json:"text"`
	} `json:"patch"`
}

type terminal struct {
	call    string
	command string
	output  string
	split   []byte
}

type child struct {
	title       string
	description string
}

type translator struct {
	root      string
	tools     map[string]*protocol.ToolChanged
	terminals map[string]*terminal
	children  map[string]*child
	last      said
	held      said
}

type said struct {
	id   string
	text string
}

func newTranslator() *translator {
	return &translator{
		tools:     map[string]*protocol.ToolChanged{},
		terminals: map[string]*terminal{},
		children:  map[string]*child{},
	}
}

func (t *translator) opened(root string) {
	t.root = root
}

func (t *translator) sessionOf(id string) string {
	if id == t.root {
		return ""
	}
	return id
}

func (t *translator) translate(sessionID string, raw json.RawMessage) []protocol.Event {
	var u update
	if json.Unmarshal(raw, &u) != nil {
		return nil
	}

	session := t.sessionOf(sessionID)

	switch u.SessionUpdate {
	case "agent_message_chunk":
		t.remember(session, u.MessageID, textOf(u.Content), false)
		return saying(session, u.MessageID, protocol.MessageFromAgent, textOf(u.Content), false)
	case "agent_message":
		t.remember(session, u.MessageID, textIn(u.Content), true)
		return saying(session, u.MessageID, protocol.MessageFromAgent, textIn(u.Content), true)
	case "agent_thought_chunk":
		return saying(session, u.MessageID, protocol.MessageThought, textOf(u.Content), false)
	case "agent_thought":
		return saying(session, u.MessageID, protocol.MessageThought, textIn(u.Content), true)
	case "user_message_chunk":
		return saying(session, u.MessageID, protocol.MessageFromUser, textOf(u.Content), false)
	case "user_message":
		return saying(session, u.MessageID, protocol.MessageFromUser, textIn(u.Content), true)
	case "tool_call_update":
		var patch toolPatch
		if json.Unmarshal(raw, &patch) != nil {
			return nil
		}
		_, events := t.patched(session, patch)
		return events
	case "tool_call_content_chunk":
		return t.toolChunk(session, u.ToolCallID, u.Content)
	case "terminal_update":
		return t.terminalUpdated(session, u)
	case "terminal_output_chunk":
		return t.printed(session, u.TerminalID, decoded(u.Data), false)
	case "plan_update":
		if u.Plan == nil || u.Plan.Type != "items" {
			return nil
		}
		return planned(session, u.Plan.Entries)
	case "plan_removed":
		return planned(session, nil)
	case "usage_update":
		if u.Used == nil || u.Size == nil {
			return nil
		}
		return []protocol.Event{protocol.HarnessEvent(protocol.EventContextChanged, protocol.ContextChanged{
			Session: session, Used: *u.Used, Size: *u.Size, Cost: u.Cost,
		})}
	case "subagent_update":
		return t.subagent(session, u)
	case "session_message":
		if u.SenderSessionID != sessionID {
			return nil
		}
		text := textIn(u.Content)
		if text == "" {
			return nil
		}
		return []protocol.Event{protocol.HarnessEvent(protocol.EventChildMessage, protocol.ChildMessage{
			Session: session,
			From:    t.sessionOf(u.SenderSessionID),
			To:      t.sessionOf(u.RecipientSessionID),
			Text:    text,
		})}
	default:
		return nil
	}
}

func (t *translator) remember(session, id, text string, replace bool) {
	if session != "" || id == "" {
		return
	}
	if replace || id != t.last.id {
		t.last = said{id: id, text: text}
		return
	}
	t.last.text += text
}

func (t *translator) unrepeated(raw json.RawMessage) ([]protocol.Event, bool) {
	var u update
	if json.Unmarshal(raw, &u) != nil || u.MessageID == "" || u.MessageID == t.last.id {
		return nil, false
	}

	switch u.SessionUpdate {
	case "agent_message":
		return nil, textIn(u.Content) == t.last.text
	case "agent_message_chunk":
	default:
		return nil, false
	}

	sofar := textOf(u.Content)
	if t.held.id == u.MessageID {
		sofar = t.held.text + sofar
	}
	if strings.HasPrefix(t.last.text, sofar) {
		t.held = said{id: u.MessageID, text: sofar}
		return nil, true
	}

	held := t.held
	t.held = said{}
	if held.id != u.MessageID || held.text == "" {
		return nil, false
	}
	t.remember("", held.id, held.text, false)
	return saying("", held.id, protocol.MessageFromAgent, held.text, false), false
}

func saying(session, id string, role protocol.MessageRole, text string, replace bool) []protocol.Event {
	if id == "" || (text == "" && !replace) {
		return nil
	}
	return []protocol.Event{protocol.HarnessEvent(protocol.EventMessage, protocol.AgentMessage{
		Session: session, ID: id, Role: role, Text: text, Replace: replace,
	})}
}

func planned(session string, entries []protocol.PlanEntry) []protocol.Event {
	if entries == nil {
		entries = []protocol.PlanEntry{}
	}
	return []protocol.Event{protocol.HarnessEvent(protocol.EventPlanChanged, protocol.PlanChanged{Session: session, Entries: entries})}
}

func (t *translator) patched(session string, patch toolPatch) (*protocol.ToolChanged, []protocol.Event) {
	if patch.ToolCallID == "" {
		return nil, nil
	}

	key := session + "\x00" + patch.ToolCallID
	call, known := t.tools[key]
	if !known {
		call = &protocol.ToolChanged{Session: session, ID: patch.ToolCallID, Kind: "other", Status: protocol.ToolPending}
		t.tools[key] = call
	}

	if patch.Name != nil {
		call.Name = *patch.Name
	}
	if patch.Title != nil {
		call.Title = *patch.Title
	}
	if patch.Kind != nil {
		call.Kind = cmp.Or(*patch.Kind, "other")
	}
	if patch.Status != nil {
		call.Status = protocol.ToolStatus(cmp.Or(*patch.Status, string(protocol.ToolPending)))
	}
	if acp.Present(patch.RawInput) {
		call.Input = patch.RawInput
	}
	if acp.Present(patch.RawOutput) {
		call.Output = patch.RawOutput
	}
	if patch.Locations != nil {
		call.Locations = locationsOf(*patch.Locations)
	}

	var output []protocol.Event
	if patch.Content != nil {
		blocks := blocksOf(*patch.Content)
		call.Files, call.Patch = filesIn(blocks)
		t.linkTerminals(session, call.ID, blocks)
		if text := toolTextIn(blocks); text != "" {
			output = append(output, protocol.HarnessEvent(protocol.EventToolOutput, protocol.ToolOutput{
				Session: session, ID: call.ID, Text: text, Replace: true,
			}))
		}
		output = append(output, t.linkedOutput(session, blocks)...)
	}

	events := []protocol.Event{protocol.HarnessEvent(protocol.EventToolChanged, t.shown(*call))}
	shown := *call
	if call.Status == protocol.ToolCompleted || call.Status == protocol.ToolFailed {
		call.Input, call.Output, call.Files, call.Patch = nil, nil, nil, ""
	}
	return &shown, append(events, output...)
}

func (t *translator) shown(call protocol.ToolChanged) protocol.ToolChanged {
	if call.Title == "" {
		call.Title = cmp.Or(call.Name, "a tool")
	}
	return call
}

func (t *translator) toolChunk(session, callID string, content json.RawMessage) []protocol.Event {
	call, known := t.tools[session+"\x00"+callID]
	if !known {
		return nil
	}

	var one block
	if json.Unmarshal(content, &one) != nil {
		return nil
	}
	blocks := []block{one}

	switch one.Type {
	case "diff":
		files, patch := filesIn(blocks)
		call.Files = append(call.Files, files...)
		if patch != "" {
			call.Patch = strings.TrimSuffix(call.Patch+"\n"+patch, "\n")
		}
		return []protocol.Event{protocol.HarnessEvent(protocol.EventToolChanged, t.shown(*call))}
	case "terminal":
		t.linkTerminals(session, call.ID, blocks)
		return t.linkedOutput(session, blocks)
	default:
		text := toolTextIn(blocks)
		if text == "" {
			return nil
		}
		return []protocol.Event{protocol.HarnessEvent(protocol.EventToolOutput, protocol.ToolOutput{
			Session: session, ID: call.ID, Text: text,
		})}
	}
}

func (t *translator) terminalOf(session, id string) *terminal {
	key := session + "\x00" + id
	found, known := t.terminals[key]
	if !known {
		found = &terminal{}
		t.terminals[key] = found
	}
	return found
}

func (t *translator) linkTerminals(session, callID string, blocks []block) {
	for _, each := range blocks {
		if each.Type == "terminal" && each.TerminalID != "" {
			t.terminalOf(session, each.TerminalID).call = callID
		}
	}
}

func (t *translator) linkedOutput(session string, blocks []block) []protocol.Event {
	var events []protocol.Event
	for _, each := range blocks {
		if each.Type != "terminal" || each.TerminalID == "" {
			continue
		}
		term := t.terminalOf(session, each.TerminalID)
		if term.output != "" {
			events = append(events, protocol.HarnessEvent(protocol.EventToolOutput, protocol.ToolOutput{
				Session: session, ID: term.call, Text: term.output, Replace: true,
			}))
			term.output = ""
		}
	}
	return events
}

func (t *translator) terminalUpdated(session string, u update) []protocol.Event {
	if u.TerminalID == "" {
		return nil
	}
	term := t.terminalOf(session, u.TerminalID)
	if u.Command != nil {
		term.command = *u.Command
	}
	if u.Output == nil {
		return nil
	}
	return t.printed(session, u.TerminalID, decoded(u.Output.Data), true)
}

func (t *translator) printed(session, terminalID string, raw []byte, replace bool) []protocol.Event {
	if terminalID == "" {
		return nil
	}
	term := t.terminalOf(session, terminalID)

	var text string
	if replace {
		text, term.split = string(raw), nil
	} else {
		text, term.split = whole(append(term.split, raw...))
	}

	if term.call == "" {
		if replace {
			term.output = text
		} else {
			term.output += text
		}
		return nil
	}
	if text == "" && !replace {
		return nil
	}
	return []protocol.Event{protocol.HarnessEvent(protocol.EventToolOutput, protocol.ToolOutput{
		Session: session, ID: term.call, Text: text, Replace: replace,
	})}
}

func (t *translator) subagent(session string, u update) []protocol.Event {
	if u.SessionID == "" {
		return nil
	}

	known, seen := t.children[u.SessionID]
	if !seen {
		known = &child{}
		t.children[u.SessionID] = known
	}
	if u.Title != nil {
		known.title = *u.Title
	}
	if u.Description != nil {
		known.description = *u.Description
	}

	changed := protocol.ChildChanged{
		Session:     session,
		Child:       u.SessionID,
		Title:       known.title,
		Description: known.description,
	}
	if u.State != nil {
		changed.State, changed.Stop = stateOf(*u.State)
	}
	return []protocol.Event{protocol.HarnessEvent(protocol.EventChildChanged, changed)}
}

func (t *translator) backgroundOf(items []background) []protocol.BackgroundTask {
	tasks := make([]protocol.BackgroundTask, 0, len(items))
	for _, item := range items {
		switch item.Type {
		case "terminal":
			term := t.terminalOf("", item.TerminalID)
			tasks = append(tasks, protocol.BackgroundTask{
				ID: item.TerminalID, Kind: protocol.BackgroundCommand, Description: term.command,
			})
		case "subagent":
			known := t.children[item.SessionID]
			description := ""
			if known != nil {
				description = cmp.Or(known.title, known.description)
			}
			tasks = append(tasks, protocol.BackgroundTask{
				ID: item.SessionID, Kind: protocol.BackgroundSubagent, Description: description,
			})
		case "tool_call":
			title := ""
			if call := t.tools["\x00"+item.ToolCallID]; call != nil {
				title = t.shown(*call).Title
			}
			tasks = append(tasks, protocol.BackgroundTask{
				ID: item.ToolCallID, Kind: protocol.BackgroundOther, Description: title,
			})
		}
	}
	return tasks
}

func stateOf(s state) (protocol.SessionStateName, protocol.TurnStop) {
	switch s.State {
	case "running":
		return protocol.SessionRunning, ""
	case "requires_action":
		return protocol.SessionNeedsAction, ""
	case "idle":
		if s.StopReason == nil {
			return protocol.SessionIdle, ""
		}
		return protocol.SessionIdle, StopOf(*s.StopReason)
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
	_ = json.Unmarshal(content, &blocks)
	return blocks
}

func filesIn(blocks []block) ([]protocol.FileChange, string) {
	var files []protocol.FileChange
	var patches []string
	for _, each := range blocks {
		if each.Type != "diff" {
			continue
		}
		for _, change := range each.Changes {
			file := protocol.FileChange{Path: change.Path, OldPath: change.OldPath, Operation: operationOf(change.Operation)}
			if file.Path != "" {
				files = append(files, file)
			}
		}
		if each.Patch != nil && each.Patch.Text != "" {
			patches = append(patches, each.Patch.Text)
		}
	}
	patch := strings.Join(patches, "\n")
	withSides(files, patch)
	return files, patch
}

func operationOf(operation string) protocol.FileOperation {
	switch operation {
	case "add", "copy":
		return protocol.FileCreated
	case "modify":
		return protocol.FileChanged
	case "delete":
		return protocol.FileDeleted
	case "move":
		return protocol.FileMoved
	default:
		return protocol.FileUnstated
	}
}

func toolTextIn(blocks []block) string {
	texts := make([]string, 0, len(blocks))
	for _, each := range blocks {
		if each.Type == "content" && each.Content.Text != "" {
			texts = append(texts, each.Content.Text)
		}
	}
	return strings.TrimSpace(strings.Join(texts, "\n"))
}

func textOf(content json.RawMessage) string {
	var one block
	if json.Unmarshal(content, &one) != nil || one.Type != "text" {
		return ""
	}
	return one.Text
}

func textIn(content json.RawMessage) string {
	var blocks []block
	if json.Unmarshal(content, &blocks) != nil {
		return ""
	}
	texts := make([]string, 0, len(blocks))
	for _, each := range blocks {
		if each.Type == "text" && each.Text != "" {
			texts = append(texts, each.Text)
		}
	}
	return strings.TrimSpace(strings.Join(texts, "\n"))
}

func decoded(data string) []byte {
	raw, err := base64.StdEncoding.DecodeString(data)
	if err != nil {
		return nil
	}
	return raw
}

func whole(raw []byte) (string, []byte) {
	for back := 1; back <= utf8.UTFMax && back <= len(raw); back++ {
		start := len(raw) - back
		if !utf8.RuneStart(raw[start]) {
			continue
		}
		if utf8.FullRune(raw[start:]) {
			break
		}
		return string(raw[:start]), slices.Clone(raw[start:])
	}
	return string(raw), nil
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
