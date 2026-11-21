package inject

import (
	"bytes"
	"encoding/base64"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/url"
	"slices"
	"strings"
	"testing"

	"usespotlight.ai/data-plane/allowlist"
	"usespotlight.ai/data-plane/protocol"
)

type opener struct{}

func (opener) Open(sealed, runID, secret string) (string, error) {
	if runID != "run_1" {
		return "", errors.New("sealed for another run")
	}
	value, ok := strings.CutPrefix(sealed, "sealed:")
	if !ok {
		return "", errors.New("decryption failed")
	}
	return value, nil
}

func fetchedSecrets() protocol.EgressSecrets {
	return protocol.EgressSecrets{
		RunID: "run_1",
		Secrets: []protocol.FetchedSecret{
			{Secret: "LINEAR_API_KEY", Host: "MCP.linear.app", Location: "header", Name: "authorization", Prefix: "Bearer ", Sealed: "sealed:lin_api_1"},
			{Secret: "LINEAR_WORKSPACE", Host: "mcp.linear.app", Location: "header", Name: "x-workspace", Sealed: "sealed:acme"},
			{Secret: "SENTRY_TOKEN", Host: "sentry.io", Location: "header", Name: "x-sentry-token", Sealed: "sealed:sentry_1"},
			{Secret: "BROKEN", Host: "broken.example.com", Location: "header", Name: "authorization", Sealed: "tampered"},
			{Secret: "MULTI", Host: "multi.example.com", Location: "header", Name: "authorization", Sealed: "sealed:one\ntwo"},
			{Secret: "OUTSIDE", Host: "exfiltrate.example.net", Location: "header", Name: "authorization", Sealed: "sealed:outside"},
			{Secret: "SAME_HEADER", Host: "mcp.linear.app", Location: "header", Name: "Authorization", Sealed: "sealed:second"},
		},
		Denied: []protocol.DeniedSecret{{Secret: "NOWHERE", Reason: "no such secret"}},
	}
}

func injectInto(injector *Injector, host string, header http.Header) {
	injector.Inject(host, &http.Request{Header: header, URL: &url.URL{}})
}

func injectorWithSecrets(t *testing.T) (*Injector, *bytes.Buffer) {
	t.Helper()

	var logged bytes.Buffer
	hosts, err := allowlist.Parse([]string{"*.linear.app", "sentry.io", "broken.example.com", "multi.example.com"})
	if err != nil {
		t.Fatal(err)
	}
	injector := From(fetchedSecrets(), nil, hosts, opener{}, slog.New(slog.NewTextHandler(&logged, nil)))

	return injector, &logged
}

func TestInjectsEachSecretOnlyForItsOwnHost(t *testing.T) {
	injector, _ := injectorWithSecrets(t)

	if got := injector.Hosts(); !slices.Equal(got, []string{"mcp.linear.app", "sentry.io"}) {
		t.Errorf("injects for %v", got)
	}

	header := http.Header{
		"Authorization": {"Bearer spotlight-egress:LINEAR_API_KEY"},
		"X-Workspace":   {"spotlight-egress:LINEAR_WORKSPACE"},
		"Accept":        {"application/json"},
	}
	injectInto(injector, "mcp.linear.app", header)
	if header.Get("Authorization") != "Bearer lin_api_1" || header.Get("X-Workspace") != "acme" || len(header.Values("Authorization")) != 1 {
		t.Errorf("injected %v", header)
	}
	if header.Get("Accept") != "application/json" {
		t.Errorf("removed a header it does not inject: %v", header)
	}

	unbound := http.Header{"Authorization": {"Bearer mine"}}
	injectInto(injector, "api.github.com", unbound)
	if unbound.Get("Authorization") != "Bearer mine" {
		t.Errorf("injected a secret for a host it is not bound to: %v", unbound)
	}

	sentry := http.Header{"X-Sentry-Token": {"spotlight-egress:SENTRY_TOKEN"}}
	injectInto(injector, "SENTRY.io", sentry)
	if sentry.Get("X-Sentry-Token") != "sentry_1" {
		t.Errorf("did not inject the opened sealed value: %v", sentry)
	}
}

func TestInjectsARunSecretOnlyByReplacingItsStandIn(t *testing.T) {
	injector, logged := injectorWithSecrets(t)

	for _, sent := range []string{"Bearer spotlight-egress:LINEAR_API_KEY", "spotlight-egress:LINEAR_API_KEY"} {
		header := http.Header{"Authorization": {sent}}
		injectInto(injector, "mcp.linear.app", header)
		if header.Get("Authorization") != "Bearer lin_api_1" {
			t.Errorf("did not replace %q: %v", sent, header)
		}
	}

	own := http.Header{"Authorization": {"Bearer mine"}, "X-Workspace": {"theirs"}}
	injectInto(injector, "mcp.linear.app", own)
	if own.Get("Authorization") != "Bearer mine" || own.Get("X-Workspace") != "theirs" {
		t.Errorf("injected over what the sandbox sent without a stand-in: %v", own)
	}

	bare := http.Header{}
	injectInto(injector, "mcp.linear.app", bare)
	if len(bare) != 0 {
		t.Errorf("added a secret to a request that named none: %v", bare)
	}

	unknown := http.Header{"Authorization": {"Bearer spotlight-egress:LINEAR_API_KEYS"}, "X-Other": {"spotlight-egress:NOWHERE"}, "X-Shout": {"SPOTLIGHT-EGRESS:NOWHERE"}}
	injectInto(injector, "mcp.linear.app", unknown)
	if len(unknown) != 0 {
		t.Errorf("sent on a stand-in it has no value for: %v", unknown)
	}
	if !strings.Contains(logged.String(), "X-Other") {
		t.Errorf("did not say it removed a stand-in: %s", logged)
	}
	for _, value := range []string{"lin_api_1", "acme"} {
		if strings.Contains(logged.String(), value) {
			t.Errorf("logged the value %q", value)
		}
	}
}

func TestStoresNothingItCouldNotOpenOrInjectAndSaysWhyWithoutTheValue(t *testing.T) {
	injector, logged := injectorWithSecrets(t)

	if injector.InjectsFor("broken.example.com") || injector.InjectsFor("multi.example.com") {
		t.Error("stores a secret it could not open or inject")
	}
	for _, want := range []string{
		"NOWHERE", "no such secret", "BROKEN", "decryption failed", "MULTI",
		"OUTSIDE", "allow-list does not allow exfiltrate.example.net",
		"SAME_HEADER", "already injected in Authorization for mcp.linear.app",
	} {
		if !strings.Contains(logged.String(), want) {
			t.Errorf("did not log %q: %s", want, logged)
		}
	}
	if injector.InjectsFor("exfiltrate.example.net") {
		t.Error("injects for a host the allow-list leaves out")
	}
	for _, value := range []string{"lin_api_1", "acme", "sentry_1", "outside", "second"} {
		if strings.Contains(logged.String(), value) {
			t.Errorf("logged the value %q", value)
		}
	}
}

func TestWipesEveryValueItStored(t *testing.T) {
	injector, _ := injectorWithSecrets(t)
	value := injector.byHost["mcp.linear.app"][0].value

	injector.Wipe()

	if injector.InjectsFor("mcp.linear.app") || len(injector.Hosts()) != 0 {
		t.Error("still injects a secret after the wipe")
	}
	if strings.Trim(string(value), "\x00") != "" {
		t.Errorf("the value is still in memory: %q", value)
	}
}

func TestInjectsAKeyOfTheHostOnlyByReplacingItsOwnStandIn(t *testing.T) {
	var logged bytes.Buffer
	hosts, _ := allowlist.Parse([]string{"api.anthropic.com", "api.openai.com"})
	injector := From(protocol.EgressSecrets{
		RunID: "run_1",
		Secrets: []protocol.FetchedSecret{
			{Secret: "CLAUDE_OAUTH", Host: "api.anthropic.com", Location: "header", Name: "x-other", Sealed: "sealed:from-a-run"},
			{Secret: "DOTTED", Host: "API.anthropic.com.", Location: "header", Name: "x-dotted", Sealed: "sealed:dotted"},
		},
	}, []protocol.HarnessKey{
		{Name: "ANTHROPIC_API_KEY", Host: "api.anthropic.com", Header: "x-api-key", Value: "sk-ant-api"},
		{Name: "CLAUDE_CODE_OAUTH_TOKEN", Host: "api.anthropic.com", Header: "authorization", Prefix: "Bearer ", Value: "sk-ant-oat"},
		{Name: "OPENAI_API_KEY", Host: "api.openai.com", Header: "authorization", Prefix: "Bearer ", Value: "sk-openai"},
		{Name: "CODEX_API_KEY", Host: "api.openai.com", Header: "authorization", Prefix: "Bearer ", Value: "sk-codex"},
		{Name: "GITHUB_TOKEN", Host: "api.github.com", Header: "authorization", Prefix: "Bearer ", Value: "ghp"},
	}, hosts, opener{}, slog.New(slog.NewTextHandler(&logged, nil)))

	sent := func(host string, header http.Header) http.Header {
		injectInto(injector, host, header)
		return header
	}

	if got := sent("api.anthropic.com", http.Header{"X-Api-Key": {"spotlight-egress:ANTHROPIC_API_KEY"}}); got.Get("X-Api-Key") != "sk-ant-api" || got.Get("Authorization") != "" {
		t.Errorf("an API-key request went out as %v", got)
	}
	if got := sent("api.anthropic.com", http.Header{"Authorization": {"Bearer spotlight-egress:CLAUDE_CODE_OAUTH_TOKEN"}}); got.Get("Authorization") != "Bearer sk-ant-oat" || got.Get("X-Api-Key") != "" {
		t.Errorf("an OAuth request went out as %v", got)
	}
	if got := sent("api.anthropic.com", http.Header{"Authorization": {"spotlight-egress:CLAUDE_CODE_OAUTH_TOKEN"}}); got.Get("Authorization") != "" {
		t.Errorf("injected a host's key for its stand-in without the prefix: %v", got)
	}
	if got := sent("api.anthropic.com", http.Header{"Authorization": {"Bearer mine"}}); got.Get("Authorization") != "Bearer mine" || got.Get("X-Other") != "" {
		t.Errorf("injected a host's key over a value the sandbox chose: %v", got)
	}
	if got := sent("api.openai.com", http.Header{"Authorization": {"Bearer spotlight-egress:OPENAI_API_KEY"}}); got.Get("Authorization") != "Bearer sk-openai" {
		t.Errorf("an OpenAI request went out as %v", got)
	}
	if got := sent("api.openai.com", http.Header{"Authorization": {"Bearer spotlight-egress:CODEX_API_KEY"}}); got.Get("Authorization") != "Bearer sk-codex" {
		t.Errorf("a Codex request went out as %v", got)
	}

	for _, want := range []string{
		"GITHUB_TOKEN", "allow-list does not allow api.github.com",
		"CLAUDE_OAUTH", "has a key of its own for api.anthropic.com",
		"DOTTED",
	} {
		if !strings.Contains(logged.String(), want) {
			t.Errorf("did not log %q: %s", want, logged.String())
		}
	}
	if got := sent("api.anthropic.com", http.Header{}); got.Get("X-Dotted") != "" {
		t.Errorf("a secret bound to a dotted spelling of a host with a host key was injected: %v", got)
	}
	for _, value := range []string{"sk-ant-api", "sk-ant-oat", "sk-openai", "sk-codex", "ghp", "from-a-run", "dotted"} {
		if strings.Contains(logged.String(), value) {
			t.Errorf("logged the value %q", value)
		}
	}
}

func TestInjectsAQuerySecretOnlyByReplacingItsStandInKeepingTheRestOfTheQuery(t *testing.T) {
	var logged bytes.Buffer
	hosts, _ := allowlist.Parse([]string{"maps.googleapis.com", "api.example.com"})
	injector := From(protocol.EgressSecrets{
		RunID: "run_1",
		Secrets: []protocol.FetchedSecret{
			{Secret: "MAPS_KEY", Host: "maps.googleapis.com", Location: "query", Name: "key", Sealed: "sealed:AIza/1+2 3&x=y"},
			{Secret: "MAPS_HEADER", Host: "maps.googleapis.com", Location: "header", Name: "key", Sealed: "sealed:in-a-header"},
			{Secret: "SAME_TARGET", Host: "maps.googleapis.com", Location: "query", Name: "key", Sealed: "sealed:second"},
			{Secret: "PREFIXED", Host: "api.example.com", Location: "query", Name: "token", Prefix: "v1.", Sealed: "sealed:tok"},
			{Secret: "NAMELESS", Host: "api.example.com", Location: "query", Sealed: "sealed:nameless"},
		},
	}, nil, hosts, opener{}, slog.New(slog.NewTextHandler(&logged, nil)))

	sent := func(host, rawQuery string) string {
		request := &http.Request{Header: http.Header{}, URL: &url.URL{RawQuery: rawQuery}}
		injector.Inject(host, request)
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
		t.Errorf("sent on a query stand-in it has no value for: %q", got)
	}
	if got := sent("api.github.com", "key=spotlight-egress:MAPS_KEY"); got != "" {
		t.Errorf("injected a query secret for a host it is not bound to: %q", got)
	}

	header := http.Header{"Key": {"spotlight-egress:MAPS_HEADER"}}
	injectInto(injector, "maps.googleapis.com", header)
	if header.Get("Key") != "in-a-header" {
		t.Errorf("a header and a query parameter of one name were not both injected: %v", header)
	}

	for _, want := range []string{"SAME_TARGET", "already injected in ?key for maps.googleapis.com", "NAMELESS", "parameter=other", "parameter=key", "parameter=k"} {
		if !strings.Contains(logged.String(), want) {
			t.Errorf("did not log %q: %s", want, logged.String())
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
	hosts, _ := allowlist.Parse([]string{"api.example.com"})
	injector := From(protocol.EgressSecrets{
		RunID: "run_1",
		Secrets: []protocol.FetchedSecret{
			{Secret: "TOKEN", Host: "api.example.com", Location: "header", Name: "authorization", Prefix: "Bearer ", Sealed: "sealed:tok/1+2"},
			{Secret: "ODD", Host: "api.example.com", Location: "cookie", Name: "k", Sealed: "sealed:odd"},
		},
	}, nil, hosts, opener{}, slog.New(slog.NewTextHandler(&logged, nil)))

	answered := func(contentType, body string) *http.Response {
		response := &http.Response{
			Header:        http.Header{"Content-Type": {contentType}, "Content-Length": {fmt.Sprint(len(body))}, "Location": {"https://api.example.com/?t=tok%2F1%2B2"}, "Link": {"<https://x/?t=tok%2f1%2b2>"}},
			ContentLength: int64(len(body)),
			Body:          &trickle{text: []byte(body)},
		}
		injector.Redact("API.example.com", response)
		return response
	}

	response := answered("application/json; charset=utf-8", `{"echo":"Bearer tok/1+2","bare":"tok/1+2","query":"tok%2F1%2B2","path":"tok%2F1+2","lower":"tok%2f1%2b2"}`)
	read, _ := io.ReadAll(response.Body)
	want := `{"echo":"Bearer spotlight-egress:TOKEN","bare":"spotlight-egress:TOKEN","query":"spotlight-egress%3ATOKEN","path":"spotlight-egress:TOKEN","lower":"spotlight-egress%3aTOKEN"}`
	if string(read) != want {
		t.Errorf("the sandbox read\n%s\nwant\n%s", read, want)
	}
	if response.ContentLength != -1 || response.Header.Get("Content-Length") != "" {
		t.Errorf("left a length the body no longer has: %d %v", response.ContentLength, response.Header)
	}
	if location := response.Header.Get("Location"); location != "https://api.example.com/?t=spotlight-egress%3ATOKEN" {
		t.Errorf("redirected the sandbox to %q", location)
	}
	if link := response.Header.Get("Link"); strings.Contains(link, "tok") {
		t.Errorf("linked the sandbox to %q", link)
	}

	escaped := answered("application/json", `{"echo":"tok\/1+2"}`)
	if read, _ := io.ReadAll(escaped.Body); string(read) != `{"echo":"spotlight-egress:TOKEN"}` {
		t.Errorf("the sandbox read %s", read)
	}

	head := answered("application/json", "")
	head.Request = &http.Request{Method: http.MethodHead}
	head.Header.Set("Content-Length", "42")
	head.ContentLength = 42
	injector.Redact("api.example.com", head)
	if head.Header.Get("Content-Length") != "42" {
		t.Errorf("removed the length from an answer with no body to change: %v", head.Header)
	}

	binary := answered("image/png", "tok/1+2")
	if read, _ := io.ReadAll(binary.Body); string(read) != "tok/1+2" || binary.ContentLength != 7 {
		t.Errorf("rewrote a body that is not text: %q", read)
	}

	if !strings.Contains(logged.String(), "its location is neither a header nor a query parameter") {
		t.Errorf("did not reject a location that is neither: %s", logged.String())
	}
}

func controlPlane(t *testing.T, address string) *url.URL {
	t.Helper()
	parsed, err := url.Parse(address)
	if err != nil {
		t.Fatal(err)
	}
	return parsed
}

func plainRequest(header http.Header) *http.Request {
	return &http.Request{Header: header, URL: &url.URL{}}
}

func TestForControlPlaneInjectsTheRunsTokenByReplacingItsStandIn(t *testing.T) {
	injector, _ := injectorWithSecrets(t)
	if err := injector.ForControlPlane(&protocol.SpotlightAPI{Sealed: "sealed:run-token"}, controlPlane(t, "https://Spotlight.example.com"), "run_1", opener{}); err != nil {
		t.Fatal(err)
	}

	header := http.Header{"Authorization": {"Bearer " + protocol.SpotlightAPIStandIn}}
	injectInto(injector, "spotlight.example.com", header)

	if got := header.Get("Authorization"); got != "Bearer run-token" {
		t.Fatalf("Authorization = %q, want the run's token", got)
	}
	if !injector.InjectsFor("spotlight.example.com") {
		t.Fatal("egress should inject for the control plane")
	}
}

func TestForControlPlaneStoresNothingWithoutAToken(t *testing.T) {
	injector, _ := injectorWithSecrets(t)
	if err := injector.ForControlPlane(nil, controlPlane(t, "https://spotlight.example.com"), "run_1", opener{}); err != nil {
		t.Fatal(err)
	}

	if injector.InjectsFor("spotlight.example.com") {
		t.Fatal("egress should store nothing for the control plane")
	}
}

func TestForControlPlaneRejectsATokenSealedForAnotherRun(t *testing.T) {
	injector, _ := injectorWithSecrets(t)

	if err := injector.ForControlPlane(&protocol.SpotlightAPI{Sealed: "sealed:run-token"}, controlPlane(t, "https://spotlight.example.com"), "run_2", opener{}); err == nil {
		t.Fatal("a token sealed for another run should not open")
	}
}

func TestForControlPlaneRejectsAHeaderAnotherSecretUses(t *testing.T) {
	injector, _ := injectorWithSecrets(t)

	if err := injector.ForControlPlane(&protocol.SpotlightAPI{Sealed: "sealed:run-token"}, controlPlane(t, "https://mcp.linear.app"), "run_1", opener{}); err == nil {
		t.Fatal("the run's token should not take the Authorization header another secret uses")
	}
}

func TestInjectPlainInjectsTheRunsTokenOnlyOnThePlainControlPlanesOwnPort(t *testing.T) {
	injector, _ := injectorWithSecrets(t)
	if err := injector.ForControlPlane(&protocol.SpotlightAPI{Sealed: "sealed:run-token"}, controlPlane(t, "http://control-plane:3000"), "run_1", opener{}); err != nil {
		t.Fatal(err)
	}

	header := http.Header{"Authorization": {"Bearer " + protocol.SpotlightAPIStandIn}}
	injector.InjectPlain("control-plane", "3000", plainRequest(header))
	if got := header.Get("Authorization"); got != "Bearer run-token" {
		t.Fatalf("Authorization = %q, want the run's token on the control plane's port", got)
	}

	elsewhere := http.Header{"Authorization": {"Bearer " + protocol.SpotlightAPIStandIn}}
	injector.InjectPlain("control-plane", "80", plainRequest(elsewhere))
	if got := elsewhere.Get("Authorization"); got == "Bearer run-token" {
		t.Fatal("the run's token went to another port of the control plane's host")
	}
}

func TestInjectPlainNeverInjectsTheTokenOfAnHTTPSControlPlane(t *testing.T) {
	injector, _ := injectorWithSecrets(t)
	if err := injector.ForControlPlane(&protocol.SpotlightAPI{Sealed: "sealed:run-token"}, controlPlane(t, "https://spotlight.example.com"), "run_1", opener{}); err != nil {
		t.Fatal(err)
	}

	header := http.Header{"Authorization": {"Bearer " + protocol.SpotlightAPIStandIn}}
	injector.InjectPlain("spotlight.example.com", "80", plainRequest(header))

	if got := header.Get("Authorization"); got == "Bearer run-token" {
		t.Fatal("the run's token went over plain HTTP to an HTTPS control plane")
	}
}

func TestInjectPlainInjectsNoOtherSecret(t *testing.T) {
	injector, _ := injectorWithSecrets(t)

	header := http.Header{"X-Workspace": {protocol.StandInPrefix + "LINEAR_WORKSPACE"}}
	injector.InjectPlain("mcp.linear.app", "80", plainRequest(header))

	if got := header.Get("X-Workspace"); got != "" {
		t.Fatalf("X-Workspace = %q, want the stand-in taken off rather than injected over plain HTTP", got)
	}
}

func basicOf(user, password string) string {
	return "Basic " + base64.StdEncoding.EncodeToString([]byte(user+":"+password))
}

func TestForControlPlaneSwapsTheStandInSentAsABasicPassword(t *testing.T) {
	injector, _ := injectorWithSecrets(t)
	if err := injector.ForControlPlane(&protocol.SpotlightAPI{Sealed: "sealed:run-token"}, controlPlane(t, "https://spotlight.example.com"), "run_1", opener{}); err != nil {
		t.Fatal(err)
	}

	header := http.Header{"Authorization": {basicOf("spotlight", protocol.SpotlightAPIStandIn)}}
	injectInto(injector, "spotlight.example.com", header)

	if got := header.Get("Authorization"); got != "Bearer run-token" {
		t.Fatalf("Authorization = %q, want the run's token as a Bearer token", got)
	}
}

func TestOnlyTheControlPlaneTakesTheStandInAsABasicPassword(t *testing.T) {
	injector, _ := injectorWithSecrets(t)
	if err := injector.ForControlPlane(&protocol.SpotlightAPI{Sealed: "sealed:run-token"}, controlPlane(t, "https://spotlight.example.com"), "run_1", opener{}); err != nil {
		t.Fatal(err)
	}

	untouched := basicOf("spotlight", "a-password")
	header := http.Header{"Authorization": {untouched}}
	injectInto(injector, "spotlight.example.com", header)
	if got := header.Get("Authorization"); got != untouched {
		t.Errorf("Authorization = %q, want Basic credentials without the stand-in left as they were", got)
	}

	for _, sent := range []string{
		basicOf("spotlight", "x"+protocol.SpotlightAPIStandIn),
		basicOf(protocol.SpotlightAPIStandIn, ""),
	} {
		header := http.Header{"Authorization": {sent}}
		injectInto(injector, "spotlight.example.com", header)
		if got := header.Get("Authorization"); got != "" {
			t.Errorf("Authorization %q became %q, want it removed", sent, got)
		}
	}

	elsewhere := http.Header{"Authorization": {basicOf("spotlight", protocol.SpotlightAPIStandIn)}}
	injectInto(injector, "example.org", elsewhere)
	if got := elsewhere.Get("Authorization"); got != "" {
		t.Fatalf("Authorization to another host = %q, want it removed", got)
	}
}

func TestTheBasicSchemeIsReadInAnyCase(t *testing.T) {
	injector, _ := injectorWithSecrets(t)
	if err := injector.ForControlPlane(&protocol.SpotlightAPI{Sealed: "sealed:run-token"}, controlPlane(t, "https://spotlight.example.com"), "run_1", opener{}); err != nil {
		t.Fatal(err)
	}

	header := http.Header{"Authorization": {"basic " + base64.StdEncoding.EncodeToString([]byte("spotlight:"+protocol.SpotlightAPIStandIn))}}
	injectInto(injector, "spotlight.example.com", header)

	if got := header.Get("Authorization"); got != "Bearer run-token" {
		t.Fatalf("Authorization = %q, want the run's token", got)
	}
}

func TestInjectPlainSwapsABasicStandInOnThePlainControlPlanesPort(t *testing.T) {
	injector, _ := injectorWithSecrets(t)
	if err := injector.ForControlPlane(&protocol.SpotlightAPI{Sealed: "sealed:run-token"}, controlPlane(t, "http://control-plane:3000"), "run_1", opener{}); err != nil {
		t.Fatal(err)
	}

	header := http.Header{"Authorization": {basicOf("spotlight", protocol.SpotlightAPIStandIn)}}
	injector.InjectPlain("control-plane", "3000", plainRequest(header))

	if got := header.Get("Authorization"); got != "Bearer run-token" {
		t.Fatalf("Authorization = %q, want the run's token", got)
	}
}

func TestARedactorSwapsEachSpellingOfAValueForItsSecretsStandIn(t *testing.T) {
	redactor := RedactorOf(map[string]string{"APP_KEY": "a/b c\n\"d\"", "EMPTY": ""})

	for _, written := range []string{
		"raw a/b c\n\"d\" end",
		`json "a/b c\n\"d\"" end`,
		"query a%2Fb+c%0A%22d%22 end",
		"path a%2Fb%20c%0A%22d%22 end",
	} {
		if got := redactor.Text(written); strings.Contains(got, "a/b") || strings.Contains(got, "a%2F") || !strings.Contains(got, "APP_KEY") {
			t.Errorf("%q became %q", written, got)
		}
	}
	if got := redactor.Text("nothing secret"); got != "nothing secret" {
		t.Errorf("redacted %q", got)
	}
	if got := (*Redactor)(nil).Text("as it was"); got != "as it was" {
		t.Errorf("no redactor redacted %q", got)
	}
}

func TestARedactorSwapsAValueThatSpansLinesWithItsLinesJoinedBySpacesOrCarriageReturns(t *testing.T) {
	redactor := RedactorOf(map[string]string{"APP_KEY": "-----BEGIN KEY-----\nMIIEvQIBADANBgkq\nabc\n-----END KEY-----\n"})

	for _, written := range []string{
		"-----BEGIN KEY----- MIIEvQIBADANBgkq abc -----END KEY-----",
		"-----BEGIN KEY-----\r\nMIIEvQIBADANBgkq\r\nabc\r\n-----END KEY-----",
	} {
		if got := redactor.Text(written); strings.Contains(got, "MIIEvQ") || strings.Contains(got, "BEGIN") {
			t.Errorf("%q became %q", written, got)
		}
	}
	indented := RedactorOf(map[string]string{"SA_KEY": "{\n  \"type\": \"service_account\",\n\n  \"private_key\": \"MIIEvQIBADANBgkq\"\n}\n"})
	if got := indented.Text(`{ "type": "service_account", "private_key": "MIIEvQIBADANBgkq" }`); strings.Contains(got, "MIIEvQ") {
		t.Errorf("the words of an indented value became %q", got)
	}

	for _, written := range []string{"abc", "-----BEGIN KEY-----"} {
		if got := redactor.Text(written); got != written {
			t.Errorf("redacted the line %q alone", got)
		}
	}

	redacted, held := redactor.Partial("-----BEGIN KEY----- MIIEvQ")
	if redacted != "" || held != "-----BEGIN KEY----- MIIEvQ" {
		t.Errorf("redacted %q and held %q", redacted, held)
	}
}

func TestARedactorHoldsBackTextThatMayStartAValue(t *testing.T) {
	redactor := RedactorOf(map[string]string{"APP_KEY": "private-key"})

	redacted, held := redactor.Partial("the key is priv")
	if redacted != "the key is " || held != "priv" {
		t.Errorf("redacted %q and held %q", redacted, held)
	}
	redacted, held = redactor.Partial(held + "ate-key, done")
	if redacted != protocol.StandInPrefix+"APP_KEY, done" || held != "" {
		t.Errorf("redacted %q and held %q", redacted, held)
	}
	if redacted, held = (*Redactor)(nil).Partial("priv"); redacted != "priv" || held != "" {
		t.Errorf("no redactor redacted %q and held %q", redacted, held)
	}
}
