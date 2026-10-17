package session_test

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"usespotlight.ai/data-plane/protocol"
)

func searching(o *runOptions) {
	o.search = &protocol.SearchSpec{}
}

func calling(t *testing.T) string {
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
    await call("remember", { kind: "rationale", body: "Retry in the request." }),
    await call("recall", { words: "upload retries" }),
    await call("review-comment-replies", { handle: "R-1", body: "Done." }),
    await call("candidates", { name: "terse", hypothesis: "Shorter prompts finish sooner.", station: { prompt: "Be brief." } }),
    await call("causes", { taskId: "task_1", cause: "judge", evidence: "The rubric requires tests.", suggestion: "Drop that line." }),
  ];
  process.stdout.write(results.join("\n"));
})();
`
	if err := os.WriteFile(script, []byte(body), 0o644); err != nil {
		t.Fatal(err)
	}

	return harness(t, "output = execSync(\"node "+script+"\").toString();", "end_turn")
}

func TestASearchKeepsOutOfTheTeamsMemoryAndProposesCandidates(t *testing.T) {
	written := run(t, calling(t), searching)

	output := agentOutput(t, written)
	for _, want := range []string{
		"remember 422 a search may not propose a memory",
		"recall 422 a search may not recall what the team remembers",
		"review-comment-replies 422 a search may not reply to a review comment",
		`candidates 200 {"candidateId":"cand_1","name":"terse","replayId":"replay_1"}`,
		`causes 200 {"taskId":"task_1","cause":"judge","replayRunId":"replayed_1"}`,
	} {
		if !strings.Contains(output, want) {
			t.Errorf("the agent wrote %q, missing %q", output, want)
		}
	}

	spans := 0
	for _, event := range written.typed(protocol.EventSpan) {
		var span struct {
			Name       string `json:"name"`
			Attributes []struct {
				Key   string `json:"key"`
				Value struct {
					StringValue string `json:"stringValue"`
				} `json:"value"`
			} `json:"attributes"`
		}
		if err := json.Unmarshal(event.Data, &span); err != nil || span.Name != "spotlight.candidate" {
			continue
		}
		spans++
		attributes := map[string]string{}
		for _, each := range span.Attributes {
			attributes[each.Key] = each.Value.StringValue
		}
		if attributes["spotlight.candidate.name"] != "terse" || attributes["spotlight.candidate.id"] != "cand_1" ||
			attributes["spotlight.candidate.replay"] != "replay_1" {
			t.Errorf("the span has %v", attributes)
		}
	}
	if spans != 1 {
		t.Errorf("%d candidate spans in the journal, want 1", spans)
	}

	written.mu.Lock()
	defer written.mu.Unlock()

	if len(written.remembered) != 0 {
		t.Errorf("a search remembered %+v", written.remembered)
	}
	if len(written.proposed) != 1 || written.proposed[0].Name != "terse" ||
		string(written.proposed[0].Station) != `{"prompt":"Be brief."}` {
		t.Errorf("proposed %+v", written.proposed)
	}
	if len(written.caused) != 1 || written.caused[0] != (protocol.CauseRecord{
		TaskID: "task_1", Cause: "judge", Evidence: "The rubric requires tests.", Suggestion: "Drop that line.",
	}) {
		t.Errorf("caused %+v", written.caused)
	}
	if written.done == nil || written.done.Failed {
		t.Errorf("completion %+v", written.done)
	}
}

func TestOnlyASearchProposesCandidatesAndRecordsCauses(t *testing.T) {
	written := run(t, calling(t))

	output := agentOutput(t, written)
	for _, want := range []string{
		"candidates 501 this run cannot propose a candidate",
		"causes 501 this run cannot record a cause",
	} {
		if !strings.Contains(output, want) {
			t.Errorf("the agent wrote %q, missing %q", output, want)
		}
	}

	written.mu.Lock()
	defer written.mu.Unlock()

	if len(written.proposed) != 0 || len(written.caused) != 0 {
		t.Errorf("a station run proposed %+v and caused %+v", written.proposed, written.caused)
	}
}

func TestASearchChecksNothingOut(t *testing.T) {
	written := run(t, harness(t, `output = require("node:fs").readdirSync(".").filter((name) => !name.startsWith(".")).join(",");`, "end_turn"),
		searching, func(o *runOptions) {
			o.checkouts = []protocol.Checkout{{Remote: "/nowhere/at/all.git", Path: "api", Branch: "main"}}
		})

	if output := agentOutput(t, written); output != "" {
		t.Errorf("the search's workspace contains %q", output)
	}
	if got := step(t, written, "prepare"); got != "" {
		t.Errorf("the search prepared %q", got)
	}
	if written.done == nil || written.done.Failed {
		t.Errorf("completion %+v", written.done)
	}
}

func TestASearchFindsNoneOfTheTeamsMemoryInItsWorkspace(t *testing.T) {
	root := t.TempDir()
	stale := filepath.Join(root, ".spotlight/memory/team/M-1.md")
	if err := os.MkdirAll(filepath.Dir(stale), 0o700); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(stale, []byte("left by an earlier run"), 0o600); err != nil {
		t.Fatal(err)
	}

	written := run(t, harness(t, `output = String(require("node:fs").existsSync(".spotlight/memory"));`, "end_turn"),
		searching, func(o *runOptions) {
			o.root = root
			o.continuity = protocol.Continuity{Key: "search_1"}
			o.memory = []protocol.MemoryFile{{Path: ".spotlight/memory/team/M-2.md", Body: "# M-2 · rationale"}}
		})

	if output := agentOutput(t, written); output != "false" {
		t.Errorf("the search found the memory folder: %q", output)
	}
}

func TestASearchRestoresNoWorkspaceAndArchivesNone(t *testing.T) {
	archives := newArchives(t)

	run(t, harness(t, `require("node:fs").writeFileSync("notes.md", "halfway"); output = "wrote";`, "end_turn"),
		func(o *runOptions) {
			o.archives = archives
			o.continuity = protocol.Continuity{Key: carriedOn}
		})

	searched := run(t, harness(t, `output = String(require("node:fs").existsSync("notes.md"));`, "end_turn"),
		searching, func(o *runOptions) {
			o.archives = archives
			o.continuity = protocol.Continuity{Key: carriedOn}
		})

	if got := agentOutput(t, searched); got != "false" {
		t.Errorf("the search found notes.md: %q", got)
	}
	if got := step(t, searched, "restore"); got != "" {
		t.Errorf("the search said %q about restoring", got)
	}
	if got := step(t, searched, "archive"); got != "" {
		t.Errorf("the search said %q about archiving its workspace", got)
	}
	if archives.count() != 1 {
		t.Errorf("%d archives stored, want only the station run's", archives.count())
	}
}

func TestASearchIsHandedNoSkillsOrHarnessFiles(t *testing.T) {
	root := t.TempDir()
	preserved := filepath.Join(root, "claude", "settings.json")
	if err := os.MkdirAll(filepath.Dir(preserved), 0o700); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(preserved, []byte(`{"left":"alone"}`), 0o600); err != nil {
		t.Fatal(err)
	}

	written := run(t, harness(t, `const fs = require("node:fs");
output = JSON.stringify([
  fs.existsSync(".claude/skills/review/SKILL.md"),
  fs.existsSync(".claude/CLAUDE.md"),
  fs.readFileSync("claude/settings.json", "utf8"),
]);`, "end_turn"), searching, func(o *runOptions) {
		o.root = root
		o.continuity = protocol.Continuity{Key: "search_1"}
		o.skills = []protocol.SkillFile{{Path: ".claude/skills/review/SKILL.md", Text: "how to review"}}
		o.settings = []string{"claude/settings.json"}
		o.setup = protocol.HarnessSetup{Files: []protocol.SetupFile{{Path: ".claude/CLAUDE.md", Text: "be brief"}}}
	})

	if output := agentOutput(t, written); output != `[false,false,"{\"left\":\"alone\"}"]` {
		t.Errorf("the search found %s", output)
	}
}
