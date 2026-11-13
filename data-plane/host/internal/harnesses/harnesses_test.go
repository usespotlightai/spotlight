package harnesses

import (
	"context"
	"strings"
	"testing"

	"usespotlight.ai/data-plane/host/internal/sandbox"
)

type builder struct{ built sandbox.Build }

func (b *builder) Build(_ context.Context, build sandbox.Build, _ func(string)) error {
	b.built = build
	return nil
}

func TestEveryHarnessHasADockerfileAndKnownKeys(t *testing.T) {
	for _, each := range All() {
		if dockerfile, err := each.Dockerfile(); err != nil || !strings.Contains(string(dockerfile), "FROM ${BASE}") {
			t.Errorf("%s has %q: %v", each.ID, dockerfile, err)
		}
		for _, name := range each.Keys {
			if _, known := KeyNamed(name); !known {
				t.Errorf("%s names the unknown key %s", each.ID, name)
			}
		}
	}
}

func TestOneImageHoldsEveryPickedHarnessOnTheBase(t *testing.T) {
	var built builder
	picked := []Harness{All()[0], All()[1]}

	if err := BuildImage(context.Background(), &built, "ghcr.io/usespotlightai/spotlight-runner:0.4.1", Tag("v0.4.1", picked), picked, nil); err != nil {
		t.Fatal(err)
	}

	dockerfile := string(built.built.Dockerfile)
	if strings.Count(dockerfile, "FROM ") != 1 || !strings.Contains(dockerfile, "claude-agent-acp") || !strings.Contains(dockerfile, "codex-acp") {
		t.Errorf("built from\n%s", dockerfile)
	}
	if built.built.Tag != "spotlight-harnesses:0.4.1-claude-code-codex" || built.built.Args["BASE"] != "ghcr.io/usespotlightai/spotlight-runner:0.4.1" {
		t.Errorf("built %s with %v", built.built.Tag, built.built.Args)
	}
}
