package session_test

import (
	"context"
	"io"
	"log/slog"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"testing"

	"usespotlight.ai/data-plane/protocol"
	"usespotlight.ai/data-plane/runner/internal/session"
)

func assisting(files map[string]string) func(*runOptions) {
	return func(o *runOptions) {
		o.assist = &protocol.AssistSpec{Purpose: "insights.judge", Files: files}
	}
}

func callingAll(t *testing.T, before string) string {
	t.Helper()

	script := filepath.Join(t.TempDir(), "call.js")
	body := `
const call = async (path, body) => {
  const answer = await fetch(process.env.SPOTLIGHT_AGENT_API_URL + path, {
    method: "POST",
    headers: { Authorization: "Bearer " + process.env.SPOTLIGHT_AGENT_API_TOKEN },
    body: JSON.stringify(body),
  });
  return path + " " + answer.status + " " + (await answer.text()).trim();
};
(async () => {
  const results = [
    ` + before + `
    await call("submit", { result: { verdict: "pass", reasons: ["The tests cover the retry."] } }),
    await call("decisions", { kind: "trade-off", title: "Retry in the client", why: "The queue has no backoff.", alternatives: ["Retry in the queue"], paths: [] }),
    await call("remember", { kind: "rationale", body: "Retry in the request." }),
    await call("recall", { words: "upload retries" }),
    await call("review-comment-replies", { handle: "R-1", body: "Done." }),
    await call("candidates", { name: "terse", hypothesis: "Shorter prompts finish sooner.", station: { prompt: "Be brief." } }),
    await call("causes", { taskId: "task_1", cause: "judge", evidence: "The rubric requires tests." }),
    await call("", { next: "done" }),
  ];
  process.stdout.write(results.join("\n"));
})();
`
	if err := os.WriteFile(script, []byte(body), 0o644); err != nil {
		t.Fatal(err)
	}

	return harness(t, "output = execSync(\"node "+script+"\").toString();", "end_turn")
}

func TestAnAssistSessionSubmitsOneResultAndDoesNothingElse(t *testing.T) {
	written := run(t, callingAll(t, ""), assisting(map[string]string{"diff.md": "the diff"}), func(o *runOptions) {
		o.handover = []string{"done"}
	})

	output := agentOutput(t, written)
	for _, want := range []string{
		`submit 200 {"accepted":true}`,
		"decisions 422 an assist session may not record a decision",
		"remember 422 an assist session may not propose a memory",
		"recall 422 an assist session may not recall what the team remembers",
		"review-comment-replies 422 an assist session may not reply to a review comment",
		"candidates 422 an assist session may not propose a candidate",
		"causes 422 an assist session may not record a cause",
		" 422 an assist session may not hand over: it reads the files in .spotlight/assist and submits one result with spotlight submit",
	} {
		if !strings.Contains(output, want) {
			t.Errorf("the agent wrote %q, missing %q", output, want)
		}
	}

	written.mu.Lock()
	defer written.mu.Unlock()

	if len(written.submitted) != 1 || string(written.submitted[0]) != `{"verdict":"pass","reasons":["The tests cover the retry."]}` {
		t.Errorf("submitted %q", written.submitted)
	}
	if len(written.decided) != 0 || len(written.remembered) != 0 || len(written.proposed) != 0 || len(written.caused) != 0 {
		t.Errorf("an assist session decided %+v, remembered %+v, proposed %+v and caused %+v",
			written.decided, written.remembered, written.proposed, written.caused)
	}
	if written.done == nil || written.done.Failed {
		t.Errorf("completion %+v", written.done)
	}
}

func TestATaskRunRecordsDecisionsAndSubmitsNoResult(t *testing.T) {
	written := run(t, callingAll(t, `await call("decisions", { kind: "assumption", title: "Outside", why: "x", paths: ["/etc/passwd"] }),`))

	output := agentOutput(t, written)
	for _, want := range []string{
		"submit 501 this run cannot submit a result: only an assist session does",
		`decisions 200 {"recorded":1}`,
		"decisions 422 /etc/passwd is outside the repositories this run checked out",
	} {
		if !strings.Contains(output, want) {
			t.Errorf("the agent wrote %q, missing %q", output, want)
		}
	}

	written.mu.Lock()
	defer written.mu.Unlock()

	if len(written.submitted) != 0 {
		t.Errorf("a task run submitted %q", written.submitted)
	}
	want := protocol.ProposedDecision{
		Kind: "trade-off", Title: "Retry in the client", Why: "The queue has no backoff.",
		Alternatives: []string{"Retry in the queue"}, Paths: []string{},
	}
	if len(written.decided) != 1 || written.decided[0].Kind != want.Kind || written.decided[0].Title != want.Title ||
		written.decided[0].Why != want.Why || !slices.Equal(written.decided[0].Alternatives, want.Alternatives) ||
		written.decided[0].Paths == nil || len(written.decided[0].Paths) != 0 {
		t.Errorf("decided %+v", written.decided)
	}
}

func TestSearchesAndReplaysRecordNoDecision(t *testing.T) {
	for name, adjust := range map[string]func(*runOptions){
		"search": searching,
		"replay": func(o *runOptions) { o.replay = &protocol.Replay{} },
	} {
		t.Run(name, func(t *testing.T) {
			written := run(t, callingAll(t, ""), adjust)

			if output := agentOutput(t, written); !strings.Contains(output, "decisions 422 a "+name+" may not record a decision") {
				t.Errorf("the agent wrote %q", output)
			}
			written.mu.Lock()
			defer written.mu.Unlock()
			if len(written.decided) != 0 {
				t.Errorf("decided %+v", written.decided)
			}
		})
	}
}

func TestAnAssistSessionFindsItsFilesAndNoneOfTheTeamsSkillsOrMemory(t *testing.T) {
	root := t.TempDir()
	for path, text := range map[string]string{
		".spotlight/memory/team/M-1.md": "left by an earlier run",
		".spotlight/assist/stale.md":    "left by an earlier session",
		"claude/settings.json":          `{"left":"alone"}`,
	} {
		if err := os.MkdirAll(filepath.Dir(filepath.Join(root, path)), 0o700); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(filepath.Join(root, path), []byte(text), 0o600); err != nil {
			t.Fatal(err)
		}
	}

	written := run(t, harness(t, `const fs = require("node:fs");
output = JSON.stringify([
  fs.readFileSync(".spotlight/assist/diff.md", "utf8"),
  fs.readFileSync(".spotlight/assist/runs/run_1/journal.md", "utf8"),
  fs.existsSync(".spotlight/assist/stale.md"),
  fs.existsSync(".spotlight/memory"),
  fs.existsSync(".claude/skills/review/SKILL.md"),
  fs.existsSync(".claude/CLAUDE.md"),
  fs.readFileSync("claude/settings.json", "utf8"),
]);`, "end_turn"), assisting(map[string]string{
		"diff.md":                 "the diff",
		"runs/run_1/journal.md":   "the journal",
		"runs/../runs/notes.md":   "kept inside",
		"runs/run_1/../../top.md": "kept inside too",
	}), func(o *runOptions) {
		o.root = root
		o.resume = protocol.Resume{Key: "assist/assist_1"}
		o.memory = []protocol.MemoryFile{{Path: ".spotlight/memory/team/M-2.md", Body: "# M-2 · rationale"}}
		o.skills = []protocol.SkillFile{{Path: ".claude/skills/review/SKILL.md", Text: "how to review"}}
		o.settings = []string{"claude/settings.json"}
		o.setup = protocol.HarnessSetup{Files: []protocol.SetupFile{{Path: ".claude/CLAUDE.md", Text: "be brief"}}}
	})

	if output := agentOutput(t, written); output != `["the diff","the journal",false,false,false,false,"{\"left\":\"alone\"}"]` {
		t.Errorf("the assist session found %s", output)
	}
	if read, err := os.ReadFile(filepath.Join(root, ".spotlight/assist/top.md")); err != nil || string(read) != "kept inside too" {
		t.Errorf("top.md reads %q, %v", read, err)
	}
}

func TestAnAssistFileThatEscapesItsFolderFailsTheSetup(t *testing.T) {
	for _, name := range []string{"../notes.md", "../../outside.md", "/etc/passwd", "", "."} {
		t.Run(name, func(t *testing.T) {
			root := t.TempDir()
			written := &journal{}

			err := session.Execute(context.Background(), protocol.Run{
				ID: "run_1",
				Spec: protocol.Spec{
					Command: protocol.Command{Executable: harness(t, `output = "started";`, "end_turn")},
					Assist:  &protocol.AssistSpec{Purpose: "insights.judge", Files: map[string]string{name: "escaped"}},
				},
			}, session.Options{
				Workspace: root,
				Journal:   written,
				Log:       slog.New(slog.NewTextHandler(io.Discard, nil)),
			})

			if err == nil || !strings.Contains(err.Error(), "escapes .spotlight/assist") {
				t.Errorf("an escaping file said %v", err)
			}
			if output := agentOutput(t, written); output != "" {
				t.Errorf("the agent started and wrote %q", output)
			}
			if written.done == nil || !written.done.Failed {
				t.Errorf("completion %+v", written.done)
			}
			if _, err := os.Stat(filepath.Join(root, ".spotlight", "notes.md")); err == nil {
				t.Error("wrote a file outside the assist folder")
			}
		})
	}
}
