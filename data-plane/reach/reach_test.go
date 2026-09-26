package reach

import "testing"

func TestAdmitsExactHostsAndSubdomainsOfAPattern(t *testing.T) {
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
		if got := list.Admits(host); got != want {
			t.Errorf("%q: admitted %v", host, got)
		}
	}
}

func TestAdmitsAnyHostWhenNothingIsListed(t *testing.T) {
	list, err := Parse(nil)
	if err != nil {
		t.Fatal(err)
	}

	if !list.Admits("anything.example.com") || list.Admits("") {
		t.Error("an empty list should admit every named host")
	}
}

func TestAddsTheHostsEveryRunMustReach(t *testing.T) {
	list, err := Parse([]string{"api.anthropic.com"})
	if err != nil {
		t.Fatal(err)
	}

	widened := list.With("control-plane", "", "MCP.linear.app")
	if !widened.Admits("control-plane") || !widened.Admits("mcp.linear.app") || !widened.Admits("api.anthropic.com") {
		t.Error("did not add the hosts every run reaches")
	}
	if list.Admits("control-plane") {
		t.Error("widening changed the list it widened")
	}
}

func TestRefusesWhatIsNotAHostOrAPattern(t *testing.T) {
	for _, entry := range []string{"*", "*.com", "api.*.com", "https://api.example.com", "api.example.com:443", "a b"} {
		if _, err := Parse([]string{entry}); err == nil {
			t.Errorf("%q was taken", entry)
		}
	}
}

func TestNamesOnlyWhatIsListedEvenWhenAnyHostIsAdmitted(t *testing.T) {
	list, err := Parse(nil)
	if err != nil {
		t.Fatal(err)
	}
	widened := list.With("control-plane")

	if !widened.Admits("anything.example.com") || widened.Names("anything.example.com") {
		t.Error("an unlisted host is admitted but never named")
	}
	if !widened.Names("control-plane") {
		t.Error("a host every run reaches is named")
	}
}
