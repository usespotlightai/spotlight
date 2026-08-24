// Package session owns one run: from an empty directory to a finished agent.
package session

import (
	"fmt"
	"log/slog"
)

// State is where a run has got to. Separate from the work itself so the legal
// transitions can be stated once and tested without spawning anything.
type State int

const (
	Preparing State = iota
	Running
	Draining
	Completed
	Failed
)

type Trigger int

const (
	WorkspaceReady Trigger = iota
	AgentStarted
	AgentExited
	Drained
	WentWrong
)

var transitions = map[State]map[Trigger]State{
	Preparing: {
		WorkspaceReady: Preparing,
		AgentStarted:   Running,
		WentWrong:      Failed,
	},
	Running: {
		AgentExited: Draining,
		WentWrong:   Failed,
	},
	Draining: {
		Drained:   Completed,
		WentWrong: Failed,
	},
}

// Next reports the state a trigger leads to and refuses anything that cannot
// happen, so a bug that drains before running fails loudly.
func Next(from State, trigger Trigger) (State, error) {
	to, ok := transitions[from][trigger]
	if !ok {
		return from, fmt.Errorf("a run cannot be %s while %s", trigger, from)
	}
	return to, nil
}

func (s State) Terminal() bool {
	return s == Completed || s == Failed
}

func (s State) String() string {
	switch s {
	case Preparing:
		return "preparing"
	case Running:
		return "running"
	case Draining:
		return "draining"
	case Completed:
		return "completed"
	case Failed:
		return "failed"
	}
	return "unknown"
}

// LogValue keeps a state readable in logs. Without it slog renders the
// underlying integer.
func (s State) LogValue() slog.Value {
	return slog.StringValue(s.String())
}

func (t Trigger) String() string {
	switch t {
	case WorkspaceReady:
		return "given a workspace"
	case AgentStarted:
		return "started"
	case AgentExited:
		return "exited"
	case Drained:
		return "drained"
	case WentWrong:
		return "failed"
	}
	return "unknown"
}
