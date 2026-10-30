package session

import (
	"fmt"
	"log/slog"
)

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
	Errored
)

var transitions = map[State]map[Trigger]State{
	Preparing: {
		WorkspaceReady: Preparing,
		AgentStarted:   Running,
		Errored:        Failed,
	},
	Running: {
		AgentExited: Draining,
		Errored:     Failed,
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
	case Draining:
		return "draining"
	case Completed:
		return "completed"
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
	case AgentExited:
		return "exited"
	case Drained:
		return "drained"
	case Errored:
		return "failed"
	}
	return "unknown"
}
