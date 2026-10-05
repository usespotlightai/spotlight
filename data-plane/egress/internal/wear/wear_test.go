package wear

import (
	"bytes"
	"context"
	"errors"
	"log/slog"
	"net/http"
	"slices"
	"strings"
	"testing"

	"usespotlight.ai/data-plane/protocol"
	"usespotlight.ai/data-plane/reach"
)

type opener struct{}

func (opener) Open(sealed, runID, secret string) (string, error) {
	if runID != "run_1" {
		return "", errors.New("sealed for another run")
	}
	return strings.TrimPrefix(sealed, "sealed:"), nil
}

type reader struct{}

func (reader) Read(_ context.Context, source protocol.ReadInNetwork) (string, error) {
	if source.SecretID == "gone" {
		return "", errors.New("AWS Secrets Manager answered ResourceNotFoundException")
	}
	return "read:" + source.SecretID, nil
}

func redemption() protocol.EgressRedemption {
	return protocol.EgressRedemption{
		RunID: "run_1",
		Secrets: []protocol.RedeemedSecret{
			{Secret: "LINEAR_API_KEY", Host: "MCP.linear.app", Header: "authorization", Prefix: "Bearer ", Sealed: "sealed:lin_api_1"},
			{Secret: "LINEAR_WORKSPACE", Host: "mcp.linear.app", Header: "x-workspace", Sealed: "sealed:acme"},
			{Secret: "SENTRY_TOKEN", Host: "sentry.io", Header: "x-sentry-token",
				ReadInNetwork: &protocol.ReadInNetwork{Kind: protocol.ReadFromAWSSecretsManager, SecretID: "sentry-token"}},
			{Secret: "GONE", Host: "gone.example.com", Header: "authorization",
				ReadInNetwork: &protocol.ReadInNetwork{Kind: protocol.ReadFromAWSSecretsManager, SecretID: "gone"}},
			{Secret: "MULTI", Host: "multi.example.com", Header: "authorization", Sealed: "sealed:one\ntwo"},
			{Secret: "OUTSIDE", Host: "exfiltrate.example.net", Header: "authorization", Sealed: "sealed:outside"},
			{Secret: "UNLISTED_READ", Host: "sentry.io", Header: "x-other",
				ReadInNetwork: &protocol.ReadInNetwork{Kind: protocol.ReadFromAWSSecretsManager, SecretID: "prod/payments"}},
			{Secret: "SAME_HEADER", Host: "mcp.linear.app", Header: "Authorization", Sealed: "sealed:second"},
		},
		Withheld: []protocol.WithheldSecret{{Secret: "NOWHERE", Reason: "no such secret"}},
	}
}

func holding(t *testing.T) (*Wearing, *bytes.Buffer) {
	t.Helper()

	var logged bytes.Buffer
	hosts, err := reach.Parse([]string{"*.linear.app", "sentry.io", "gone.example.com", "multi.example.com"})
	if err != nil {
		t.Fatal(err)
	}
	limits := Limits{Hosts: hosts, Reads: []string{"sentry-*", "gone"}}
	wearing := From(context.Background(), redemption(), nil, limits, opener{},
		func() (Reader, error) { return reader{}, nil }, slog.New(slog.NewTextHandler(&logged, nil)))

	return wearing, &logged
}

func TestWearsEachSecretOnlyTowardItsOwnHost(t *testing.T) {
	wearing, _ := holding(t)

	if got := wearing.Hosts(); !slices.Equal(got, []string{"mcp.linear.app", "sentry.io"}) {
		t.Errorf("wears toward %v", got)
	}

	header := http.Header{
		"Authorization": {"Bearer spotlight-egress:LINEAR_API_KEY"},
		"X-Workspace":   {"spotlight-egress:LINEAR_WORKSPACE"},
		"Accept":        {"application/json"},
	}
	wearing.Onto("mcp.linear.app", header)
	if header.Get("Authorization") != "Bearer lin_api_1" || header.Get("X-Workspace") != "acme" || len(header.Values("Authorization")) != 1 {
		t.Errorf("wore %v", header)
	}
	if header.Get("Accept") != "application/json" {
		t.Errorf("took away a header it does not wear: %v", header)
	}

	unbound := http.Header{"Authorization": {"Bearer mine"}}
	wearing.Onto("api.github.com", unbound)
	if unbound.Get("Authorization") != "Bearer mine" {
		t.Errorf("wore a secret toward a host it is not bound to: %v", unbound)
	}

	sentry := http.Header{"X-Sentry-Token": {"spotlight-egress:SENTRY_TOKEN"}}
	wearing.Onto("SENTRY.io", sentry)
	if sentry.Get("X-Sentry-Token") != "read:sentry-token" {
		t.Errorf("did not wear what it read in the network: %v", sentry)
	}
}

func TestWearsARunSecretOnlyInPlaceOfItsStandIn(t *testing.T) {
	wearing, logged := holding(t)

	for _, sent := range []string{"Bearer spotlight-egress:LINEAR_API_KEY", "spotlight-egress:LINEAR_API_KEY"} {
		header := http.Header{"Authorization": {sent}}
		wearing.Onto("mcp.linear.app", header)
		if header.Get("Authorization") != "Bearer lin_api_1" {
			t.Errorf("did not wear in place of %q: %v", sent, header)
		}
	}

	own := http.Header{"Authorization": {"Bearer mine"}, "X-Workspace": {"theirs"}}
	wearing.Onto("mcp.linear.app", own)
	if own.Get("Authorization") != "Bearer mine" || own.Get("X-Workspace") != "theirs" {
		t.Errorf("wore over what the sandbox sent without a stand-in: %v", own)
	}

	bare := http.Header{}
	wearing.Onto("mcp.linear.app", bare)
	if len(bare) != 0 {
		t.Errorf("added a secret to a request that named none: %v", bare)
	}

	unknown := http.Header{"Authorization": {"Bearer spotlight-egress:LINEAR_API_KEYS"}, "X-Other": {"spotlight-egress:NOWHERE"}}
	wearing.Onto("mcp.linear.app", unknown)
	if len(unknown) != 0 {
		t.Errorf("sent on a stand-in it does not hold: %v", unknown)
	}
	if !strings.Contains(logged.String(), "X-Other") {
		t.Errorf("did not say it took a stand-in off: %s", logged)
	}
	for _, value := range []string{"lin_api_1", "acme"} {
		if strings.Contains(logged.String(), value) {
			t.Errorf("logged the value %q", value)
		}
	}
}

func TestHoldsNothingItCouldNotReadOrWearAndSaysWhyWithoutTheValue(t *testing.T) {
	wearing, logged := holding(t)

	if wearing.Wears("gone.example.com") || wearing.Wears("multi.example.com") {
		t.Error("holds a secret it could not read or wear")
	}
	for _, said := range []string{
		"NOWHERE", "no such secret", "GONE", "ResourceNotFoundException", "MULTI",
		"OUTSIDE", "allow-list does not admit exfiltrate.example.net",
		"UNLISTED_READ", "does not let egress read prod/payments",
		"SAME_HEADER", "already worn in Authorization toward mcp.linear.app",
	} {
		if !strings.Contains(logged.String(), said) {
			t.Errorf("did not say %q: %s", said, logged)
		}
	}
	if wearing.Wears("exfiltrate.example.net") {
		t.Error("wears toward a host the allow-list leaves out")
	}
	for _, value := range []string{"lin_api_1", "acme", "read:sentry-token", "outside", "second"} {
		if strings.Contains(logged.String(), value) {
			t.Errorf("logged the value %q", value)
		}
	}
}

func TestForgetsEveryValueItHeld(t *testing.T) {
	wearing, _ := holding(t)
	held := wearing.toward["mcp.linear.app"][0].value

	wearing.Forget()

	if wearing.Wears("mcp.linear.app") || len(wearing.Hosts()) != 0 {
		t.Error("still wears a secret after forgetting")
	}
	if strings.Trim(string(held), "\x00") != "" {
		t.Errorf("the value is still in memory: %q", held)
	}
}

func TestWearsAKeyTheHostHoldsOnlyInPlaceOfItsOwnStandIn(t *testing.T) {
	var logged bytes.Buffer
	hosts, _ := reach.Parse([]string{"api.anthropic.com", "api.openai.com"})
	wearing := From(context.Background(), protocol.EgressRedemption{
		RunID: "run_1",
		Secrets: []protocol.RedeemedSecret{
			{Secret: "CLAUDE_OAUTH", Host: "api.anthropic.com", Header: "x-other", Sealed: "sealed:from-a-run"},
			{Secret: "DOTTED", Host: "API.anthropic.com.", Header: "x-dotted", Sealed: "sealed:dotted"},
		},
	}, []protocol.HeldByTheHost{
		{Name: "ANTHROPIC_API_KEY", Host: "api.anthropic.com", Header: "x-api-key", Value: "sk-ant-api"},
		{Name: "CLAUDE_CODE_OAUTH_TOKEN", Host: "api.anthropic.com", Header: "authorization", Prefix: "Bearer ", Value: "sk-ant-oat"},
		{Name: "OPENAI_API_KEY", Host: "api.openai.com", Header: "authorization", Prefix: "Bearer ", Value: "sk-openai"},
		{Name: "CODEX_API_KEY", Host: "api.openai.com", Header: "authorization", Prefix: "Bearer ", Value: "sk-codex"},
		{Name: "GITHUB_TOKEN", Host: "api.github.com", Header: "authorization", Prefix: "Bearer ", Value: "ghp"},
	}, Limits{Hosts: hosts}, opener{}, func() (Reader, error) { return reader{}, nil }, slog.New(slog.NewTextHandler(&logged, nil)))

	sent := func(host string, header http.Header) http.Header {
		wearing.Onto(host, header)
		return header
	}

	if got := sent("api.anthropic.com", http.Header{"X-Api-Key": {"spotlight-egress:ANTHROPIC_API_KEY"}}); got.Get("X-Api-Key") != "sk-ant-api" || got.Get("Authorization") != "" {
		t.Errorf("an API-key request went out as %v", got)
	}
	if got := sent("api.anthropic.com", http.Header{"Authorization": {"Bearer spotlight-egress:CLAUDE_CODE_OAUTH_TOKEN"}}); got.Get("Authorization") != "Bearer sk-ant-oat" || got.Get("X-Api-Key") != "" {
		t.Errorf("an OAuth request went out as %v", got)
	}
	if got := sent("api.anthropic.com", http.Header{"Authorization": {"spotlight-egress:CLAUDE_CODE_OAUTH_TOKEN"}}); got.Get("Authorization") != "" {
		t.Errorf("wore a host's key in place of its stand-in without the prefix: %v", got)
	}
	if got := sent("api.anthropic.com", http.Header{"Authorization": {"Bearer mine"}}); got.Get("Authorization") != "Bearer mine" || got.Get("X-Other") != "" {
		t.Errorf("wore a host's key over a value the sandbox chose: %v", got)
	}
	if got := sent("api.openai.com", http.Header{"Authorization": {"Bearer spotlight-egress:OPENAI_API_KEY"}}); got.Get("Authorization") != "Bearer sk-openai" {
		t.Errorf("an OpenAI request went out as %v", got)
	}
	if got := sent("api.openai.com", http.Header{"Authorization": {"Bearer spotlight-egress:CODEX_API_KEY"}}); got.Get("Authorization") != "Bearer sk-codex" {
		t.Errorf("a Codex request went out as %v", got)
	}

	for _, said := range []string{
		"GITHUB_TOKEN", "allow-list does not admit api.github.com",
		"CLAUDE_OAUTH", "holds a key of its own for api.anthropic.com",
		"DOTTED",
	} {
		if !strings.Contains(logged.String(), said) {
			t.Errorf("did not say %q: %s", said, logged.String())
		}
	}
	if got := sent("api.anthropic.com", http.Header{}); got.Get("X-Dotted") != "" {
		t.Errorf("a secret bound to a dotted spelling of a host-held host was worn: %v", got)
	}
	for _, value := range []string{"sk-ant-api", "sk-ant-oat", "sk-openai", "sk-codex", "ghp", "from-a-run", "dotted"} {
		if strings.Contains(logged.String(), value) {
			t.Errorf("logged the value %q", value)
		}
	}
}
