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

// Kept is which workspaces the control plane still wants this runner holding.
// Everything else under the workspace root has nothing left to resume, so the
// runner is free to dispose of it. Answered in full each time: a list of what
// remains is easier to be right about than a list of what changed.
type Kept struct {
	Keys []string `json:"keys"`
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
	// Briefing is the work itself, put to the agent as a prompt. It is not an
	// argument: how to start a harness and what to ask of it are different
	// things, and only the second changes per run.
	Briefing string   `json:"briefing,omitempty"`
	Handover Handover `json:"handover,omitzero"`
	// Continuity is how this run carries on from an earlier one. Absent, the
	// run is its own: a fresh directory and a fresh conversation.
	Continuity Continuity `json:"continuity,omitzero"`
}

// Continuity is what a run inherits from the one before it. Both halves are
// the control plane's to decide: a runner keeps no memory between runs and is
// told everything it needs, because the next run may fall to another one.
type Continuity struct {
	// Key names the directory this run works in, in place of the run id. Runs
	// that share it share a workspace, which is what a resumed session needs:
	// a harness finds its history under the directory it was working in.
	Key string `json:"key,omitempty"`
	// SessionID is the conversation an earlier run opened. Empty opens a new
	// one, and so does an id the harness turns out not to hold.
	SessionID string `json:"sessionId,omitempty"`
	// Keep leaves the workspace behind when the run ends, for the next run to
	// find. Disposal is otherwise the runner's habit.
	Keep bool `json:"keep,omitempty"`
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
	// Data carries one session update as the agent reported it, JSON, base64
	// over the wire. Kept whole: the journal records what was said, not what
	// the runner understood of it.
	Data     []byte `json:"data,omitempty"`
	ExitCode *int   `json:"exitCode,omitempty"`
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
	// SessionID is what the harness called this conversation. It is reported
	// rather than remembered: the runner that held it may not be the one asked
	// to carry on.
	SessionID string `json:"sessionId,omitempty"`
}

// Said is something a person typed at the agent while it was working. It is
// given to the harness when the turn it arrived during ends.
type Said struct {
	Position int    `json:"position"`
	Body     string `json:"body"`
}
