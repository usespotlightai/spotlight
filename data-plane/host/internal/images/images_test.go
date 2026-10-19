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
	if allowed.Allows("fallback:1") {
		t.Error("the fallback is only for a host that names no image")
	}
}

func TestAHostNamingNoImageServesTheFallback(t *testing.T) {
	allowed, err := images.Parse(nil, "fallback:1")
	if err != nil {
		t.Fatal(err)
	}

	if allowed.Default != "fallback:1" || !allowed.Allows("fallback:1") || allowed.Allows("other:1") {
		t.Errorf("allowed %+v", allowed)
	}
}

func TestOnlyPatternsNamingOnlyPatternsStillServeTheFallback(t *testing.T) {
	allowed, err := images.Parse([]string{"ghcr.io/acme/*"}, "fallback:1")
	if err != nil {
		t.Fatal(err)
	}

	if allowed.Default != "fallback:1" || !allowed.Allows("ghcr.io/acme/api:main") {
		t.Errorf("allowed %+v", allowed)
	}
}

func TestAStarAnywhereButTheEndIsRejected(t *testing.T) {
	if _, err := images.Parse([]string{"ghcr.io/*/runner"}, "fallback:1"); err == nil {
		t.Fatal("expected a pattern with an inner star to be rejected")
	}
}

func TestAnEntryThatIsNoImageIsRejected(t *testing.T) {
	for _, entry := range []string{"GHCR.io/Acme/Runner", "runner main", "ghcr.io/acme/runner:main@sha256:short", "Ghcr.io/*"} {
		if _, err := images.Parse([]string{entry}, "fallback:1"); err == nil {
			t.Errorf("%q was taken as an image", entry)
		}
	}
	if _, err := images.Parse([]string{"localhost:5001/runner", "registry.local:5000/acme/*"}, "fallback:1"); err != nil {
		t.Errorf("rejected good entries: %v", err)
	}
}

func TestWantsTheDefaultThenEachAllowedImageOnce(t *testing.T) {
	allowed, _ := images.Parse([]string{"runner:1", "ghcr.io/acme/*"}, "fallback:1")

	wanted := allowed.Wanted([]string{"ghcr.io/acme/api:main", "runner:1", "ghcr.io/acme/api:main", "evil/runner:1"})

	if len(wanted) != 2 || wanted[0] != (images.Wanted{Image: "runner:1", IsDefault: true}) ||
		wanted[1] != (images.Wanted{Image: "ghcr.io/acme/api:main"}) {
		t.Errorf("wanted %+v", wanted)
	}
	if disallowed := allowed.Disallowed([]string{"evil/runner:1", "evil/runner:1"}); len(disallowed) != 1 {
		t.Errorf("disallowed %v", disallowed)
	}
}

func TestSaysWhenARunnerIsOlderThanTheControlPlaneNeeds(t *testing.T) {
	for _, each := range []struct {
		release string
		tooOld  bool
	}{
		{"", true},
		{"v0.2.0", true},
		{"v0.3.0", true},
		{"v0.3.1", false},
		{"v0.3.10", false},
		{"v0.4.0", false},
		{"v0.3.1-rc.2", true},
		{"v1.0.0-rc.1", false},
		{"20261001-01", false},
		{"dev", false},
		{"3f2c9d1a7b4e", false},
	} {
		tooOld := images.RunnerTooOld(each.release, "v0.3.1")
		if (tooOld != "") != each.tooOld {
			t.Errorf("%q: too old %q", each.release, tooOld)
		}
		if tooOld != "" && !strings.Contains(tooOld, "v0.3.1") {
			t.Errorf("%q: the reason does not say what is needed: %q", each.release, tooOld)
		}
	}
}
