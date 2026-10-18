package protocol

import (
	"encoding/json"
	"time"
)

type Registration struct {
	Release   string          `json:"release,omitempty"`
	Harnesses []HarnessReport `json:"harnesses"`
}

type HarnessReport struct {
	ID      string   `json:"id"`
	Models  []string `json:"models,omitempty"`
	Version string   `json:"version,omitempty"`
}

type HarnessProbe struct {
	ID           string   `json:"id"`
	Executable   string   `json:"executable"`
	Discovery    []string `json:"discovery,omitempty"`
	VersionProbe []string `json:"versionProbe,omitempty"`
}

type RegisterResponse struct {
	RunnerID string `json:"runnerId"`
}

const RemoteViaGitProxy = "spotlight:repository"

type Checkout struct {
	Remote string `json:"remote"`
	Path   string `json:"path"`
	Branch string `json:"branch"`
	Ref    string `json:"ref,omitempty"`
	DiffOf string `json:"diffOf,omitempty"`
	Setup  string `json:"setup,omitempty"`
}

const DiffOfCommits = "commits"

type Command struct {
	Executable     string            `json:"executable"`
	Args           []string          `json:"args,omitempty"`
	Env            map[string]string `json:"env,omitempty"`
	SessionOptions []SessionOption   `json:"sessionOptions,omitempty"`
}

type SessionOption struct {
	ID       string `json:"id"`
	Value    string `json:"value"`
	Optional bool   `json:"optional,omitempty"`
}

type HandoverSpec struct {
	Options   []string `json:"options,omitempty"`
	NoteLimit int      `json:"noteLimit,omitempty"`
}

type Spec struct {
	Checkouts     []Checkout     `json:"checkouts,omitempty"`
	Command       Command        `json:"command"`
	Briefing      string         `json:"briefing,omitempty"`
	Handover      HandoverSpec   `json:"handover,omitzero"`
	Manifest      []ToolManifest `json:"manifest,omitempty"`
	Resume        Resume         `json:"resume,omitzero"`
	Attachments   []Attachment   `json:"attachments,omitempty"`
	Skills        []SkillFile    `json:"skills,omitempty"`
	SkillHomes    []string       `json:"skillHomes,omitempty"`
	Diffs         bool           `json:"diffs,omitempty"`
	StartingPoint bool           `json:"startingPoint,omitempty"`
	HarnessSetup  HarnessSetup   `json:"harnessSetup,omitzero"`
	SettingFiles  []string       `json:"settingFiles,omitempty"`
	SpotlightAPI  bool           `json:"spotlightApi,omitempty"`
	Replay        *Replay        `json:"replay,omitempty"`
	Search        *SearchSpec    `json:"search,omitempty"`
}

type Replay struct {
	Archive   *string           `json:"archive"`
	Checkouts []StartedCheckout `json:"checkouts"`
}

type HarnessSetup struct {
	Files      []SetupFile     `json:"files,omitempty"`
	Session    json.RawMessage `json:"session,omitempty"`
	McpServers []McpServer     `json:"mcpServers,omitempty"`
	AskKinds   []string        `json:"askKinds,omitempty"`
}

type SetupFile struct {
	Path string `json:"path"`
	Text string `json:"text"`
}

type McpServer struct {
	Name    string        `json:"name"`
	Command string        `json:"command"`
	Args    []string      `json:"args"`
	Env     []EnvVariable `json:"env"`
}

type EnvVariable struct {
	Name  string `json:"name"`
	Value string `json:"value"`
}

const (
	PermissionAllow   = "allow"
	PermissionReject  = "reject"
	PermissionPending = "pending"
)

type PermissionRequest struct {
	SessionID string          `json:"sessionId"`
	Kind      string          `json:"kind"`
	Title     string          `json:"title"`
	Input     json.RawMessage `json:"input,omitempty"`
}

type PermissionResponse struct {
	Decision string `json:"decision"`
}

type Attachment struct {
	ID   string `json:"id"`
	Path string `json:"path"`
}

type ToolManifest struct {
	Name        string              `json:"name"`
	Description string              `json:"description"`
	Inputs      []ToolInputManifest `json:"inputs,omitempty"`
	Approval    *ToolApproval       `json:"approval"`
	Integration string              `json:"integration,omitempty"`
	Output      json.RawMessage     `json:"output,omitempty"`
}

type ToolApproval struct {
	Because string `json:"because"`
}

const ToolIntentInput = "intent"

type ToolInputManifest struct {
	Name        string          `json:"name"`
	Schema      json.RawMessage `json:"schema"`
	Description string          `json:"description,omitempty"`
	Required    bool            `json:"required,omitempty"`
	Defaulted   bool            `json:"defaulted,omitempty"`
	Stdin       bool            `json:"stdin,omitempty"`
}

type inputSchema struct {
	Type  json.RawMessage `json:"type"`
	Enum  []any           `json:"enum"`
	Const json.RawMessage `json:"const"`
}

func (i ToolInputManifest) Kind() string {
	var shape inputSchema
	if json.Unmarshal(i.Schema, &shape) != nil {
		return ""
	}

	if shape.Type == nil {
		values := shape.Enum
		var constant any
		if shape.Const != nil && json.Unmarshal(shape.Const, &constant) == nil {
			values = []any{constant}
		}
		return kindOfValues(values)
	}

	var single string
	if json.Unmarshal(shape.Type, &single) == nil {
		return single
	}

	var several []string
	if json.Unmarshal(shape.Type, &several) != nil {
		return ""
	}
	for _, kind := range several {
		if kind != "null" {
			return kind
		}
	}

	return ""
}

func kindOfValues(values []any) string {
	kind := ""
	for _, value := range values {
		var each string
		switch value.(type) {
		case string:
			each = "string"
		case float64:
			each = "number"
		case bool:
			each = "boolean"
		default:
			return ""
		}
		if kind != "" && kind != each {
			return ""
		}
		kind = each
	}

	return kind
}

func (i ToolInputManifest) Scalar() bool {
	switch i.Kind() {
	case "string", "number", "integer", "boolean":
		return true
	}

	return false
}

type SkillFile struct {
	Path string `json:"path"`
	Text string `json:"text"`
}

type Resume struct {
	Key           string `json:"key,omitempty"`
	SessionID     string `json:"sessionId,omitempty"`
	ResumeSession bool   `json:"resumeSession,omitempty"`
}

type Run struct {
	ID      string `json:"id"`
	Harness string `json:"harness,omitempty"`
	Attempt int    `json:"attempt,omitempty"`
	Spec    Spec   `json:"spec"`
}

type EventType string

const (
	EventWorkspaceReady EventType = "workspace.ready"
	EventOutput         EventType = "output"
	EventFailed         EventType = "failed"
	EventSpan           EventType = "span"
	EventUsage          EventType = "usage"
	EventToolRefused    EventType = "tool.refused"
	EventEgressChecked  EventType = "egress.checked"
)

type Event struct {
	Seq      int       `json:"seq"`
	Type     EventType `json:"type"`
	At       time.Time `json:"at"`
	Message  string    `json:"message,omitempty"`
	Data     []byte    `json:"data,omitempty"`
	ExitCode *int      `json:"exitCode,omitempty"`
}

type ReviewCommentReply struct {
	Handle  string `json:"handle"`
	Body    string `json:"body"`
	Resolve bool   `json:"resolve,omitempty"`
}

type Handover struct {
	Next string `json:"next"`
	Note string `json:"note,omitempty"`
}

type Completion struct {
	ExitCode    int       `json:"exitCode"`
	Failed      bool      `json:"failed"`
	SetupFailed bool      `json:"setupFailed,omitempty"`
	TimedOut    bool      `json:"timedOut,omitempty"`
	Stopped     bool      `json:"stopped,omitempty"`
	Message     string    `json:"message,omitempty"`
	Handover    *Handover `json:"handover,omitempty"`
	SessionID   string    `json:"sessionId,omitempty"`
	Archived    bool      `json:"archived,omitempty"`
}

type TurnAwaitsPerson struct {
	AwaitsPerson bool `json:"awaitsPerson"`
}

type CompleteResponse struct {
	Waiting bool `json:"waiting"`
}

type SuspendRequest struct {
	Requeue bool `json:"requeue,omitempty"`
}

type Suspension struct {
	Suspended bool `json:"suspended"`
}

type StoredArchive struct {
	ID     string `json:"id"`
	URL    string `json:"url"`
	Size   int64  `json:"size"`
	SHA256 string `json:"sha256"`
}

type StartedCheckout struct {
	Path   string `json:"path"`
	Commit string `json:"commit"`
}

type StartingPoint struct {
	Attempt   int               `json:"attempt"`
	ArchiveID *string           `json:"archiveId"`
	Checkouts []StartedCheckout `json:"checkouts"`
}

type ArchiveRequest struct {
	Size   int64  `json:"size"`
	SHA256 string `json:"sha256"`
}

type ArchiveGrant struct {
	ID      string            `json:"id"`
	URL     string            `json:"url"`
	Headers map[string]string `json:"headers"`
}

type Message struct {
	Position    int          `json:"position"`
	Body        string       `json:"body"`
	Attachments []Attachment `json:"attachments,omitempty"`
}

type ChangeStackGenerationRequest struct {
	Diff       string `json:"diff"`
	Repository string `json:"repository"`
	Base       string `json:"base,omitempty"`
}

const (
	ClaimedRun   = "run"
	ClaimedCheck = "check"
)

type ClaimResponse struct {
	Kind  string      `json:"kind"`
	Run   *Run        `json:"run"`
	Check *StackCheck `json:"check"`
}

type Assignment struct {
	RunnerID    string        `json:"runnerId"`
	Token       string        `json:"token"`
	EgressToken string        `json:"egressToken,omitempty"`
	Work        ClaimResponse `json:"work"`
}

type StackCheck struct {
	StackID    string      `json:"stackId"`
	Recheck    bool        `json:"recheck"`
	RunID      string      `json:"runId"`
	Repository string      `json:"repository"`
	Base       string      `json:"base"`
	Setup      string      `json:"setup"`
	Command    string      `json:"command"`
	Steps      []CheckStep `json:"steps"`
}

type CheckStep struct {
	ID             string `json:"id"`
	Patch          string `json:"patch"`
	StopsOnFailure bool   `json:"stopsOnFailure"`
	RunsSetup      bool   `json:"runsSetup"`
}

const (
	SkipNoBase          = "no-base"
	SkipNoCheckout      = "no-checkout"
	SkipCheckoutFailed  = "checkout-failed"
	SkipSetupFailed     = "setup-failed"
	SkipWorkspaceFailed = "workspace-failed"
	SkipOutOfTime       = "out-of-time"
	SkipNoImage         = "no-image"
)

type SkippedCheck struct {
	Code   string `json:"code"`
	Detail string `json:"detail,omitempty"`
}

type StackCheckResult struct {
	Skipped *SkippedCheck     `json:"skipped,omitempty"`
	Steps   []CheckStepResult `json:"steps,omitempty"`
}

type CheckStepResult struct {
	Step       string `json:"step"`
	Passed     bool   `json:"passed"`
	Output     string `json:"output"`
	DurationMs int64  `json:"durationMs"`
}
