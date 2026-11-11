//go:build live

package session_test

import (
	"encoding/json"
	"log/slog"
	"os"
	"path/filepath"
	"testing"
	"time"

	"usespotlight.ai/data-plane/protocol"
)

const handOverByCurl = "curl -s -X POST \"$SPOTLIGHT_AGENT_API_URL\" -H \"Authorization: Bearer $SPOTLIGHT_AGENT_API_TOKEN\" -d '{\"next\":\"review\",\"note\":\"NOTE\"}'"

func live(t *testing.T, name, briefing string, wait time.Duration) *journal {
	t.Helper()

	adapter := os.Getenv("LIVE_ACP")
	if adapter == "" {
		t.Skip("LIVE_ACP names the claude-agent-acp executable")
	}

	written := run(t, adapter, func(o *runOptions) {
		o.briefing = briefing
		o.handover = []string{"code-review", "review"}
		o.wait = wait
		o.decision = protocol.PermissionAllow
		o.log = slog.New(slog.NewTextHandler(os.Stderr, nil))
		o.env = map[string]string{"CLAUDE_CODE_EXECUTABLE": os.Getenv("LIVE_CLAUDE")}
		o.setup = protocol.HarnessSetup{Session: json.RawMessage(`{"claudeCode":{"emitRawSDKMessages":[` +
			`{"type":"system","subtype":"session_state_changed"},` +
			`{"type":"system","subtype":"background_tasks_changed"}]}}`)}
	})

	raw, _ := json.MarshalIndent(written.events, "", " ")
	out := filepath.Join(os.Getenv("LIVE_OUT"), name+".json")
	if err := os.WriteFile(out, raw, 0o644); err != nil {
		t.Fatal(err)
	}
	for _, kind := range []protocol.EventType{
		protocol.EventHarnessConnected, protocol.EventBackgroundWait, protocol.EventBackgroundDone,
		protocol.EventAgentReminded, protocol.EventBackgroundLost,
	} {
		for _, event := range written.typed(kind) {
			t.Logf("%s %s %s", kind, event.Message, event.Data)
		}
	}
	t.Logf("handover %+v failed=%v", written.done.Handover, written.done.Failed)
	return written
}

func TestLiveBackgroundCommandWakesTheAgent(t *testing.T) {
	written := live(t, "command",
		"This is a test of background work. Do exactly this: run the shell command `sleep 40 && echo finished-sleeping` "+
			"with the Bash tool's run_in_background option. Do not wait for it, do not poll it, do not sleep. "+
			"End your turn at once, with no handover. Later, when you are told the command finished, hand over by running: "+
			handOverByCurl, 5*time.Minute)

	if len(written.typed(protocol.EventBackgroundWait)) == 0 {
		t.Error("the run did not wait for the background command")
	}
	if written.done.Handover == nil {
		t.Error("no handover")
	}
}

func TestLiveMonitorWakesTheAgent(t *testing.T) {
	written := live(t, "monitor",
		"This is a test of background work. Do exactly this: start `sleep 30; echo READY > ready.txt` with the Bash tool's "+
			"run_in_background option, then use the Monitor tool to watch until ready.txt exists. "+
			"End your turn at once, with no handover. When the monitor tells you the file exists, hand over by running: "+
			handOverByCurl, 5*time.Minute)

	if written.done.Handover == nil {
		t.Error("no handover")
	}
}

func TestLiveBackgroundSubagent(t *testing.T) {
	written := live(t, "subagent",
		"This is a test of subagents. Use the Agent tool with run_in_background set to true to start one general-purpose "+
			"subagent with this task: \"Run `sleep 30` with Bash, then answer with the words: sub done\". "+
			"End your turn at once, with no handover. When the subagent reports back, hand over by running: "+
			handOverByCurl, 5*time.Minute)

	if written.done.Handover == nil {
		t.Error("no handover")
	}
}

func TestLiveWorkStillRunningAtTheLimit(t *testing.T) {
	written := live(t, "limit",
		"This is a test of background work. Run `sleep 600` with the Bash tool's run_in_background option. "+
			"Do not wait for it. End your turn at once, with no handover. If you are reminded about a handover, "+
			"reply with one short sentence and end your turn again without handing over.", 45*time.Second)

	if len(written.typed(protocol.EventAgentReminded)) != 1 {
		t.Error("no single reminder")
	}
	if len(written.typed(protocol.EventBackgroundLost)) != 1 {
		t.Error("no lost background work")
	}
}
