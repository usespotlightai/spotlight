package ssh

import "testing"

func TestParsesATaskAndAChatAlias(t *testing.T) {
	for raw, want := range map[string]Alias{
		"task-0d6c1f9e-1b7e-4c55-9a51-1f0f6b8d2c3a.acme.spotlight": {Kind: "task", ID: "0d6c1f9e-1b7e-4c55-9a51-1f0f6b8d2c3a", Workspace: "acme"},
		"chat-abc.my-team.spotlight":                               {Kind: "chat", ID: "abc", Workspace: "my-team"},
		"Task-ABC.Acme.Spotlight.":                                 {Kind: "task", ID: "abc", Workspace: "acme"},
	} {
		got, err := ParseAlias(raw)
		if err != nil || got != want {
			t.Errorf("ParseAlias(%q) = %+v, %v; want %+v", raw, got, err, want)
		}
	}
}

func TestRefusesAnAliasThatNamesNoTaskOrChat(t *testing.T) {
	for _, raw := range []string{
		"",
		"task-abc.acme",
		"task-abc.spotlight",
		"run-abc.acme.spotlight",
		"task-.acme.spotlight",
		"task.acme.spotlight",
		"task-abc..spotlight",
		"task-abc.acme.eu.spotlight",
		"task-abc.acme.spotlight.example.com",
	} {
		if got, err := ParseAlias(raw); err == nil {
			t.Errorf("ParseAlias(%q) = %+v; want an error", raw, got)
		}
	}
}

func TestConnectsToTheTaskInTheWorkspace(t *testing.T) {
	for address, want := range map[string]string{
		"https://app.usespotlight.ai": "wss://app.usespotlight.ai/api/sandboxes/connect?task=abc&workspace=acme",
		"http://localhost:3000":       "ws://localhost:3000/api/sandboxes/connect?task=abc&workspace=acme",
	} {
		got, err := Alias{Kind: "task", ID: "abc", Workspace: "acme"}.connectURL(address)
		if err != nil || got != want {
			t.Errorf("connectURL(%q) = %q, %v; want %q", address, got, err, want)
		}
	}

	got, _ := Alias{Kind: "chat", ID: "c1", Workspace: "acme"}.connectURL("https://app.usespotlight.ai")
	if got != "wss://app.usespotlight.ai/api/sandboxes/connect?chat=c1&workspace=acme" {
		t.Errorf("connectURL for a chat = %q", got)
	}
}
