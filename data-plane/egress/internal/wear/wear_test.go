package wear

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/url"
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
			{Secret: "LINEAR_API_KEY", Host: "MCP.linear.app", Carrier: "header", Name: "authorization", Prefix: "Bearer ", Sealed: "sealed:lin_api_1"},
			{Secret: "LINEAR_WORKSPACE", Host: "mcp.linear.app", Carrier: "header", Name: "x-workspace", Sealed: "sealed:acme"},
			{Secret: "SENTRY_TOKEN", Host: "sentry.io", Carrier: "header", Name: "x-sentry-token",
				ReadInNetwork: &protocol.ReadInNetwork{Kind: protocol.ReadFromAWSSecretsManager, SecretID: "sentry-token"}},
			{Secret: "GONE", Host: "gone.example.com", Carrier: "header", Name: "authorization",
				ReadInNetwork: &protocol.ReadInNetwork{Kind: protocol.ReadFromAWSSecretsManager, SecretID: "gone"}},
			{Secret: "MULTI", Host: "multi.example.com", Carrier: "header", Name: "authorization", Sealed: "sealed:one\ntwo"},
			{Secret: "OUTSIDE", Host: "exfiltrate.example.net", Carrier: "header", Name: "authorization", Sealed: "sealed:outside"},
			{Secret: "UNLISTED_READ", Host: "sentry.io", Carrier: "header", Name: "x-other",
				ReadInNetwork: &protocol.ReadInNetwork{Kind: protocol.ReadFromAWSSecretsManager, SecretID: "prod/payments"}},
			{Secret: "SAME_HEADER", Host: "mcp.linear.app", Carrier: "header", Name: "Authorization", Sealed: "sealed:second"},
		},
		Withheld: []protocol.WithheldSecret{{Secret: "NOWHERE", Reason: "no such secret"}},
	}
}

func onto(wearing *Wearing, host string, header http.Header) {
	wearing.Onto(host, &http.Request{Header: header, URL: &url.URL{}})
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
	onto(wearing, "mcp.linear.app", header)
	if header.Get("Authorization") != "Bearer lin_api_1" || header.Get("X-Workspace") != "acme" || len(header.Values("Authorization")) != 1 {
		t.Errorf("wore %v", header)
	}
	if header.Get("Accept") != "application/json" {
		t.Errorf("took away a header it does not wear: %v", header)
	}

	unbound := http.Header{"Authorization": {"Bearer mine"}}
	onto(wearing, "api.github.com", unbound)
	if unbound.Get("Authorization") != "Bearer mine" {
		t.Errorf("wore a secret toward a host it is not bound to: %v", unbound)
	}

	sentry := http.Header{"X-Sentry-Token": {"spotlight-egress:SENTRY_TOKEN"}}
	onto(wearing, "SENTRY.io", sentry)
	if sentry.Get("X-Sentry-Token") != "read:sentry-token" {
		t.Errorf("did not wear what it read in the network: %v", sentry)
	}
}

func TestWearsARunSecretOnlyInPlaceOfItsStandIn(t *testing.T) {
	wearing, logged := holding(t)

	for _, sent := range []string{"Bearer spotlight-egress:LINEAR_API_KEY", "spotlight-egress:LINEAR_API_KEY"} {
		header := http.Header{"Authorization": {sent}}
		onto(wearing, "mcp.linear.app", header)
		if header.Get("Authorization") != "Bearer lin_api_1" {
			t.Errorf("did not wear in place of %q: %v", sent, header)
		}
	}

	own := http.Header{"Authorization": {"Bearer mine"}, "X-Workspace": {"theirs"}}
	onto(wearing, "mcp.linear.app", own)
	if own.Get("Authorization") != "Bearer mine" || own.Get("X-Workspace") != "theirs" {
		t.Errorf("wore over what the sandbox sent without a stand-in: %v", own)
	}

	bare := http.Header{}
	onto(wearing, "mcp.linear.app", bare)
	if len(bare) != 0 {
		t.Errorf("added a secret to a request that named none: %v", bare)
	}

	unknown := http.Header{"Authorization": {"Bearer spotlight-egress:LINEAR_API_KEYS"}, "X-Other": {"spotlight-egress:NOWHERE"}, "X-Shout": {"SPOTLIGHT-EGRESS:NOWHERE"}}
	onto(wearing, "mcp.linear.app", unknown)
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
			{Secret: "CLAUDE_OAUTH", Host: "api.anthropic.com", Carrier: "header", Name: "x-other", Sealed: "sealed:from-a-run"},
			{Secret: "DOTTED", Host: "API.anthropic.com.", Carrier: "header", Name: "x-dotted", Sealed: "sealed:dotted"},
		},
	}, []protocol.HeldByTheHost{
		{Name: "ANTHROPIC_API_KEY", Host: "api.anthropic.com", Header: "x-api-key", Value: "sk-ant-api"},
		{Name: "CLAUDE_CODE_OAUTH_TOKEN", Host: "api.anthropic.com", Header: "authorization", Prefix: "Bearer ", Value: "sk-ant-oat"},
		{Name: "OPENAI_API_KEY", Host: "api.openai.com", Header: "authorization", Prefix: "Bearer ", Value: "sk-openai"},
		{Name: "CODEX_API_KEY", Host: "api.openai.com", Header: "authorization", Prefix: "Bearer ", Value: "sk-codex"},
		{Name: "GITHUB_TOKEN", Host: "api.github.com", Header: "authorization", Prefix: "Bearer ", Value: "ghp"},
	}, Limits{Hosts: hosts}, opener{}, func() (Reader, error) { return reader{}, nil }, slog.New(slog.NewTextHandler(&logged, nil)))

	sent := func(host string, header http.Header) http.Header {
		onto(wearing, host, header)
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

func TestWearsAQuerySecretOnlyInPlaceOfItsStandInKeepingTheRestOfTheQuery(t *testing.T) {
	var logged bytes.Buffer
	hosts, _ := reach.Parse([]string{"maps.googleapis.com", "api.example.com"})
	wearing := From(context.Background(), protocol.EgressRedemption{
		RunID: "run_1",
		Secrets: []protocol.RedeemedSecret{
			{Secret: "MAPS_KEY", Host: "maps.googleapis.com", Carrier: "query", Name: "key", Sealed: "sealed:AIza/1+2 3&x=y"},
			{Secret: "MAPS_HEADER", Host: "maps.googleapis.com", Carrier: "header", Name: "key", Sealed: "sealed:in-a-header"},
			{Secret: "SAME_SLOT", Host: "maps.googleapis.com", Carrier: "query", Name: "key", Sealed: "sealed:second"},
			{Secret: "PREFIXED", Host: "api.example.com", Carrier: "query", Name: "token", Prefix: "v1.", Sealed: "sealed:tok"},
			{Secret: "NAMELESS", Host: "api.example.com", Carrier: "query", Sealed: "sealed:nameless"},
		},
	}, nil, Limits{Hosts: hosts}, opener{}, func() (Reader, error) { return reader{}, nil }, slog.New(slog.NewTextHandler(&logged, nil)))

	sent := func(host, rawQuery string) string {
		request := &http.Request{Header: http.Header{}, URL: &url.URL{RawQuery: rawQuery}}
		wearing.Onto(host, request)
		return request.URL.RawQuery
	}

	if got := sent("maps.googleapis.com", "b=2&key=spotlight-egress:MAPS_KEY&a=%7Ex+y&c"); got != "b=2&key=AIza%2F1%2B2+3%26x%3Dy&a=%7Ex+y&c" {
		t.Errorf("a query stand-in went out as %q", got)
	}
	if got := sent("maps.googleapis.com", "key=spotlight-egress%3AMAPS_KEY"); got != "key=AIza%2F1%2B2+3%26x%3Dy" {
		t.Errorf("an escaped query stand-in went out as %q", got)
	}
	if got := sent("api.example.com", "token=v1.spotlight-egress:PREFIXED"); got != "token=v1.tok" {
		t.Errorf("a prefixed query stand-in went out as %q", got)
	}
	if got := sent("api.example.com", "token=spotlight-egress:PREFIXED"); got != "token=v1.tok" {
		t.Errorf("a query stand-in without its prefix went out as %q", got)
	}
	if got := sent("maps.googleapis.com", "z=1&key=mine&a=%2f"); got != "z=1&key=mine&a=%2f" {
		t.Errorf("rewrote a query with no stand-in: %q", got)
	}
	if got := sent("maps.googleapis.com", "a=1&other=spotlight-egress:MAPS_KEY&key=spotlight-egress:NOWHERE&k=%73potlight-egress%3AX&b=2"); got != "a=1&b=2" {
		t.Errorf("sent on a query stand-in it does not hold: %q", got)
	}
	if got := sent("api.github.com", "key=spotlight-egress:MAPS_KEY"); got != "" {
		t.Errorf("wore a query secret toward a host it is not bound to: %q", got)
	}

	header := http.Header{"Key": {"spotlight-egress:MAPS_HEADER"}}
	onto(wearing, "maps.googleapis.com", header)
	if header.Get("Key") != "in-a-header" {
		t.Errorf("a header and a query parameter of one name did not both wear: %v", header)
	}

	for _, said := range []string{"SAME_SLOT", "already worn in ?key toward maps.googleapis.com", "NAMELESS", "parameter=other", "parameter=key", "parameter=k"} {
		if !strings.Contains(logged.String(), said) {
			t.Errorf("did not say %q: %s", said, logged.String())
		}
	}
	for _, value := range []string{"AIza", "in-a-header", "second", "tok\n", "nameless\n"} {
		if strings.Contains(logged.String(), value) {
			t.Errorf("logged the value %q", value)
		}
	}
}

type trickle struct{ text []byte }

func (t *trickle) Read(into []byte) (int, error) {
	if len(t.text) == 0 {
		return 0, io.EOF
	}
	into[0] = t.text[0]
	t.text = t.text[1:]
	return 1, nil
}

func (t *trickle) Close() error { return nil }

func TestHandsBackTheStandInWhereverTheHostEchoesASecret(t *testing.T) {
	var logged bytes.Buffer
	hosts, _ := reach.Parse([]string{"api.example.com"})
	wearing := From(context.Background(), protocol.EgressRedemption{
		RunID: "run_1",
		Secrets: []protocol.RedeemedSecret{
			{Secret: "TOKEN", Host: "api.example.com", Carrier: "header", Name: "authorization", Prefix: "Bearer ", Sealed: "sealed:tok/1+2"},
			{Secret: "ODD", Host: "api.example.com", Carrier: "cookie", Name: "k", Sealed: "sealed:odd"},
		},
	}, nil, Limits{Hosts: hosts}, opener{}, func() (Reader, error) { return reader{}, nil }, slog.New(slog.NewTextHandler(&logged, nil)))

	answered := func(contentType, body string) *http.Response {
		response := &http.Response{
			Header:        http.Header{"Content-Type": {contentType}, "Content-Length": {fmt.Sprint(len(body))}, "Location": {"https://api.example.com/?t=tok%2F1%2B2"}, "Link": {"<https://x/?t=tok%2f1%2b2>"}},
			ContentLength: int64(len(body)),
			Body:          &trickle{text: []byte(body)},
		}
		wearing.Unwear("API.example.com", response)
		return response
	}

	response := answered("application/json; charset=utf-8", `{"said":"Bearer tok/1+2","bare":"tok/1+2","query":"tok%2F1%2B2","path":"tok%2F1+2","lower":"tok%2f1%2b2"}`)
	read, _ := io.ReadAll(response.Body)
	want := `{"said":"Bearer spotlight-egress:TOKEN","bare":"spotlight-egress:TOKEN","query":"spotlight-egress%3ATOKEN","path":"spotlight-egress:TOKEN","lower":"spotlight-egress%3aTOKEN"}`
	if string(read) != want {
		t.Errorf("the sandbox read\n%s\nwant\n%s", read, want)
	}
	if response.ContentLength != -1 || response.Header.Get("Content-Length") != "" {
		t.Errorf("kept a length the body no longer has: %d %v", response.ContentLength, response.Header)
	}
	if location := response.Header.Get("Location"); location != "https://api.example.com/?t=spotlight-egress%3ATOKEN" {
		t.Errorf("redirected the sandbox to %q", location)
	}
	if link := response.Header.Get("Link"); strings.Contains(link, "tok") {
		t.Errorf("linked the sandbox to %q", link)
	}

	escaped := answered("application/json", `{"said":"tok\/1+2"}`)
	if read, _ := io.ReadAll(escaped.Body); string(read) != `{"said":"spotlight-egress:TOKEN"}` {
		t.Errorf("the sandbox read %s", read)
	}

	head := answered("application/json", "")
	head.Request = &http.Request{Method: http.MethodHead}
	head.Header.Set("Content-Length", "42")
	head.ContentLength = 42
	wearing.Unwear("api.example.com", head)
	if head.Header.Get("Content-Length") != "42" {
		t.Errorf("took the length off an answer with no body to change: %v", head.Header)
	}

	binary := answered("image/png", "tok/1+2")
	if read, _ := io.ReadAll(binary.Body); string(read) != "tok/1+2" || binary.ContentLength != 7 {
		t.Errorf("rewrote a body that is not text: %q", read)
	}

	if !strings.Contains(logged.String(), "it is worn in neither a header nor a query parameter") {
		t.Errorf("did not refuse a carrier that is neither: %s", logged.String())
	}
}
