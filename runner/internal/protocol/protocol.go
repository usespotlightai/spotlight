// Package protocol holds the wire types shared with the control plane.
package protocol

import "time"

type Registration struct {
	Pool     string            `json:"pool"`
	Labels   map[string]string `json:"labels,omitempty"`
	Capacity int               `json:"capacity"`
}

type Registered struct {
	RunnerID string `json:"runnerId"`
}

// Checkout is one repository a run works in. A run may have several: an agent
// that cannot see the consumer cannot tell whether it broke it.
type Checkout struct {
	Remote string `json:"remote"`
	Ref    string `json:"ref"`
	Path   string `json:"path"`
	Branch string `json:"branch"`
}

// Command is the agent CLI to supervise. Which vendor it is amounts to this
// much difference, which is why the runner needs no per-vendor code.
type Command struct {
	Executable string            `json:"executable"`
	Args       []string          `json:"args,omitempty"`
	Env        map[string]string `json:"env,omitempty"`
}

// Spec is what a run is supposed to do. The control plane stores it whole and
// never looks inside: what a checkout means is the prepare hook's business,
// which is why this travels as one opaque object rather than as fields it
// would have to model.
type Spec struct {
	Checkouts []Checkout `json:"checkouts,omitempty"`
	Cwd       string     `json:"cwd,omitempty"`
	Command   Command    `json:"command"`
}

type Run struct {
	ID             string    `json:"id"`
	Spec           Spec      `json:"spec"`
	LeaseExpiresAt time.Time `json:"leaseExpiresAt"`
}

// EventType names what happened. The set is closed on purpose: anything the
// control plane cannot interpret is not worth sending.
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

type Completion struct {
	ExitCode int    `json:"exitCode"`
	Failed   bool   `json:"failed"`
	Message  string `json:"message,omitempty"`
}
