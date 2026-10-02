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

type Installable struct {
	ID           string   `json:"id"`
	Executable   string   `json:"executable"`
	Discovery    []string `json:"discovery,omitempty"`
	VersionProbe []string `json:"versionProbe,omitempty"`
}

type Registered struct {
	RunnerID string `json:"runnerId"`
}

const ThroughSpotlight = "spotlight:repository"

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
	Executable string            `json:"executable"`
	Args       []string          `json:"args,omitempty"`
	Env        map[string]string `json:"env,omitempty"`
}

type Handover struct {
	Options   []string `json:"options,omitempty"`
	NoteLimit int      `json:"noteLimit,omitempty"`
}

type Spec struct {
	Checkouts     []Checkout     `json:"checkouts,omitempty"`
	Command       Command        `json:"command"`
	Briefing      string         `json:"briefing,omitempty"`
	Handover      Handover       `json:"handover,omitzero"`
	Manifest      []ToolManifest `json:"manifest,omitempty"`
	Continuity    Continuity     `json:"continuity,omitzero"`
	Attachments   []Attachment   `json:"attachments,omitempty"`
	Skills        []SkillFile    `json:"skills,omitempty"`
	SkillHomes    []string       `json:"skillHomes,omitempty"`
	Diffs         bool           `json:"diffs,omitempty"`
	StartingPoint bool           `json:"startingPoint,omitempty"`
	HarnessSetup  HarnessSetup   `json:"harnessSetup,omitzero"`
	SettingFiles  []string       `json:"settingFiles,omitempty"`
	Replay        *Replay        `json:"replay,omitempty"`
}

type Replay struct {
	Archive   *string           `json:"archive"`
	Checkouts []StartedCheckout `json:"checkouts"`
}

type HarnessSetup struct {
	Files      []SetupFile     `json:"files,omitempty"`
	Session    json.RawMessage `json:"session,omitempty"`
	McpServers []McpServer     `json:"mcpServers,omitempty"`
	Asks       []string        `json:"asks,omitempty"`
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
	PermissionAllow       = "allow"
	PermissionReject      = "reject"
	PermissionPutToPerson = "asked"
)

type PermissionAsked struct {
	SessionID string          `json:"sessionId"`
	Kind      string          `json:"kind"`
	Title     string          `json:"title"`
	Input     json.RawMessage `json:"input,omitempty"`
}

type PermissionAnswer struct {
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
}

type ToolInputManifest struct {
	Name        string `json:"name"`
	Type        string `json:"type"`
	Description string `json:"description,omitempty"`
	Required    bool   `json:"required,omitempty"`
	Defaulted   bool   `json:"defaulted,omitempty"`
	Piped       bool   `json:"piped,omitempty"`
}

type SkillFile struct {
	Path string `json:"path"`
	Text string `json:"text"`
}

type Continuity struct {
	Key       string `json:"key,omitempty"`
	SessionID string `json:"sessionId,omitempty"`
	Resumes   bool   `json:"resumes,omitempty"`
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
)

type Event struct {
	Seq      int       `json:"seq"`
	Type     EventType `json:"type"`
	At       time.Time `json:"at"`
	Message  string    `json:"message,omitempty"`
	Data     []byte    `json:"data,omitempty"`
	ExitCode *int      `json:"exitCode,omitempty"`
}

type Remark struct {
	Handle  string `json:"handle"`
	Body    string `json:"body"`
	Resolve bool   `json:"resolve,omitempty"`
}

type Outcome struct {
	Next string `json:"next"`
	Note string `json:"note,omitempty"`
}

type Completion struct {
	ExitCode   int      `json:"exitCode"`
	Failed     bool     `json:"failed"`
	Unprepared bool     `json:"unprepared,omitempty"`
	TimedOut   bool     `json:"timedOut,omitempty"`
	Stopped    bool     `json:"stopped,omitempty"`
	Message    string   `json:"message,omitempty"`
	Outcome    *Outcome `json:"outcome,omitempty"`
	SessionID  string   `json:"sessionId,omitempty"`
	Kept       bool     `json:"kept,omitempty"`
}

type TurnAsks struct {
	Asks bool `json:"asks"`
}

type Completed struct {
	Waiting bool `json:"waiting"`
}

type ParkRequest struct {
	Cold bool `json:"cold,omitempty"`
}

type Parking struct {
	Parked bool `json:"parked"`
}

type HeldArchive struct {
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

type Said struct {
	Position    int          `json:"position"`
	Body        string       `json:"body"`
	Attachments []Attachment `json:"attachments,omitempty"`
}

type ChangeStackDraft struct {
	Diff       string `json:"diff"`
	Repository string `json:"repository"`
	Base       string `json:"base,omitempty"`
}

const (
	ClaimedRun   = "run"
	ClaimedCheck = "check"
)

type Claimed struct {
	Kind  string      `json:"kind"`
	Run   *Run        `json:"run"`
	Check *StackCheck `json:"check"`
}

type Handed struct {
	RunnerID    string  `json:"runnerId"`
	Token       string  `json:"token"`
	EgressToken string  `json:"egressToken,omitempty"`
	Work        Claimed `json:"work"`
}

type StackCheck struct {
	StackID    string      `json:"stackId"`
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
	SkipNoBase         = "no-base"
	SkipNoCheckout     = "no-checkout"
	SkipCheckoutFailed = "checkout-failed"
	SkipSetupFailed    = "setup-failed"
	SkipNoRoom         = "no-room"
	SkipOutOfTime      = "out-of-time"
	SkipNoImage        = "no-image"
)

type SkippedCheck struct {
	Code   string `json:"code"`
	Detail string `json:"detail,omitempty"`
}

type StackChecked struct {
	Skipped *SkippedCheck `json:"skipped,omitempty"`
	Steps   []CheckedStep `json:"steps,omitempty"`
}

type CheckedStep struct {
	Step   string `json:"step"`
	Passed bool   `json:"passed"`
	Output string `json:"output"`
	TookMs int64  `json:"tookMs"`
}
