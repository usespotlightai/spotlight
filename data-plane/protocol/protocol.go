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
	Protocol       string            `json:"protocol,omitempty"`
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
	Checkouts     []Checkout        `json:"checkouts,omitempty"`
	Command       Command           `json:"command"`
	Briefing      string            `json:"briefing,omitempty"`
	Handover      HandoverSpec      `json:"handover,omitzero"`
	Manifest      []ToolManifest    `json:"manifest,omitempty"`
	ChangedTools  *ChangedTools     `json:"changedTools,omitempty"`
	Resume        Resume            `json:"resume,omitzero"`
	Attachments   []Attachment      `json:"attachments,omitempty"`
	Skills        []SkillFile       `json:"skills,omitempty"`
	SkillHomes    []string          `json:"skillHomes,omitempty"`
	Diffs         bool              `json:"diffs,omitempty"`
	StartingPoint bool              `json:"startingPoint,omitempty"`
	HarnessSetup  HarnessSetup      `json:"harnessSetup,omitzero"`
	SettingFiles  []string          `json:"settingFiles,omitempty"`
	SpotlightAPI  bool              `json:"spotlightApi,omitempty"`
	Replay        *Replay           `json:"replay,omitempty"`
	Search        *SearchSpec       `json:"search,omitempty"`
	SandboxEnv    []SandboxVariable `json:"sandboxEnv,omitempty"`
	Assist        *AssistSpec       `json:"assist,omitempty"`
	Services      []Service         `json:"services,omitempty"`
}

// Service is a container a run needs beside its sandbox, such as a database, read from a Compose file of a
// checkout. The host starts it on the sandbox's network, where the run reaches it by its name.
type Service struct {
	Name      string         `json:"name"`
	Image     string         `json:"image"`
	Command   []string       `json:"command,omitempty"`
	Env       []EnvVariable  `json:"env,omitempty"`
	Health    *ServiceHealth `json:"health,omitempty"`
	DependsOn []string       `json:"dependsOn,omitempty"`
	// From is the Compose file the service was read from, relative to the working copy.
	From string `json:"from"`
}

// ServiceHealth is how the host tells a service is ready. Without one, the image's own health check counts, and
// a service with neither is ready once it runs.
type ServiceHealth struct {
	Test          []string `json:"test"`
	IntervalMs    int64    `json:"intervalMs,omitempty"`
	TimeoutMs     int64    `json:"timeoutMs,omitempty"`
	StartPeriodMs int64    `json:"startPeriodMs,omitempty"`
	Retries       int      `json:"retries,omitempty"`
}

// ServicesPath is where the host leaves the outcome of starting a run's services, once each is ready or failed.
const ServicesPath = "/run/spotlight/services.json"

// ServicesStarted is the file at ServicesPath. Run names the run it is for: a sandbox that carries on to another
// run still holds the last run's file until the host replaces it.
type ServicesStarted struct {
	Run      string           `json:"run"`
	Services []ServiceOutcome `json:"services"`
}

type ServiceOutcome struct {
	Name    string `json:"name"`
	From    string `json:"from"`
	Ready   bool   `json:"ready"`
	Problem string `json:"problem,omitempty"`
}

type SandboxVariable struct {
	Variable string `json:"variable"`
	Secret   string `json:"secret"`
}

type SandboxEnvRequest struct {
	Attempt int `json:"attempt"`
}

type SandboxEnv struct {
	Variables []EnvVariable  `json:"variables"`
	Denied    []DeniedSecret `json:"denied"`
}

type ChangedTools struct {
	Added   []string `json:"added"`
	Removed []string `json:"removed"`
}

type Replay struct {
	Archive   *string        `json:"archive"`
	Checkouts []CheckoutHead `json:"checkouts"`
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
	Items json.RawMessage `json:"items"`
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

func (i ToolInputManifest) TextList() bool {
	var shape inputSchema
	if i.Kind() != "array" || json.Unmarshal(i.Schema, &shape) != nil || shape.Items == nil {
		return false
	}

	return ToolInputManifest{Schema: shape.Items}.Kind() == "string"
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
	FollowUp      string `json:"followUp,omitempty"`
}

type Run struct {
	ID      string `json:"id"`
	Harness string `json:"harness,omitempty"`
	Attempt int    `json:"attempt,omitempty"`
	Spec    Spec   `json:"spec"`
}

type EventType string

const (
	EventWorkingCopyReady EventType = "working-copy.ready"
	EventStepStarted      EventType = "step.started"
	EventStepEnded        EventType = "step.ended"
	EventFailed           EventType = "failed"
	EventSpan             EventType = "span"
	EventToolRefused      EventType = "tool.refused"
	EventEgressChecked    EventType = "egress.checked"
	EventAgentStopped     EventType = "agent.stopped"
	EventHarnessConnected EventType = "harness.connected"
	EventAgentReminded    EventType = "agent.reminded"
	EventBackgroundWait   EventType = "background.waiting"
	EventBackgroundDone   EventType = "background.settled"
	EventBackgroundLost   EventType = "background.lost"
)

type StepStart struct {
	ID string `json:"id"`
}

type StepEnd struct {
	ID     string `json:"id,omitempty"`
	Failed bool   `json:"failed,omitempty"`
	Output string `json:"output,omitempty"`
}

type BackgroundKind string

const (
	BackgroundCommand  BackgroundKind = "command"
	BackgroundMonitor  BackgroundKind = "monitor"
	BackgroundSubagent BackgroundKind = "subagent"
	BackgroundOther    BackgroundKind = "other"
)

type BackgroundTask struct {
	ID          string         `json:"id"`
	Kind        BackgroundKind `json:"kind"`
	Description string         `json:"description"`
}

type WaitEnded string

const (
	WaitSettled    WaitEnded = "settled"
	WaitHandedOver WaitEnded = "handed-over"
	WaitMessage    WaitEnded = "message"
	WaitStopped    WaitEnded = "stopped"
	WaitGone       WaitEnded = "gone"
	WaitLimit      WaitEnded = "limit"
)

type BackgroundWork struct {
	Tasks []BackgroundTask `json:"tasks"`
	Until *time.Time       `json:"until,omitempty"`
	Ended WaitEnded        `json:"ended,omitempty"`
}

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
	Next        string       `json:"next"`
	Note        string       `json:"note,omitempty"`
	Suggest     string       `json:"suggest,omitempty"`
	Files       []HandedFile `json:"files,omitempty"`
	Attachments []string     `json:"attachments,omitempty"`
}

type HandedFile struct {
	Name        string `json:"name"`
	ContentType string `json:"contentType,omitempty"`
	Data        []byte `json:"data"`
}

type Completion struct {
	ExitCode    int            `json:"exitCode"`
	Failed      bool           `json:"failed"`
	SetupFailed bool           `json:"setupFailed,omitempty"`
	TimedOut    bool           `json:"timedOut,omitempty"`
	Stopped     bool           `json:"stopped,omitempty"`
	Message     string         `json:"message,omitempty"`
	Handover    *Handover      `json:"handover,omitempty"`
	SessionID   string         `json:"sessionId,omitempty"`
	Heads       []CheckoutHead `json:"heads,omitempty"`
}

type StoredArchive struct {
	ID     string `json:"id"`
	URL    string `json:"url"`
	Size   int64  `json:"size"`
	SHA256 string `json:"sha256"`
}

type CheckoutHead struct {
	Path   string `json:"path"`
	Commit string `json:"commit"`
}

type StartingPoint struct {
	Attempt   int            `json:"attempt"`
	ArchiveID *string        `json:"archiveId"`
	Checkouts []CheckoutHead `json:"checkouts"`
}

type ArchiveRequest struct {
	Size   int64  `json:"size"`
	SHA256 string `json:"sha256"`
}

type AttachmentRequest struct {
	Name        string `json:"name"`
	ContentType string `json:"contentType"`
	Size        int64  `json:"size"`
}

type AttachmentGrant struct {
	ID      string            `json:"id"`
	URL     string            `json:"url"`
	Headers map[string]string `json:"headers"`
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
	ClaimedRun     = "run"
	ClaimedCheck   = "check"
	ClaimedSandbox = "sandbox"
	ClaimedDiff    = "diff"
)

type ClaimResponse struct {
	Kind  string       `json:"kind"`
	Run   *Run         `json:"run"`
	Check *StackCheck  `json:"check"`
	Diff  *PushDiff    `json:"diff,omitempty"`
	Warm  *WarmSandbox `json:"warm,omitempty"`
}

type WarmSandbox struct {
	Line      string         `json:"line"`
	Checkouts []WarmCheckout `json:"checkouts"`
}

type WarmCheckout struct {
	Path  string `json:"path"`
	Setup string `json:"setup,omitempty"`
}

type Assignment struct {
	RunnerID     string        `json:"runnerId"`
	Token        string        `json:"token"`
	EgressToken  string        `json:"egressToken,omitempty"`
	SandboxID    string        `json:"sandboxId,omitempty"`
	SandboxToken string        `json:"sandboxToken,omitempty"`
	AllowedHosts []string      `json:"allowedHosts,omitempty"`
	Reused       bool          `json:"reused,omitempty"`
	Work         ClaimResponse `json:"work"`
}

func (a Assignment) StartsSandboxOnly() bool {
	return a.Work.Kind == ClaimedSandbox
}

type StackCheck struct {
	StackID    string      `json:"stackId"`
	Recheck    bool        `json:"recheck"`
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
	SkipNoBase            = "no-base"
	SkipNoCheckout        = "no-checkout"
	SkipCheckoutFailed    = "checkout-failed"
	SkipSetupFailed       = "setup-failed"
	SkipWorkingCopyFailed = "working-copy-failed"
	SkipOutOfTime         = "out-of-time"
	SkipNoImage           = "no-image"
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

type PushDiff struct {
	DiffID     string `json:"diffId"`
	Repository string `json:"repository"`
	BaseTip    string `json:"baseTip"`
	Head       string `json:"head"`
}

type PushDiffResult struct {
	Diff string `json:"diff"`
	Base string `json:"base"`
}

type PushDiffFailure struct {
	Reason string `json:"reason"`
}
