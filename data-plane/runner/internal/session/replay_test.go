package session_test

import (
	"context"
	"io"
	"log/slog"
	"strings"
	"testing"

	"usespotlight.ai/data-plane/protocol"
	"usespotlight.ai/data-plane/runner/internal/session"
)

func replaying(archive *string) func(*runOptions) {
	return func(o *runOptions) {
		o.resume = protocol.Resume{Key: "replay-run_1"}
		o.replay = &protocol.Replay{Archive: archive, Checkouts: []protocol.StartedCheckout{}}
	}
}

func TestAReplayRestoresTheArchiveItReplaysAndArchivesNoneOfItsOwn(t *testing.T) {
	archives := newArchives(t)

	run(t, harness(t, `require("node:fs").writeFileSync("notes.md", "halfway"); output = "wrote";`, "end_turn"),
		func(o *runOptions) {
			o.archives = archives
			o.resume = protocol.Resume{Key: resumeKey}
		})

	started := archives.newest().ID
	replayed := run(t, harness(t, `output = require("node:fs").readFileSync("notes.md", "utf8");`, "end_turn"),
		replaying(&started), func(o *runOptions) { o.archives = archives })

	if got := agentOutput(t, replayed); got != "halfway" {
		t.Errorf("the replay found %q in the workspace", got)
	}
	if got := step(t, replayed, "restore"); !strings.HasPrefix(got, "Restored the workspace the replayed run started from") {
		t.Errorf("the replay said %q about restoring", got)
	}
	if got := step(t, replayed, "archive"); got != "" {
		t.Errorf("the replay said %q about archiving its workspace", got)
	}
	if archives.count() != 1 {
		t.Errorf("%d archives were stored, want only the one the replay started from", archives.count())
	}
	if len(replayed.starts) != 0 {
		t.Errorf("the replay said where it started: %+v", replayed.starts)
	}
	if replayed.done == nil || replayed.done.Failed {
		t.Errorf("completion %+v", replayed.done)
	}
}

func TestAReplayThatStartedAfreshRestoresNothing(t *testing.T) {
	archives := newArchives(t)

	run(t, harness(t, `require("node:fs").writeFileSync("notes.md", "halfway"); output = "wrote";`, "end_turn"),
		func(o *runOptions) {
			o.archives = archives
			o.resume = protocol.Resume{Key: resumeKey}
		})

	replayed := run(t, harness(t, `output = String(require("node:fs").existsSync("notes.md"));`, "end_turn"),
		replaying(nil), func(o *runOptions) { o.archives = archives })

	if got := agentOutput(t, replayed); got != "false" {
		t.Errorf("a replay that started afresh found notes.md: %q", got)
	}
}

func TestAReplayWhoseArchiveIsGoneEndsFailedRatherThanStartingAfresh(t *testing.T) {
	archives := newArchives(t)
	gone := "archive_gone"
	written := &journal{archives: archives}

	err := session.Execute(context.Background(), protocol.Run{
		ID: "run_1",
		Spec: protocol.Spec{
			Command: protocol.Command{Executable: harness(t, `output = "worked";`, "end_turn")},
			Resume:  protocol.Resume{Key: "replay-run_1"},
			Replay:  &protocol.Replay{Archive: &gone},
		},
	}, session.Options{
		Workspace: t.TempDir(),
		Journal:   written,
		Log:       slog.New(slog.NewTextHandler(io.Discard, nil)),
	})

	if err == nil || !strings.Contains(err.Error(), gone) {
		t.Fatalf("a replay whose archive is gone said %v", err)
	}
	if written.done == nil || !written.done.Failed {
		t.Fatalf("completion %+v", written.done)
	}
}

func TestAReplayThatAsksAPersonEndsThere(t *testing.T) {
	written := run(t, permitting(t), replaying(nil), func(o *runOptions) {
		o.setup = protocol.HarnessSetup{AskKinds: []string{"execute"}}
		o.decision = protocol.PermissionEscalated
		o.messages = [][]protocol.Message{{{Position: 1, Body: "Go ahead."}}}
	})

	if output := agentOutput(t, written); output != "cancelled" {
		t.Errorf("the agent got %q", output)
	}
	if len(written.acked) != 0 {
		t.Errorf("the replay used the messages: acknowledged %v", written.acked)
	}
	if written.done == nil || written.done.Failed || written.done.Stopped {
		t.Fatalf("completion %+v", written.done)
	}
}

func TestAReplayRemembersNothing(t *testing.T) {
	remembering := `execSync(` + "`" +
		`node -e '
      const body = JSON.stringify({ kind: "rationale", body: "Retry in the request." });
      fetch(process.env.SPOTLIGHT_AGENT_API_URL + "remember", {
        method: "POST",
        headers: { Authorization: "Bearer " + process.env.SPOTLIGHT_AGENT_API_TOKEN },
        body,
      }).then((answer) => process.exit(answer.ok ? 0 : 1));
    '` + "`" + `); output = "remembered";`

	written := run(t, harness(t, remembering, "end_turn"), replaying(nil))

	written.mu.Lock()
	defer written.mu.Unlock()

	if len(written.remembered) != 0 {
		t.Errorf("a replay remembered %+v", written.remembered)
	}
}
