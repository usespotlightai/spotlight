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
	Parked
	Failed
)

type Trigger int

const (
	WorkspaceReady Trigger = iota
	AgentStarted
	PersonAsked
	PersonAnswered
	RunParked
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
		PersonAsked: Waiting,
		AgentExited: Draining,
		WentWrong:   Failed,
	},
	Waiting: {
		PersonAnswered: Running,
		RunParked:      Parked,
		AgentExited:    Draining,
		WentWrong:      Failed,
	},
	Draining: {
		Drained:   Completed,
		WentWrong: Failed,
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
	case Parked:
		return "parked"
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
		return "given a workspace"
	case AgentStarted:
		return "started"
	case PersonAsked:
		return "put to a person"
	case PersonAnswered:
		return "answered"
	case RunParked:
		return "parked"
	case AgentExited:
		return "exited"
	case Drained:
		return "drained"
	case WentWrong:
		return "failed"
	}
	return "unknown"
}
