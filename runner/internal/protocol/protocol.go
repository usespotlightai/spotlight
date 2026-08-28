// Package protocol holds the wire types shared with the control plane.
package protocol

import "time"

// Registration says a runner is there, and what it found installed. What is on
// a machine is the one thing a runner says about itself; what it is then given
// remains the control plane's to decide.
type Registration struct {
	Capacity  int      `json:"capacity"`
	Harnesses []string `json:"harnesses"`
}

// Installable is one harness to look for. The runner reads no meaning into it:
// it looks for the executable and reports the id back.
type Installable struct {
	ID         string `json:"id"`
	Executable string `json:"executable"`
}

type Registered struct {
	RunnerID string `json:"runnerId"`
}

// Checkout is one repository a run works in. A run may have several, since an
// agent that cannot see a consumer cannot tell whether it broke it.
type Checkout struct {
	Remote string `json:"remote"`
	Ref    string `json:"ref"`
	Path   string `json:"path"`
	Branch string `json:"branch"`
}

// Command is the agent CLI to supervise. Vendor differences amount to this
// much, so the runner needs no per-vendor code.
type Command struct {
	Executable string            `json:"executable"`
	Args       []string          `json:"args,omitempty"`
	Env        map[string]string `json:"env,omitempty"`
}

// Handover is the vocabulary the agent may use to say what happens next. The
// runner holds the list without knowing what the words mean: it checks
// membership so a wrong one is refused while the agent can still fix it, and
// the control plane decides what any of them do.
type Handover struct {
	Options []string `json:"options,omitempty"`
}

// Spec is what a run is supposed to do. The control plane stores it whole and
// never looks inside, so it travels as one opaque object: what a checkout
// means is the prepare hook's business.
type Spec struct {
	Checkouts []Checkout `json:"checkouts,omitempty"`
	Cwd       string     `json:"cwd,omitempty"`
	Command   Command    `json:"command"`
	Handover  Handover   `json:"handover,omitzero"`
}

type Run struct {
	ID             string    `json:"id"`
	Spec           Spec      `json:"spec"`
	LeaseExpiresAt time.Time `json:"leaseExpiresAt"`
}

// EventType names what happened. The set is closed: the control plane cannot
// interpret anything else.
type EventType string

const (
	EventWorkspaceReady EventType = "workspace.ready"
	EventOutput         EventType = "output"
	EventFailed         EventType = "failed"
	EventCompleted      EventType = "completed"
)

// Event is one entry in a run's journal. Seq is assigned by the runner and
// rises without gaps, so a reader that reconnects knows what it missed.
type Event struct {
	Seq     int       `json:"seq"`
	Type    EventType `json:"type"`
	At      time.Time `json:"at"`
	Message string    `json:"message,omitempty"`
	// Data carries terminal bytes for output events, base64 over the wire.
	Data []byte `json:"data,omitempty"`
	// Offset is the byte position of Data within the run's recording.
	Offset   int64 `json:"offset,omitempty"`
	ExitCode *int  `json:"exitCode,omitempty"`
}

type Input struct {
	Data []byte `json:"data,omitempty"`
	Cols uint16 `json:"cols,omitempty"`
	Rows uint16 `json:"rows,omitempty"`
	Stop bool   `json:"stop,omitempty"`
}

type PendingInput struct {
	Input []Input `json:"input"`
}

// Outcome is what the agent said should happen to the task next. The runner
// carries it without reading anything into it: which stations exist, and what
// an unknown one means, are the control plane's business.
type Outcome struct {
	Next string `json:"next"`
	Note string `json:"note,omitempty"`
}

type Completion struct {
	ExitCode int      `json:"exitCode"`
	Failed   bool     `json:"failed"`
	Message  string   `json:"message,omitempty"`
	Outcome  *Outcome `json:"outcome,omitempty"`
}
