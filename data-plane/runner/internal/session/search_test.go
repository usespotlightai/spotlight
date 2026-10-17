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

func asking(t *testing.T) string {
	t.Helper()

	script := filepath.Join(t.TempDir(), "ask.js")
	body := `
const ask = async (path, body) => {
  const answer = await fetch(process.env.SPOTLIGHT_HANDOVER_URL + path, {
    method: "POST",
    headers: { Authorization: "Bearer " + process.env.SPOTLIGHT_HANDOVER_TOKEN },
    body: JSON.stringify(body),
  });
  return path + " " + answer.status + " " + (await answer.text()).trim();
};
(async () => {
  const said = [
    await ask("remember", { kind: "rationale", body: "Retry in the request." }),
    await ask("recall", { words: "upload retries" }),
    await ask("remark", { handle: "R-1", body: "Done." }),
    await ask("candidates", { name: "terse", hypothesis: "Shorter prompts finish sooner.", station: { prompt: "Be brief." } }),
    await ask("causes", { taskId: "task_1", cause: "judge", evidence: "The rubric asks for tests.", suggestion: "Drop that line." }),
  ];
  process.stdout.write(said.join("\n"));
})();
`
	if err := os.WriteFile(script, []byte(body), 0o644); err != nil {
		t.Fatal(err)
	}

	return harness(t, "said = execSync(\"node "+script+"\").toString();", "end_turn")
}

func TestASearchKeepsOutOfTheTeamsMemoryAndProposesCandidates(t *testing.T) {
	written := run(t, asking(t), searching)

	heard := said(t, written)
	for _, want := range []string{
		"remember 422 a search may not propose a memory",
		"recall 422 a search may not recall what the team remembers",
		"remark 422 a search may not answer a remark",
		`candidates 200 {"candidateId":"cand_1","name":"terse","replayId":"replay_1"}`,
		`causes 200 {"taskId":"task_1","cause":"judge","replayRunId":"replayed_1"}`,
	} {
		if !strings.Contains(heard, want) {
			t.Errorf("the agent heard %q, missing %q", heard, want)
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
		said := map[string]string{}
		for _, each := range span.Attributes {
			said[each.Key] = each.Value.StringValue
		}
		if said["spotlight.candidate.name"] != "terse" || said["spotlight.candidate.id"] != "cand_1" ||
			said["spotlight.candidate.replay"] != "replay_1" {
			t.Errorf("the span said %v", said)
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
		TaskID: "task_1", Cause: "judge", Evidence: "The rubric asks for tests.", Suggestion: "Drop that line.",
	}) {
		t.Errorf("caused %+v", written.caused)
	}
	if written.done == nil || written.done.Failed {
		t.Errorf("completion %+v", written.done)
	}
}

func TestOnlyASearchProposesCandidatesAndRecordsCauses(t *testing.T) {
	written := run(t, asking(t))

	heard := said(t, written)
	for _, want := range []string{
		"candidates 501 this run cannot propose a candidate",
		"causes 501 this run cannot record a cause",
	} {
		if !strings.Contains(heard, want) {
			t.Errorf("the agent heard %q, missing %q", heard, want)
		}
	}

	written.mu.Lock()
	defer written.mu.Unlock()

	if len(written.proposed) != 0 || len(written.caused) != 0 {
		t.Errorf("a station run proposed %+v and caused %+v", written.proposed, written.caused)
	}
}

func TestASearchChecksNothingOut(t *testing.T) {
	written := run(t, harness(t, `said = require("node:fs").readdirSync(".").filter((name) => !name.startsWith(".")).join(",");`, "end_turn"),
		searching, func(o *runOptions) {
			o.checkouts = []protocol.Checkout{{Remote: "/nowhere/at/all.git", Path: "api", Branch: "main"}}
		})

	if heard := said(t, written); heard != "" {
		t.Errorf("the search's workspace contains %q", heard)
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

	written := run(t, harness(t, `said = String(require("node:fs").existsSync(".spotlight/memory"));`, "end_turn"),
		searching, func(o *runOptions) {
			o.root = root
			o.continuity = protocol.Continuity{Key: "search_1"}
			o.memory = []protocol.MemoryFile{{Path: ".spotlight/memory/team/M-2.md", Body: "# M-2 · rationale"}}
		})

	if heard := said(t, written); heard != "false" {
		t.Errorf("the search found the memory folder: %q", heard)
	}
}

func TestASearchRestoresNoWorkspaceAndKeepsNone(t *testing.T) {
	kept := newKeptArchives(t)

	run(t, harness(t, `require("node:fs").writeFileSync("notes.md", "halfway"); said = "wrote";`, "end_turn"),
		func(o *runOptions) {
			o.archives = kept
			o.continuity = protocol.Continuity{Key: carriedOn}
		})

	searched := run(t, harness(t, `said = String(require("node:fs").existsSync("notes.md"));`, "end_turn"),
		searching, func(o *runOptions) {
			o.archives = kept
			o.continuity = protocol.Continuity{Key: carriedOn}
		})

	if got := said(t, searched); got != "false" {
		t.Errorf("the search found notes.md: %q", got)
	}
	if got := step(t, searched, "restore"); got != "" {
		t.Errorf("the search said %q about restoring", got)
	}
	if got := step(t, searched, "archive"); got != "" {
		t.Errorf("the search said %q about keeping its workspace", got)
	}
	if kept.count() != 1 {
		t.Errorf("%d archives kept, want only the station run's", kept.count())
	}
}

func TestASearchIsHandedNoSkillsOrHarnessFiles(t *testing.T) {
	root := t.TempDir()
	kept := filepath.Join(root, "claude", "settings.json")
	if err := os.MkdirAll(filepath.Dir(kept), 0o700); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(kept, []byte(`{"left":"alone"}`), 0o600); err != nil {
		t.Fatal(err)
	}

	written := run(t, harness(t, `const fs = require("node:fs");
said = JSON.stringify([
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

	if heard := said(t, written); heard != `[false,false,"{\"left\":\"alone\"}"]` {
		t.Errorf("the search found %s", heard)
	}
}
