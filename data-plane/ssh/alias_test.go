package ssh

import (
	"testing"

	"usespotlight.ai/data-plane/protocol"
)

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

func TestAsksForTheTaskInTheWorkspace(t *testing.T) {
	got := Alias{Kind: "task", ID: "abc", Workspace: "acme"}.connection()
	if len(got) != 2 || got["task"] != "abc" || got["workspace"] != "acme" {
		t.Errorf("connection() = %v", got)
	}

	got = Alias{Kind: "chat", ID: "c1", Workspace: "acme"}.connection()
	if len(got) != 2 || got["chat"] != "c1" || got["workspace"] != "acme" {
		t.Errorf("connection() for a chat = %v", got)
	}
}

func TestConnectsWithTheEditorLease(t *testing.T) {
	lease := protocol.EditorConnection{SandboxID: "sandbox_1", Holder: "holder_1"}
	for address, want := range map[string]string{
		"https://app.usespotlight.ai": "wss://app.usespotlight.ai/api/sandboxes/connect?holder=holder_1&sandbox=sandbox_1",
		"http://localhost:3000":       "ws://localhost:3000/api/sandboxes/connect?holder=holder_1&sandbox=sandbox_1",
	} {
		got, err := socketURL(address, lease)
		if err != nil || got != want {
			t.Errorf("socketURL(%q) = %q, %v; want %q", address, got, err, want)
		}
	}

	got, err := connectionsURL("https://app.usespotlight.ai")
	if err != nil || got != "https://app.usespotlight.ai/api/editor-connections" {
		t.Errorf("connectionsURL = %q, %v", got, err)
	}
}
