package session

import (
	"fmt"
	"log/slog"
)

type State int

const (
	Preparing State = iota
	Running
	Waiting
	Draining
	Completed
	Suspended
	Failed
)

type Trigger int

const (
	WorkspaceReady Trigger = iota
	AgentStarted
	PersonAsked
	PersonAnswered
	RunSuspended
	AgentExited
	Drained
	Errored
)

var transitions = map[State]map[Trigger]State{
	Preparing: {
		WorkspaceReady: Preparing,
		AgentStarted:   Running,
		Errored:        Failed,
	},
	Running: {
		PersonAsked: Waiting,
		AgentExited: Draining,
		Errored:     Failed,
	},
	Waiting: {
		PersonAnswered: Running,
		RunSuspended:   Suspended,
		AgentExited:    Draining,
		Errored:        Failed,
	},
	Draining: {
		Drained: Completed,
		Errored: Failed,
	},
}

func Next(from State, trigger Trigger) (State, error) {
	to, ok := transitions[from][trigger]
	if !ok {
		return from, fmt.Errorf("a run cannot be %s while %s", trigger, from)
	}
	return to, nil
}

func (s State) String() string {
	switch s {
	case Preparing:
		return "preparing"
	case Running:
		return "running"
	case Waiting:
		return "waiting"
	case Draining:
		return "draining"
	case Completed:
		return "completed"
	case Suspended:
		return "suspended"
	case Failed:
		return "failed"
	}
	return "unknown"
}

func (s State) LogValue() slog.Value {
	return slog.StringValue(s.String())
}

func (t Trigger) String() string {
	switch t {
	case WorkspaceReady:
		return "prepared"
	case AgentStarted:
		return "started"
	case PersonAsked:
		return "put to a person"
	case PersonAnswered:
		return "answered"
	case RunSuspended:
		return "suspended"
	case AgentExited:
		return "exited"
	case Drained:
		return "drained"
	case Errored:
		return "failed"
	}
	return "unknown"
}
