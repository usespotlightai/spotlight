package images_test

import (
	"strings"
	"testing"

	"usespotlight.ai/data-plane/host/internal/images"
)

func TestTheFirstExactImageIsTheDefault(t *testing.T) {
	allowed, err := images.Parse([]string{"ghcr.io/acme/*", "ghcr.io/acme/base:1", "runner:2"}, "fallback:1")
	if err != nil {
		t.Fatal(err)
	}

	if allowed.Default != "ghcr.io/acme/base:1" {
		t.Errorf("default %q", allowed.Default)
	}
	if allowed.Admits("fallback:1") {
		t.Error("the fallback is only for a host that names no image")
	}
}

func TestAHostNamingNoImageServesTheFallback(t *testing.T) {
	allowed, err := images.Parse(nil, "fallback:1")
	if err != nil {
		t.Fatal(err)
	}

	if allowed.Default != "fallback:1" || !allowed.Admits("fallback:1") || allowed.Admits("other:1") {
		t.Errorf("allowed %+v", allowed)
	}
}

func TestOnlyPatternsNamingOnlyPatternsStillServeTheFallback(t *testing.T) {
	allowed, err := images.Parse([]string{"ghcr.io/acme/*"}, "fallback:1")
	if err != nil {
		t.Fatal(err)
	}

	if allowed.Default != "fallback:1" || !allowed.Admits("ghcr.io/acme/api:main") {
		t.Errorf("allowed %+v", allowed)
	}
}

func TestAStarAnywhereButTheEndIsRefused(t *testing.T) {
	if _, err := images.Parse([]string{"ghcr.io/*/runner"}, "fallback:1"); err == nil {
		t.Fatal("expected a pattern with an inner star to be refused")
	}
}

func TestAnEntryThatIsNoImageIsRefused(t *testing.T) {
	for _, entry := range []string{"GHCR.io/Acme/Runner", "runner main", "ghcr.io/acme/runner:main@sha256:short", "Ghcr.io/*"} {
		if _, err := images.Parse([]string{entry}, "fallback:1"); err == nil {
			t.Errorf("%q was taken as an image", entry)
		}
	}
	if _, err := images.Parse([]string{"localhost:5001/runner", "registry.local:5000/acme/*"}, "fallback:1"); err != nil {
		t.Errorf("refused good entries: %v", err)
	}
}

func TestWantsTheDefaultThenEachAdmittedImageOnce(t *testing.T) {
	allowed, _ := images.Parse([]string{"runner:1", "ghcr.io/acme/*"}, "fallback:1")

	wanted := allowed.Wanted([]string{"ghcr.io/acme/api:main", "runner:1", "ghcr.io/acme/api:main", "evil/runner:1"})

	if len(wanted) != 2 || wanted[0] != (images.Wanted{Image: "runner:1", Usual: true}) ||
		wanted[1] != (images.Wanted{Image: "ghcr.io/acme/api:main"}) {
		t.Errorf("wanted %+v", wanted)
	}
	if refused := allowed.Refused([]string{"evil/runner:1", "evil/runner:1"}); len(refused) != 1 {
		t.Errorf("refused %v", refused)
	}
}

func TestARunnerOlderThanTheControlPlaneNeedsIsRefused(t *testing.T) {
	for _, each := range []struct {
		release string
		refused bool
	}{
		{"", true},
		{"20260801-01", true},
		{"20260925-01", true},
		{"20260925-02", false},
		{"20260925-10", false},
		{"20261001-01", false},
		{"dev", false},
		{"3f2c9d1a7b4e", false},
	} {
		refusal := images.RunnerRefusal(each.release, "20260925-02")
		if (refusal != "") != each.refused {
			t.Errorf("%q: refusal %q", each.release, refusal)
		}
		if refusal != "" && !strings.Contains(refusal, "20260925-02") {
			t.Errorf("%q: the refusal does not say what is needed: %q", each.release, refusal)
		}
	}
}
