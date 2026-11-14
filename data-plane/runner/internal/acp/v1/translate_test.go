package v1

import (
	"encoding/json"
	"testing"

	"usespotlight.ai/data-plane/protocol"
)

func translated(t *testing.T, tr *translator, frames ...string) []protocol.Event {
	t.Helper()

	var events []protocol.Event
	for _, frame := range frames {
		events = append(events, tr.translate(json.RawMessage(frame))...)
	}
	return events
}

func toolIn(t *testing.T, event protocol.Event) protocol.ToolChanged {
	t.Helper()

	var call protocol.ToolChanged
	if event.Type != protocol.EventToolChanged || json.Unmarshal(event.Data, &call) != nil {
		t.Fatalf("not a tool change: %s %s", event.Type, event.Data)
	}
	return call
}

func messageIn(t *testing.T, event protocol.Event) protocol.AgentMessage {
	t.Helper()

	var message protocol.AgentMessage
	if event.Type != protocol.EventMessage || json.Unmarshal(event.Data, &message) != nil {
		t.Fatalf("not a message: %s %s", event.Type, event.Data)
	}
	return message
}

func opened() *translator {
	tr := newTranslator()
	tr.opened("root")
	return tr
}

func TestNamesAnMcpToolOfAnotherServerAsItIs(t *testing.T) {
	events := translated(t, opened(),
		`{"sessionId":"root","update":{"sessionUpdate":"tool_call","toolCallId":"a","title":"create_issue","_meta":{"claudeCode":{"toolName":"mcp__linear__create_issue"}}}}`,
		`{"sessionId":"root","update":{"sessionUpdate":"tool_call","toolCallId":"b","title":"Grep","_meta":{"claudeCode":{"toolName":"mcp__acp__Grep"}}}}`,
	)

	if name := toolIn(t, events[0]).Name; name != "mcp__linear__create_issue" {
		t.Errorf("named %q", name)
	}
	if name := toolIn(t, events[1]).Name; name != "mcp__acp__Grep" {
		t.Errorf("named a tool the bridge does not serve %q", name)
	}
}

func TestPassesOverAnUpdateToACallItNeverSaw(t *testing.T) {
	events := translated(t, opened(),
		`{"sessionId":"root","update":{"sessionUpdate":"tool_call_update","toolCallId":"late","status":"completed","title":"Read"}}`,
	)

	if len(events) != 0 {
		t.Errorf("translated %v", events)
	}
}

func TestATurnLimitCutsTheTurnShort(t *testing.T) {
	if stop := StopOf("max_turn_requests"); stop != protocol.TurnStopCutShort {
		t.Errorf("stopped %q", stop)
	}
}

func TestAToolCallKeepsWhatEarlierUpdatesSaid(t *testing.T) {
	events := translated(t, opened(),
		`{"sessionId":"root","update":{"sessionUpdate":"tool_call","toolCallId":"a","title":"Read","kind":"read","rawInput":{"path":"x"}}}`,
		`{"sessionId":"root","update":{"sessionUpdate":"tool_call_update","toolCallId":"a","status":"completed"}}`,
	)

	call := toolIn(t, events[1])
	if call.Kind != "read" || string(call.Input) != `{"path":"x"}` || call.Status != protocol.ToolCompleted {
		t.Errorf("the second change is %+v", call)
	}
}

func TestAMessageAfterAToolCallIsANewMessage(t *testing.T) {
	tr := opened()
	events := translated(t, tr,
		`{"sessionId":"root","update":{"sessionUpdate":"agent_message_chunk","content":{"type":"text","text":"one"}}}`,
		`{"sessionId":"root","update":{"sessionUpdate":"tool_call","toolCallId":"a","title":"Read"}}`,
		`{"sessionId":"root","update":{"sessionUpdate":"agent_message_chunk","content":{"type":"text","text":"two"}}}`,
	)
	tr.turned()
	events = append(events, translated(t, tr,
		`{"sessionId":"root","update":{"sessionUpdate":"agent_message_chunk","content":{"type":"text","text":"three"}}}`,
	)...)

	first, second, third := messageIn(t, events[0]), messageIn(t, events[2]), messageIn(t, events[3])
	if first.ID == second.ID || second.ID == third.ID {
		t.Errorf("ids %q, %q, %q", first.ID, second.ID, third.ID)
	}
}

func TestWhatAChildSaysIsInTheChildsSession(t *testing.T) {
	events := translated(t, opened(),
		`{"sessionId":"child","update":{"sessionUpdate":"agent_message_chunk","content":{"type":"text","text":"found it"}}}`,
		`{"sessionId":"root","update":{"sessionUpdate":"agent_message_chunk","content":{"type":"text","text":"thanks"}}}`,
	)

	if session := messageIn(t, events[0]).Session; session != "child" {
		t.Errorf("the child spoke in %q", session)
	}
	if session := messageIn(t, events[1]).Session; session != "" {
		t.Errorf("the root spoke in %q", session)
	}
}

func TestAChildThatStopsOnAnErrorFailed(t *testing.T) {
	events := translated(t, opened(),
		`{"sessionId":"root","update":{"sessionUpdate":"subagent_update","sessionId":"child","state":{"state":"idle","stopReason":"error"}}}`,
	)

	var changed protocol.ChildChanged
	_ = json.Unmarshal(events[0].Data, &changed)
	if changed.Child != "child" || changed.State != protocol.SessionIdle || changed.Stop != protocol.TurnStopFailed {
		t.Errorf("changed %+v", changed)
	}
}

func TestLeavesOutWhatItDoesNotKnow(t *testing.T) {
	events := translated(t, opened(),
		`{"sessionId":"root","update":{"sessionUpdate":"available_commands_update","availableCommands":[]}}`,
		`{"sessionId":"root","update":{"sessionUpdate":"agent_message_chunk","content":{"type":"image","data":"…"}}}`,
		`not json`,
	)

	if len(events) != 0 {
		t.Errorf("translated %v", events)
	}
}

func TestNamesTheBridgesFileToolsAsTheHarnessesOwn(t *testing.T) {
	events := translated(t, opened(),
		`{"sessionId":"root","update":{"sessionUpdate":"tool_call","toolCallId":"a","title":"Read","_meta":{"claudeCode":{"toolName":"mcp__acp__Read"}}}}`,
	)

	if name := toolIn(t, events[0]).Name; name != "Read" {
		t.Errorf("named %q", name)
	}
}

func TestTwoStartsOfOneCallAreOneCall(t *testing.T) {
	tr := opened()
	translated(t, tr,
		`{"sessionId":"root","update":{"sessionUpdate":"tool_call","toolCallId":"a","title":"Read","kind":"read"}}`,
		`{"sessionId":"root","update":{"sessionUpdate":"tool_call","toolCallId":"a","status":"in_progress"}}`,
	)

	if len(tr.tools) != 1 || tr.tools["\x00a"].Kind != "read" || tr.tools["\x00a"].Status != protocol.ToolRunning {
		t.Errorf("calls %+v", tr.tools)
	}
}

func TestADiffWithoutAPathChangesNoFile(t *testing.T) {
	events := translated(t, opened(),
		`{"sessionId":"root","update":{"sessionUpdate":"tool_call","toolCallId":"a","title":"Edit","content":[{"type":"diff","newText":"x"}]}}`,
	)

	if files := toolIn(t, events[0]).Files; len(files) != 0 {
		t.Errorf("changed %+v", files)
	}
}

func TestJoinsTheTextOfEachBlockOfAToolsOutput(t *testing.T) {
	events := translated(t, opened(),
		`{"sessionId":"root","update":{"sessionUpdate":"tool_call","toolCallId":"a","title":"Bash","content":[`+
			`{"type":"content","content":{"type":"text","text":"one"}},{"type":"content","content":{"type":"text","text":"two"}}]}}`,
	)

	var output protocol.ToolOutput
	if len(events) != 2 || json.Unmarshal(events[1].Data, &output) != nil || output.Text != "one\ntwo" || !output.Replace {
		t.Errorf("translated %v", events)
	}
}
