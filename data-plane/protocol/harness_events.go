package protocol

import (
	"bytes"
	"encoding/json"
)

const HarnessEventsVersion = 1

const (
	EventTurnStarted       EventType = "turn.started"
	EventTurnEnded         EventType = "turn.ended"
	EventSessionState      EventType = "session.state"
	EventMessage           EventType = "message"
	EventToolChanged       EventType = "tool.changed"
	EventToolOutput        EventType = "tool.output"
	EventPlanChanged       EventType = "plan.changed"
	EventBackgroundChanged EventType = "background.changed"
	EventChildChanged      EventType = "child.changed"
	EventChildMessage      EventType = "child.message"
	EventContextChanged    EventType = "context.changed"
	EventHarnessFrame      EventType = "harness.frame"
)

type HarnessReports struct {
	Background       bool `json:"background"`
	SelfStartedTurns bool `json:"selfStartedTurns"`
	TurnUsage        bool `json:"turnUsage"`
	CommandOutput    bool `json:"commandOutput"`
}

type HarnessConnected struct {
	Protocol string         `json:"protocol"`
	Events   int            `json:"events"`
	Session  string         `json:"session"`
	Reports  HarnessReports `json:"reports"`
}

type TurnOrigin string

const (
	TurnFromPrompt TurnOrigin = "prompt"
	TurnFromSelf   TurnOrigin = "self"
)

type TurnStarted struct {
	Session string     `json:"session,omitempty"`
	Turn    int        `json:"turn"`
	Origin  TurnOrigin `json:"origin"`
	Cause   string     `json:"cause,omitempty"`
}

type TurnStop string

const (
	TurnStopEnded     TurnStop = "ended"
	TurnStopCutShort  TurnStop = "cut-short"
	TurnStopRefused   TurnStop = "refused"
	TurnStopCancelled TurnStop = "cancelled"
	TurnStopFailed    TurnStop = "failed"
)

type TurnUsage struct {
	Input      *int `json:"input,omitempty"`
	Output     *int `json:"output,omitempty"`
	CacheRead  *int `json:"cacheRead,omitempty"`
	CacheWrite *int `json:"cacheWrite,omitempty"`
}

type TurnEnded struct {
	Session string     `json:"session,omitempty"`
	Turn    int        `json:"turn"`
	Stop    TurnStop   `json:"stop"`
	Reason  string     `json:"reason,omitempty"`
	Error   string     `json:"error,omitempty"`
	Usage   *TurnUsage `json:"usage,omitempty"`
}

type SessionStateName string

const (
	SessionRunning     SessionStateName = "running"
	SessionNeedsAction SessionStateName = "needs-action"
	SessionIdle        SessionStateName = "idle"
)

type SessionState struct {
	Session string           `json:"session,omitempty"`
	State   SessionStateName `json:"state"`
}

type MessageRole string

const (
	MessageFromAgent MessageRole = "agent"
	MessageFromUser  MessageRole = "user"
	MessageThought   MessageRole = "thought"
)

type AgentMessage struct {
	Session string      `json:"session,omitempty"`
	ID      string      `json:"id"`
	Role    MessageRole `json:"role"`
	Text    string      `json:"text"`
}

type ToolLocation struct {
	Path string `json:"path"`
	Line *int   `json:"line,omitempty"`
}

type FileOperation string

const (
	FileCreated  FileOperation = "create"
	FileChanged  FileOperation = "update"
	FileDeleted  FileOperation = "delete"
	FileMoved    FileOperation = "move"
	FileUnstated FileOperation = "unstated"
)

type FileChange struct {
	Path      string        `json:"path"`
	OldPath   string        `json:"oldPath,omitempty"`
	Operation FileOperation `json:"operation"`
	Before    *string       `json:"before,omitempty"`
	After     *string       `json:"after,omitempty"`
}

type ToolStatus string

const (
	ToolPending   ToolStatus = "pending"
	ToolRunning   ToolStatus = "in_progress"
	ToolCompleted ToolStatus = "completed"
	ToolFailed    ToolStatus = "failed"
)

type ToolChanged struct {
	Session   string          `json:"session,omitempty"`
	ID        string          `json:"id"`
	Name      string          `json:"name,omitempty"`
	Kind      string          `json:"kind,omitempty"`
	Title     string          `json:"title"`
	Status    ToolStatus      `json:"status,omitempty"`
	Input     json.RawMessage `json:"input,omitempty"`
	Output    json.RawMessage `json:"output,omitempty"`
	Locations []ToolLocation  `json:"locations,omitempty"`
	Files     []FileChange    `json:"files,omitempty"`
	Patch     string          `json:"patch,omitempty"`
}

type ToolOutput struct {
	Session string `json:"session,omitempty"`
	ID      string `json:"id"`
	Text    string `json:"text"`
	Replace bool   `json:"replace,omitempty"`
}

type PlanEntry struct {
	Content  string `json:"content"`
	Status   string `json:"status,omitempty"`
	Priority string `json:"priority,omitempty"`
}

type PlanChanged struct {
	Session string      `json:"session,omitempty"`
	Entries []PlanEntry `json:"entries"`
}

type BackgroundChanged struct {
	Session string           `json:"session,omitempty"`
	Items   []BackgroundTask `json:"items"`
}

type ChildChanged struct {
	Session     string           `json:"session,omitempty"`
	Child       string           `json:"child"`
	Title       string           `json:"title,omitempty"`
	Description string           `json:"description,omitempty"`
	State       SessionStateName `json:"state,omitempty"`
	Stop        TurnStop         `json:"stop,omitempty"`
}

type ChildMessage struct {
	Session string `json:"session,omitempty"`
	From    string `json:"from,omitempty"`
	To      string `json:"to,omitempty"`
	Text    string `json:"text"`
}

type Cost struct {
	Amount   float64 `json:"amount"`
	Currency string  `json:"currency"`
}

type ContextChanged struct {
	Session string `json:"session,omitempty"`
	Used    int    `json:"used"`
	Size    int    `json:"size"`
	Cost    *Cost  `json:"cost,omitempty"`
}

type HarnessFrame struct {
	Protocol string          `json:"protocol"`
	Data     json.RawMessage `json:"data"`
}

func HarnessEvent(kind EventType, data any) Event {
	var encoded bytes.Buffer
	writer := json.NewEncoder(&encoded)
	writer.SetEscapeHTML(false)
	_ = writer.Encode(data)
	return Event{Type: kind, Data: bytes.TrimSuffix(encoded.Bytes(), []byte("\n"))}
}
