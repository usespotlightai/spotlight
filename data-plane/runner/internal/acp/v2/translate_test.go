package v2

import (
	"encoding/base64"
	"encoding/json"
	"reflect"
	"testing"

	"usespotlight.ai/data-plane/protocol"
)

func translated(t *testing.T, updates ...string) []protocol.Event {
	t.Helper()

	reading := newTranslator()
	reading.opened("root")

	var events []protocol.Event
	for _, each := range updates {
		events = append(events, reading.translate("root", json.RawMessage(each))...)
	}
	return events
}

func last[T any](t *testing.T, events []protocol.Event, kind protocol.EventType) T {
	t.Helper()

	var found T
	seen := false
	for _, event := range events {
		if event.Type == kind {
			var fresh T
			found = fresh
			if err := json.Unmarshal(event.Data, &found); err != nil {
				t.Fatal(err)
			}
			seen = true
		}
	}
	if !seen {
		t.Fatalf("no %s in %v", kind, events)
	}
	return found
}

func TestReadsAnItemPlanAndItsRemoval(t *testing.T) {
	plan := `{"sessionUpdate":"plan_update","plan":{"type":"items","planId":"p1","entries":[
		{"content":"Reproduce","priority":"high","status":"completed"},
		{"content":"Fix","priority":"medium","status":"in_progress"}]}}`

	changed := last[protocol.PlanChanged](t, translated(t, plan), protocol.EventPlanChanged)
	if len(changed.Entries) != 2 || changed.Entries[1].Status != "in_progress" {
		t.Fatalf("planned %+v", changed)
	}

	removed := last[protocol.PlanChanged](t, translated(t, plan, `{"sessionUpdate":"plan_removed","planId":"p1"}`), protocol.EventPlanChanged)
	if len(removed.Entries) != 0 {
		t.Fatalf("after the removal %+v", removed)
	}
}

func TestReadsAMoveAndItsPatch(t *testing.T) {
	call := last[protocol.ToolChanged](t, translated(t,
		`{"sessionUpdate":"tool_call_update","toolCallId":"c1","name":"Move","kind":"move","status":"completed",
		  "content":[{"type":"diff","changes":[{"operation":"move","oldPath":"/work/a.ts","path":"/work/b.ts"}],
		              "patch":{"format":"git_patch","text":"rename from a.ts\nrename to b.ts\n"}}]}`,
	), protocol.EventToolChanged)

	want := []protocol.FileChange{{Path: "/work/b.ts", OldPath: "/work/a.ts", Operation: protocol.FileMoved}}
	if !reflect.DeepEqual(call.Files, want) || call.Patch != "rename from a.ts\nrename to b.ts\n" {
		t.Fatalf("read the move as %+v", call)
	}
}

func TestReadsWhatEachFileWasAndBecameFromThePatch(t *testing.T) {
	patch := "diff --git a/src/a.ts b/src/a.ts\n--- a/src/a.ts\n+++ b/src/a.ts\n@@ -1,3 +1,3 @@\n keep\n-old\n+new\n tail\n" +
		"diff --git /work/notes.md /work/notes.md\nnew file mode 100644\n--- /dev/null\n+++ /work/notes.md\n@@ -0,0 +1 @@\n+one\n\\ No newline at end of file\n"
	content, _ := json.Marshal([]map[string]any{{
		"type": "diff",
		"changes": []map[string]string{
			{"operation": "modify", "path": "/work/src/a.ts"},
			{"operation": "add", "path": "/work/notes.md"},
		},
		"patch": map[string]string{"format": "git_patch", "text": patch},
	}})

	call := last[protocol.ToolChanged](t, translated(t,
		`{"sessionUpdate":"tool_call_update","toolCallId":"c1","kind":"edit","status":"completed","content":`+string(content)+`}`,
	), protocol.EventToolChanged)

	sidesOf := func(file protocol.FileChange) [2]string {
		if file.Before == nil || file.After == nil {
			t.Fatalf("no sides for %s", file.Path)
		}
		return [2]string{*file.Before, *file.After}
	}
	if got := sidesOf(call.Files[0]); got != [2]string{"keep\nold\ntail", "keep\nnew\ntail"} {
		t.Fatalf("read the edit as %q", got)
	}
	if got := sidesOf(call.Files[1]); got != [2]string{"", "one"} {
		t.Fatalf("read the new file as %q", got)
	}
}

func TestKeepsWhatAToolCallHadWhenAPatchLeavesItOut(t *testing.T) {
	call := last[protocol.ToolChanged](t, translated(t,
		`{"sessionUpdate":"tool_call_update","toolCallId":"c1","name":"Read","title":"Read a.ts","kind":"read","rawInput":{"path":"a.ts"}}`,
		`{"sessionUpdate":"tool_call_update","toolCallId":"c1","status":"completed"}`,
	), protocol.EventToolChanged)

	if call.Name != "Read" || call.Title != "Read a.ts" || call.Kind != "read" || string(call.Input) != `{"path":"a.ts"}` ||
		call.Status != protocol.ToolCompleted {
		t.Fatalf("after the patch %+v", call)
	}
}

func TestAddsTerminalChunksToWhatTheCommandPrinted(t *testing.T) {
	chunk := func(text string) string {
		return `{"sessionUpdate":"terminal_output_chunk","terminalId":"t1","data":"` + base64.StdEncoding.EncodeToString([]byte(text)) + `"}`
	}

	events := translated(t,
		`{"sessionUpdate":"terminal_update","terminalId":"t1","command":"npm test"}`,
		`{"sessionUpdate":"tool_call_update","toolCallId":"c1","kind":"execute","content":[{"type":"terminal","terminalId":"t1"}]}`,
		chunk("3 passed\n"),
		chunk("4 passed\n"),
	)

	var printed []protocol.ToolOutput
	for _, event := range events {
		if event.Type == protocol.EventToolOutput {
			var output protocol.ToolOutput
			_ = json.Unmarshal(event.Data, &output)
			printed = append(printed, output)
		}
	}
	want := []protocol.ToolOutput{{ID: "c1", Text: "3 passed\n"}, {ID: "c1", Text: "4 passed\n"}}
	if !reflect.DeepEqual(printed, want) {
		t.Fatalf("printed %+v", printed)
	}
}

func TestShowsOutputPrintedBeforeTheToolCallNamedItsTerminal(t *testing.T) {
	output := last[protocol.ToolOutput](t, translated(t,
		`{"sessionUpdate":"terminal_update","terminalId":"t1","output":{"data":"`+base64.StdEncoding.EncodeToString([]byte("ready"))+`"}}`,
		`{"sessionUpdate":"tool_call_update","toolCallId":"c1","content":[{"type":"terminal","terminalId":"t1"}]}`,
	), protocol.EventToolOutput)

	if output.ID != "c1" || output.Text != "ready" || !output.Replace {
		t.Fatalf("printed %+v", output)
	}
}

func TestAWholeMessageReplacesItsChunks(t *testing.T) {
	message := last[protocol.AgentMessage](t, translated(t,
		`{"sessionUpdate":"agent_message_chunk","messageId":"m1","content":{"type":"text","text":"draft"}}`,
		`{"sessionUpdate":"agent_message","messageId":"m1","content":[{"type":"text","text":"Final answer."}]}`,
	), protocol.EventMessage)

	if message.ID != "m1" || message.Text != "Final answer." || !message.Replace {
		t.Fatalf("said %+v", message)
	}
}

func TestReadsEachMessageBetweenSessionsOnce(t *testing.T) {
	reading := newTranslator()
	reading.opened("root")

	out := `{"sessionUpdate":"session_message","messageId":"x","senderSessionId":"root","recipientSessionId":"child","content":[{"type":"text","text":"Find the flaky test."}]}`
	in := `{"sessionUpdate":"session_message","messageId":"x","senderSessionId":"root","recipientSessionId":"child","content":[{"type":"text","text":"Find the flaky test."}]}`

	events := append(reading.translate("root", json.RawMessage(out)), reading.translate("child", json.RawMessage(in))...)
	if len(events) != 1 {
		t.Fatalf("read %d messages", len(events))
	}
}

func TestNamesBackgroundWorkByWhatItIs(t *testing.T) {
	reading := newTranslator()
	reading.opened("root")
	for _, each := range []string{
		`{"sessionUpdate":"terminal_update","terminalId":"t1","command":"sleep 20"}`,
		`{"sessionUpdate":"subagent_update","sessionId":"s1","title":"Find the flaky test"}`,
		`{"sessionUpdate":"tool_call_update","toolCallId":"c1","title":"Watch the deploy"}`,
	} {
		reading.translate("root", json.RawMessage(each))
	}

	tasks := reading.backgroundOf([]background{
		{Type: "terminal", TerminalID: "t1"},
		{Type: "subagent", SessionID: "s1"},
		{Type: "tool_call", ToolCallID: "c1"},
	})
	want := []protocol.BackgroundTask{
		{ID: "t1", Kind: protocol.BackgroundCommand, Description: "sleep 20"},
		{ID: "s1", Kind: protocol.BackgroundSubagent, Description: "Find the flaky test"},
		{ID: "c1", Kind: protocol.BackgroundOther, Description: "Watch the deploy"},
	}
	if !reflect.DeepEqual(tasks, want) {
		t.Fatalf("named %+v", tasks)
	}
}

func TestKeepsACharacterThatTwoChunksSplit(t *testing.T) {
	euro := []byte("€")
	chunk := func(raw []byte) string {
		return `{"sessionUpdate":"terminal_output_chunk","terminalId":"t1","data":"` + base64.StdEncoding.EncodeToString(raw) + `"}`
	}

	events := translated(t,
		`{"sessionUpdate":"tool_call_update","toolCallId":"c1","kind":"execute","content":[{"type":"terminal","terminalId":"t1"}]}`,
		chunk(append([]byte("cost "), euro[:2]...)),
		chunk(append(euro[2:], []byte("5\n")...)),
	)

	var printed string
	for _, event := range events {
		if event.Type == protocol.EventToolOutput {
			var output protocol.ToolOutput
			_ = json.Unmarshal(event.Data, &output)
			printed += output.Text
		}
	}
	if printed != "cost €5\n" {
		t.Fatalf("printed %q", printed)
	}
}

func TestClearsWhatACommandPrintedWhenItsOutputIsReplacedWithNothing(t *testing.T) {
	output := last[protocol.ToolOutput](t, translated(t,
		`{"sessionUpdate":"tool_call_update","toolCallId":"c1","content":[{"type":"terminal","terminalId":"t1"}]}`,
		`{"sessionUpdate":"terminal_update","terminalId":"t1","output":{"data":"`+base64.StdEncoding.EncodeToString([]byte("old"))+`"}}`,
		`{"sessionUpdate":"terminal_update","terminalId":"t1","output":{"data":""}}`,
	), protocol.EventToolOutput)

	if output.Text != "" || !output.Replace {
		t.Fatalf("printed %+v", output)
	}
}

func TestDropsARepeatedAnswerThatComesInPieces(t *testing.T) {
	reading := newTranslator()
	reading.opened("root")
	reading.translate("root", json.RawMessage(`{"sessionUpdate":"agent_message_chunk","messageId":"m1","content":{"type":"text","text":"finished banana"}}`))

	var kept []protocol.Event
	for _, piece := range []string{"finished ", "banana"} {
		raw := json.RawMessage(`{"sessionUpdate":"agent_message_chunk","messageId":"m2","content":{"type":"text","text":"` + piece + `"}}`)
		if events, dropped := reading.unrepeated(raw); !dropped {
			kept = append(kept, append(events, reading.translate("root", raw)...)...)
		}
	}
	if len(kept) != 0 {
		t.Fatalf("kept %v", kept)
	}
}

func TestKeepsANewAnswerThatStartsLikeTheLastOne(t *testing.T) {
	reading := newTranslator()
	reading.opened("root")
	reading.translate("root", json.RawMessage(`{"sessionUpdate":"agent_message_chunk","messageId":"m1","content":{"type":"text","text":"finished banana"}}`))

	var said string
	for _, piece := range []string{"finished ", "cherry"} {
		raw := json.RawMessage(`{"sessionUpdate":"agent_message_chunk","messageId":"m2","content":{"type":"text","text":"` + piece + `"}}`)
		events, dropped := reading.unrepeated(raw)
		if !dropped {
			events = append(events, reading.translate("root", raw)...)
		}
		for _, event := range events {
			var message protocol.AgentMessage
			_ = json.Unmarshal(event.Data, &message)
			said += message.Text
		}
	}
	if said != "finished cherry" {
		t.Fatalf("said %q", said)
	}
}

func TestForgetsWhatAFinishedToolCallReadAndWroteButNotItsName(t *testing.T) {
	reading := newTranslator()
	reading.opened("root")
	for _, each := range []string{
		`{"sessionUpdate":"tool_call_update","toolCallId":"c1","name":"Read","title":"Read a.ts","kind":"read","rawInput":{"path":"a.ts"},"content":[{"type":"terminal","terminalId":"t1"}]}`,
		`{"sessionUpdate":"terminal_output_chunk","terminalId":"t1","data":"` + base64.StdEncoding.EncodeToString([]byte("a long file")) + `"}`,
		`{"sessionUpdate":"tool_call_update","toolCallId":"c1","status":"completed","rawOutput":"a long file"}`,
	} {
		reading.translate("root", json.RawMessage(each))
	}

	kept := reading.tools["\x00c1"]
	if kept.Input != nil || kept.Output != nil || reading.terminals["\x00t1"].output != "" {
		t.Fatalf("kept %+v and %q", kept, reading.terminals["\x00t1"].output)
	}

	late := last[protocol.ToolChanged](t, reading.translate("root", json.RawMessage(`{"sessionUpdate":"tool_call_update","toolCallId":"c1","status":"completed"}`)), protocol.EventToolChanged)
	if late.Name != "Read" || late.Title != "Read a.ts" || late.Kind != "read" {
		t.Fatalf("a late patch read as %+v", late)
	}
}
