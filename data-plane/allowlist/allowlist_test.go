package allowlist

import "testing"

func TestAllowsExactHostsAndSubdomainsOfAPattern(t *testing.T) {
	list, err := Parse([]string{"api.anthropic.com", "*.internal.acme.com", " Registry.NPMJS.org "})
	if err != nil {
		t.Fatal(err)
	}

	for host, want := range map[string]bool{
		"api.anthropic.com":          true,
		"API.Anthropic.com.":         true,
		"registry.npmjs.org":         true,
		"grafana.internal.acme.com":  true,
		"a.b.internal.acme.com":      true,
		"internal.acme.com":          false,
		"evilinternal.acme.com":      false,
		"anthropic.com":              false,
		"api.anthropic.com.evil.com": false,
		"":                           false,
	} {
		if got := list.Allows(host); got != want {
			t.Errorf("%q: allowed %v", host, got)
		}
	}
}

func TestAllowsAnyHostWhenNothingIsListed(t *testing.T) {
	list, err := Parse(nil)
	if err != nil {
		t.Fatal(err)
	}

	if !list.Allows("anything.example.com") || list.Allows("") {
		t.Error("an empty list should allow every named host")
	}
}

func TestAddsTheHostsEveryRunMustConnectTo(t *testing.T) {
	list, err := Parse([]string{"api.anthropic.com"})
	if err != nil {
		t.Fatal(err)
	}

	widened := list.With("control-plane", "", "MCP.linear.app")
	if !widened.Allows("control-plane") || !widened.Allows("mcp.linear.app") || !widened.Allows("api.anthropic.com") {
		t.Error("did not add the hosts every run connects to")
	}
	if list.Allows("control-plane") {
		t.Error("widening changed the list it widened")
	}
}

func TestRejectsWhatIsNotAHostOrAPattern(t *testing.T) {
	for _, entry := range []string{"*", "*.com", "api.*.com", "https://api.example.com", "api.example.com:443", "a b"} {
		if _, err := Parse([]string{entry}); err == nil {
			t.Errorf("%q was taken", entry)
		}
	}
}

func TestNamesOnlyWhatIsListedEvenWhenAnyHostIsAllowed(t *testing.T) {
	list, err := Parse(nil)
	if err != nil {
		t.Fatal(err)
	}
	widened := list.With("control-plane")

	if !widened.Allows("anything.example.com") || widened.ExplicitlyListed("anything.example.com") {
		t.Error("an unlisted host is allowed but never named")
	}
	if !widened.ExplicitlyListed("control-plane") {
		t.Error("a host every run connects to is named")
	}
}
