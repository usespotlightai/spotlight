package protocol

import "time"

type Registration struct {
	Harnesses []HarnessReport `json:"harnesses"`
}

type HarnessReport struct {
	ID     string   `json:"id"`
	Models []string `json:"models,omitempty"`
}

type Installable struct {
	ID         string   `json:"id"`
	Executable string   `json:"executable"`
	Discovery  []string `json:"discovery,omitempty"`
}

type Registered struct {
	RunnerID string `json:"runnerId"`
}

type Kept struct {
	Keys []string `json:"keys"`
}

const ThroughSpotlight = "spotlight:repository"

type Checkout struct {
	Remote string `json:"remote"`
	Path   string `json:"path"`
	Branch string `json:"branch"`
	Ref    string `json:"ref,omitempty"`
	DiffOf string `json:"diffOf,omitempty"`
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
	Checkouts   []Checkout     `json:"checkouts,omitempty"`
	Command     Command        `json:"command"`
	Briefing    string         `json:"briefing,omitempty"`
	Handover    Handover       `json:"handover,omitzero"`
	Manifest    []ToolManifest `json:"manifest,omitempty"`
	Continuity  Continuity     `json:"continuity,omitzero"`
	Attachments []Attachment   `json:"attachments,omitempty"`
	Skills      []SkillFile    `json:"skills,omitempty"`
	Diffs       bool           `json:"diffs,omitempty"`
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
	Keep      bool   `json:"keep,omitempty"`
}

type Run struct {
	ID   string `json:"id"`
	Spec Spec   `json:"spec"`
}

type EventType string

const (
	EventWorkspaceReady EventType = "workspace.ready"
	EventOutput         EventType = "output"
	EventFailed         EventType = "failed"
	EventSpan           EventType = "span"
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
	ExitCode  int      `json:"exitCode"`
	Failed    bool     `json:"failed"`
	Stopped   bool     `json:"stopped,omitempty"`
	Message   string   `json:"message,omitempty"`
	Outcome   *Outcome `json:"outcome,omitempty"`
	SessionID string   `json:"sessionId,omitempty"`
}

type Said struct {
	Position    int          `json:"position"`
	Body        string       `json:"body"`
	Attachments []Attachment `json:"attachments,omitempty"`
}

type ChangeStackDraft struct {
	Diff       string `json:"diff"`
	Repository string `json:"repository"`
}

type StackChecks struct {
	Waiting bool         `json:"waiting"`
	Checks  []StackCheck `json:"checks"`
}

type StackCheck struct {
	StackID    string      `json:"stackId"`
	Repository *string     `json:"repository"`
	Command    string      `json:"command"`
	Steps      []CheckStep `json:"steps"`
}

type CheckStep struct {
	ID    string `json:"id"`
	Patch string `json:"patch"`
}

type StackChecked struct {
	Skipped string        `json:"skipped,omitempty"`
	Steps   []CheckedStep `json:"steps,omitempty"`
}

type CheckedStep struct {
	Step   string `json:"step"`
	Passed bool   `json:"passed"`
	Output string `json:"output"`
	TookMs int64  `json:"tookMs"`
}
