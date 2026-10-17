package config_test

import (
	"strings"
	"testing"
	"time"

	"usespotlight.ai/data-plane/runner/internal/config"
)

func setRequired(t *testing.T) {
	t.Helper()

	for _, name := range []string{
		"SPOTLIGHT_URL", "SPOTLIGHT_TOKEN", "SPOTLIGHT_HANDED", "SPOTLIGHT_WORKSPACE",
		"SPOTLIGHT_AGENT_USER", "SPOTLIGHT_GIT_AUTHOR_NAME", "SPOTLIGHT_GIT_AUTHOR_EMAIL", "SPOTLIGHT_ANSWER_WAIT",
		"SPOTLIGHT_EGRESS_URL", "SPOTLIGHT_EGRESS_PROXY_CREDENTIAL", "SPOTLIGHT_EGRESS_TRAFFIC",
	} {
		t.Setenv(name, "")
	}

	t.Setenv("SPOTLIGHT_URL", "https://spotlight.test")
	t.Setenv("SPOTLIGHT_HANDED", "/run/spotlight/handed.json")
}

func TestLoadReadsTheWholeSurface(t *testing.T) {
	setRequired(t)
	t.Setenv("SPOTLIGHT_WORKSPACE", "/work")
	t.Setenv("SPOTLIGHT_AGENT_USER", "agent")
	t.Setenv("SPOTLIGHT_GIT_AUTHOR_NAME", "Robin")
	t.Setenv("SPOTLIGHT_GIT_AUTHOR_EMAIL", "robin@example.com")

	cfg, err := config.Load(nil)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if !cfg.WasHanded() || cfg.Handed != "/run/spotlight/handed.json" {
		t.Errorf("handed %q", cfg.Handed)
	}
	if cfg.Workspace != "/work" || cfg.AgentUser != "agent" {
		t.Errorf("workspace %q, agent %q", cfg.Workspace, cfg.AgentUser)
	}
	if cfg.Author.Name != "Robin" || cfg.Author.Email != "robin@example.com" {
		t.Errorf("author %+v", cfg.Author)
	}
}

func TestLoadTakesAPushPoolsOneRunCredential(t *testing.T) {
	setRequired(t)
	t.Setenv("SPOTLIGHT_HANDED", "")
	t.Setenv("SPOTLIGHT_TOKEN", "one-run")

	cfg, err := config.Load(nil)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if cfg.WasHanded() || cfg.Token != "one-run" {
		t.Errorf("got %+v", cfg)
	}
}

func TestLoadRejectsBothWaysToBeGivenWork(t *testing.T) {
	setRequired(t)
	t.Setenv("SPOTLIGHT_TOKEN", "one-run")

	_, err := config.Load(nil)
	if err == nil || !strings.Contains(err.Error(), "give one") {
		t.Fatalf("expected both named, got %v", err)
	}
}

func TestLoadReportsEveryProblemAtOnce(t *testing.T) {
	setRequired(t)
	t.Setenv("SPOTLIGHT_URL", "")
	t.Setenv("SPOTLIGHT_HANDED", "")

	_, err := config.Load(nil)
	if err == nil {
		t.Fatal("expected an error")
	}

	for _, want := range []string{"SPOTLIGHT_URL", "SPOTLIGHT_HANDED", "SPOTLIGHT_TOKEN"} {
		if !strings.Contains(err.Error(), want) {
			t.Errorf("error does not mention %s: %v", want, err)
		}
	}
}

func TestLoadWorksInTheSamePlaceEveryTime(t *testing.T) {
	setRequired(t)

	cfg, err := config.Load(nil)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if cfg.Workspace != "/workspace" {
		t.Errorf("workspace %q", cfg.Workspace)
	}
	if cfg.Author.Name != "Spotlight" || cfg.Author.Email != "noreply@usespotlight.ai" {
		t.Errorf("author %+v", cfg.Author)
	}
	if cfg.AnswerWait != 0 {
		t.Errorf("a runner no host started waits %v for an answer, rather than parking at once", cfg.AnswerWait)
	}
}

func TestLoadReadsHowLongToWaitWarmForAnAnswer(t *testing.T) {
	setRequired(t)
	t.Setenv("SPOTLIGHT_ANSWER_WAIT", "90s")

	cfg, err := config.Load(nil)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if cfg.AnswerWait != 90*time.Second {
		t.Errorf("answer wait %v", cfg.AnswerWait)
	}
}

func TestLoadRejectsAnAnswerWaitThatIsNoDurationOrIsNegative(t *testing.T) {
	for _, raw := range []string{"soon", "90", "-1s"} {
		setRequired(t)
		t.Setenv("SPOTLIGHT_ANSWER_WAIT", raw)

		if _, err := config.Load(nil); err == nil || !strings.Contains(err.Error(), "SPOTLIGHT_ANSWER_WAIT") {
			t.Errorf("%q: expected an error, got %v", raw, err)
		}
	}
}

func TestLoadTakesThePushPoolsEgress(t *testing.T) {
	setRequired(t)
	t.Setenv("SPOTLIGHT_HANDED", "")
	t.Setenv("SPOTLIGHT_TOKEN", "one-run")
	t.Setenv("SPOTLIGHT_EGRESS_URL", "https://egress.example.com")
	t.Setenv("SPOTLIGHT_EGRESS_PROXY_CREDENTIAL", "proxy-credential")
	t.Setenv("SPOTLIGHT_EGRESS_TRAFFIC", "bound")

	cfg, err := config.Load(nil)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	want := config.Egress{URL: "https://egress.example.com", Credential: "proxy-credential", Direct: true}
	if cfg.Egress != want || !cfg.Egress.Given() {
		t.Errorf("egress %+v", cfg.Egress)
	}
}

func TestLoadRejectsATrafficSettingItDoesNotKnow(t *testing.T) {
	setRequired(t)
	t.Setenv("SPOTLIGHT_HANDED", "")
	t.Setenv("SPOTLIGHT_TOKEN", "one-run")
	t.Setenv("SPOTLIGHT_EGRESS_URL", "https://egress.example.com")
	t.Setenv("SPOTLIGHT_EGRESS_PROXY_CREDENTIAL", "proxy-credential")
	t.Setenv("SPOTLIGHT_EGRESS_TRAFFIC", "some")

	if _, err := config.Load(nil); err == nil || !strings.Contains(err.Error(), "SPOTLIGHT_EGRESS_TRAFFIC") {
		t.Errorf("error %v", err)
	}
}

func TestLoadLeavesEgressToTheHostThatHandedTheWork(t *testing.T) {
	setRequired(t)
	t.Setenv("SPOTLIGHT_EGRESS_URL", "https://egress.example.com")
	t.Setenv("SPOTLIGHT_EGRESS_PROXY_CREDENTIAL", "proxy-credential")

	cfg, err := config.Load(nil)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if cfg.Egress.Given() {
		t.Errorf("egress %+v", cfg.Egress)
	}
}

func TestLoadRejectsAnEgressWithoutItsCredential(t *testing.T) {
	setRequired(t)
	t.Setenv("SPOTLIGHT_HANDED", "")
	t.Setenv("SPOTLIGHT_TOKEN", "one-run")
	t.Setenv("SPOTLIGHT_EGRESS_URL", "https://egress.example.com")

	if _, err := config.Load(nil); err == nil || !strings.Contains(err.Error(), "SPOTLIGHT_EGRESS_PROXY_CREDENTIAL") {
		t.Errorf("error %v", err)
	}
}
