package login

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"flag"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"

	"usespotlight.ai/data-plane/credentials"
)

const sessionToken = "Zq8mV2xR7tLk4NcW1pHs9dYb3fGj6aEu"

type answer struct {
	status int
	body   string
}

type spotlight struct {
	t         *testing.T
	mu        sync.Mutex
	code      string
	grants    []answer
	session   string
	signOut   int
	polled    int
	signedOut []string
	bodies    map[string]map[string]any
}

func pending() answer {
	return answer{http.StatusBadRequest, `{"error":"authorization_pending","error_description":"Authorization pending"}`}
}
func slowDown() answer {
	return answer{http.StatusBadRequest, `{"error":"slow_down","error_description":"Polling too frequently"}`}
}
func granted() answer {
	return answer{http.StatusOK, `{"access_token":"` + sessionToken + `","token_type":"Bearer","expires_in":604800}`}
}

func serve(t *testing.T, grants ...answer) (*spotlight, string) {
	t.Helper()

	s := &spotlight{
		t:       t,
		code:    `{"device_code":"dev_1","user_code":"WDJBMJHT","verification_uri":"https://spotlight.test/device","verification_uri_complete":"https://spotlight.test/device?user_code=WDJBMJHT","expires_in":600,"interval":5}`,
		grants:  grants,
		session: `{"user":{"email":"person@example.com","name":"Person"},"session":{"id":"ses_1"}}`,
		signOut: http.StatusOK,
		bodies:  map[string]map[string]any{},
	}
	server := httptest.NewServer(http.HandlerFunc(s.handle))
	t.Cleanup(server.Close)

	return s, server.URL
}

func (s *spotlight) handle(w http.ResponseWriter, r *http.Request) {
	s.mu.Lock()
	defer s.mu.Unlock()

	var body map[string]any
	if read, _ := io.ReadAll(r.Body); len(read) > 0 {
		_ = json.Unmarshal(read, &body)
	}
	s.bodies[r.Method+" "+r.URL.Path] = body

	if r.Header.Get(clientHeader) != "cli/test" {
		w.WriteHeader(http.StatusBadRequest)
		return
	}

	switch r.Method + " " + r.URL.Path {
	case "POST /api/auth/device/code":
		_, _ = io.WriteString(w, s.code)
	case "POST /api/auth/device/token":
		s.polled++
		next := s.grants[0]
		if len(s.grants) > 1 {
			s.grants = s.grants[1:]
		}
		w.WriteHeader(next.status)
		_, _ = io.WriteString(w, next.body)
	case "GET /api/auth/get-session":
		if r.Header.Get("Authorization") != "Bearer "+sessionToken {
			_, _ = io.WriteString(w, "null")
			return
		}
		_, _ = io.WriteString(w, s.session)
	case "POST /api/auth/sign-out":
		s.signedOut = append(s.signedOut, r.Header.Get("Authorization"))
		w.WriteHeader(s.signOut)
		_, _ = io.WriteString(w, `{"success":true}`)
	default:
		w.WriteHeader(http.StatusNotFound)
	}
}

type clock struct {
	at     time.Time
	slept  []time.Duration
	cancel context.CancelFunc
	after  int
}

func (c *clock) sleep(ctx context.Context, wait time.Duration) error {
	c.slept = append(c.slept, wait)
	if c.cancel != nil && len(c.slept) > c.after {
		c.cancel()
	}
	if err := ctx.Err(); err != nil {
		return err
	}
	c.at = c.at.Add(wait)
	return nil
}

func (c *clock) now() time.Time { return c.at }

type ran struct {
	out     string
	err     error
	clock   *clock
	opened  []string
	credDir string
}

func testClient(t *testing.T, env map[string]string) (*client, *bytes.Buffer, *clock, *[]string) {
	t.Helper()

	out := new(bytes.Buffer)
	at := &clock{at: time.Date(2026, 10, 21, 9, 0, 0, 0, time.UTC)}
	opened := &[]string{}

	return &client{
		env:     func(name string) string { return env[name] },
		out:     out,
		http:    &http.Client{Timeout: 5 * time.Second},
		version: "test",
		browse:  func(page string) error { *opened = append(*opened, page); return nil },
		sleep:   at.sleep,
		now:     at.now,
	}, out, at, opened
}

func loggingIn(t *testing.T, address string, args ...string) ran {
	t.Helper()

	dir := t.TempDir()
	c, out, at, opened := testClient(t, map[string]string{credentials.DirVar: dir, urlVar: address})
	err := c.login(context.Background(), args)

	return ran{out: out.String(), err: err, clock: at, opened: *opened, credDir: dir}
}

func stored(t *testing.T, dir string) map[string]credentials.Login {
	t.Helper()

	raw, err := os.ReadFile(filepath.Join(dir, "credentials.json"))
	if errors.Is(err, os.ErrNotExist) {
		return nil
	}
	if err != nil {
		t.Fatal(err)
	}

	var file struct {
		Logins map[string]credentials.Login `json:"logins"`
	}
	if err := json.Unmarshal(raw, &file); err != nil {
		t.Fatal(err)
	}

	return file.Logins
}

func TestLoginPollsUntilApprovedAndKeepsTheLogin(t *testing.T) {
	s, address := serve(t, pending(), pending(), granted())

	got := loggingIn(t, address+"/inbox")
	if got.err != nil {
		t.Fatalf("login: %v\n%s", got.err, got.out)
	}

	if s.polled != 3 || len(got.clock.slept) != 3 || got.clock.slept[0] != 5*time.Second {
		t.Fatalf("polled %d times after sleeping %v", s.polled, got.clock.slept)
	}
	if sent := s.bodies["POST /api/auth/device/token"]; sent["grant_type"] != deviceGrant || sent["device_code"] != "dev_1" || sent["client_id"] != clientID {
		t.Fatalf("polled with %v", sent)
	}
	if sent := s.bodies["POST /api/auth/device/code"]; sent["client_id"] != clientID {
		t.Fatalf("asked for a code with %v", sent)
	}

	for _, want := range []string{
		"https://spotlight.test/device?user_code=WDJBMJHT",
		"WDJB-MJHT",
		"Logged in to " + address + " as person@example.com.",
	} {
		if !strings.Contains(got.out, want) {
			t.Errorf("output %q, want %q in it", got.out, want)
		}
	}
	if len(got.opened) != 1 || got.opened[0] != "https://spotlight.test/device?user_code=WDJBMJHT" {
		t.Errorf("opened %v", got.opened)
	}

	logins := stored(t, got.credDir)
	if logins[address] != (credentials.Login{Token: sessionToken, User: "person@example.com"}) || len(logins) != 1 {
		t.Fatalf("stored %v", logins)
	}
}

func TestALoginPageThatIsNotAWebAddressIsNeverOpened(t *testing.T) {
	s, address := serve(t, granted())
	s.code = `{"device_code":"dev_1","user_code":"WDJBMJHT","verification_uri":"file:///etc/passwd","verification_uri_complete":"-a Calculator","expires_in":600,"interval":5}`

	got := loggingIn(t, address)
	if got.err == nil || len(got.opened) != 0 {
		t.Fatalf("login with a bad page: err %v, opened %v", got.err, got.opened)
	}
	if s.polled != 0 {
		t.Errorf("polled %d times", s.polled)
	}
}

func TestSlowDownAddsFiveSecondsToTheInterval(t *testing.T) {
	_, address := serve(t, slowDown(), pending(), slowDown(), granted())

	got := loggingIn(t, address)
	if got.err != nil {
		t.Fatalf("login: %v", got.err)
	}

	want := []time.Duration{5 * time.Second, 10 * time.Second, 10 * time.Second, 15 * time.Second}
	if len(got.clock.slept) != len(want) {
		t.Fatalf("slept %v, want %v", got.clock.slept, want)
	}
	for at := range want {
		if got.clock.slept[at] != want[at] {
			t.Fatalf("slept %v, want %v", got.clock.slept, want)
		}
	}
}

func TestADeniedLoginKeepsNothing(t *testing.T) {
	_, address := serve(t, pending(), answer{http.StatusBadRequest, `{"error":"access_denied","error_description":"Access denied"}`})

	got := loggingIn(t, address)
	if got.err == nil || !strings.Contains(got.err.Error(), "denied") {
		t.Fatalf("err = %v, want the denial", got.err)
	}
	if logins := stored(t, got.credDir); len(logins) != 0 {
		t.Fatalf("stored %v", logins)
	}
}

func TestAnExpiredCodeStopsTheLogin(t *testing.T) {
	_, address := serve(t, answer{http.StatusBadRequest, `{"error":"expired_token","error_description":"Device code has expired"}`})

	if got := loggingIn(t, address); got.err == nil || !strings.Contains(got.err.Error(), "expired") || !strings.Contains(got.err.Error(), "spotlight login") {
		t.Fatalf("err = %v, want the expiry", got.err)
	}
}

func TestTheLoginStopsAtTheCodesExpiry(t *testing.T) {
	s, address := serve(t, pending())
	s.code = `{"device_code":"dev_1","user_code":"WDJBMJHT","verification_uri":"https://spotlight.test/device","verification_uri_complete":"","expires_in":12,"interval":5}`

	got := loggingIn(t, address)
	if got.err == nil || !strings.Contains(got.err.Error(), "expired") {
		t.Fatalf("err = %v, want the expiry", got.err)
	}
	if s.polled != 2 {
		t.Fatalf("polled %d times, want 2 before the code expired", s.polled)
	}
	if !strings.Contains(got.out, "https://spotlight.test/device\n") {
		t.Fatalf("output %q, want the verification page", got.out)
	}
}

func TestAnyOtherRefusalIsReported(t *testing.T) {
	_, address := serve(t, answer{http.StatusBadRequest, `{"error":"invalid_grant","error_description":"Invalid device code"}`})

	if got := loggingIn(t, address); got.err == nil || !strings.Contains(got.err.Error(), "invalid_grant") || !strings.Contains(got.err.Error(), "Invalid device code") {
		t.Fatalf("err = %v", got.err)
	}
}

func TestATokenWithNoSessionIsNotKept(t *testing.T) {
	s, address := serve(t, granted())
	s.session = "null"

	got := loggingIn(t, address)
	if got.err == nil || !strings.Contains(got.err.Error(), "did not accept") {
		t.Fatalf("err = %v", got.err)
	}
	if logins := stored(t, got.credDir); len(logins) != 0 {
		t.Fatalf("stored %v", logins)
	}
}

func TestNoBrowserOpensNothing(t *testing.T) {
	_, address := serve(t, granted())

	got := loggingIn(t, address, "--no-browser")
	if got.err != nil || len(got.opened) != 0 {
		t.Fatalf("err %v, opened %v", got.err, got.opened)
	}
}

func TestCancelStopsTheLoginCleanly(t *testing.T) {
	_, address := serve(t, pending())
	dir := t.TempDir()
	c, _, at, _ := testClient(t, map[string]string{credentials.DirVar: dir, urlVar: address})

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	at.cancel, at.after = cancel, 1

	if err := c.login(ctx, nil); !errors.Is(err, errStopped) {
		t.Fatalf("err = %v, want it stopped", err)
	}
	if logins := stored(t, dir); len(logins) != 0 {
		t.Fatalf("stored %v", logins)
	}
}

func TestTheAddressComesFromTheFlagThenTheEnvironmentThenTheDefault(t *testing.T) {
	for _, each := range []struct {
		env  string
		args []string
		want string
	}{
		{"https://env.example.com", []string{"--url", "https://Flag.example.com/"}, "https://flag.example.com"},
		{"https://env.example.com/", nil, "https://env.example.com"},
		{"", nil, defaultAddress},
	} {
		c, _, _, _ := testClient(t, map[string]string{urlVar: each.env})
		got, err := c.address(newFlags(), each.args)
		if err != nil || got != each.want {
			t.Errorf("address with %q and %v = %q, %v, want %q", each.env, each.args, got, err, each.want)
		}
	}

	c, _, _, _ := testClient(t, nil)
	if _, err := c.address(newFlags(), []string{"--url", "http://spotlight.example.com"}); err == nil {
		t.Errorf("a plain http address was taken")
	}
	if _, err := c.address(newFlags(), []string{"extra"}); err == nil || !strings.Contains(err.Error(), "usage") {
		t.Errorf("err = %v, want the usage", err)
	}
}

func TestLogoutEndsTheSessionAndKeepsTheOtherLogins(t *testing.T) {
	s, address := serve(t)
	dir := t.TempDir()
	putLogins(t, dir, map[string]credentials.Login{
		address:                     {Token: sessionToken, User: "person@example.com"},
		"https://other.example.com": {Token: "tok_other", User: "other@example.com"},
	})

	c, out, _, _ := testClient(t, map[string]string{credentials.DirVar: dir, urlVar: address})
	if err := c.logout(context.Background(), nil); err != nil {
		t.Fatalf("logout: %v", err)
	}

	if len(s.signedOut) != 1 || s.signedOut[0] != "Bearer "+sessionToken {
		t.Fatalf("signed out with %v", s.signedOut)
	}
	if !strings.Contains(out.String(), "Logged out of "+address+".") {
		t.Fatalf("output %q", out.String())
	}
	logins := stored(t, dir)
	if _, found := logins[address]; found || logins["https://other.example.com"].Token != "tok_other" {
		t.Fatalf("stored %v", logins)
	}
}

func TestLogoutRemovesTheLoginWhenSpotlightFails(t *testing.T) {
	s, address := serve(t)
	s.signOut = http.StatusInternalServerError
	dir := t.TempDir()
	putLogins(t, dir, map[string]credentials.Login{address: {Token: sessionToken}})

	c, out, _, _ := testClient(t, map[string]string{credentials.DirVar: dir, urlVar: address})
	if err := c.logout(context.Background(), nil); err != nil {
		t.Fatalf("logout: %v", err)
	}

	if !strings.Contains(out.String(), "did not end the session") || !strings.Contains(out.String(), "Logged out of") {
		t.Fatalf("output %q", out.String())
	}
	if logins := stored(t, dir); len(logins) != 0 {
		t.Fatalf("stored %v", logins)
	}
}

func TestLogoutWithNoLoginSaysSo(t *testing.T) {
	s, address := serve(t)
	dir := t.TempDir()

	c, out, _, _ := testClient(t, map[string]string{credentials.DirVar: dir})
	if err := c.logout(context.Background(), []string{"--url", address}); err != nil {
		t.Fatalf("logout: %v", err)
	}

	if !strings.Contains(out.String(), "You are not logged in to "+address+".") || len(s.signedOut) != 0 {
		t.Fatalf("output %q, signed out %v", out.String(), s.signedOut)
	}
	if _, err := os.Stat(filepath.Join(dir, "credentials.json")); !errors.Is(err, os.ErrNotExist) {
		t.Fatalf("logout made a credentials file: %v", err)
	}
}

func newFlags() *flag.FlagSet { return flag.NewFlagSet("login", flag.ContinueOnError) }

func putLogins(t *testing.T, dir string, logins map[string]credentials.Login) {
	t.Helper()

	file, err := credentials.Load(filepath.Join(dir, "credentials.json"))
	if err != nil {
		t.Fatal(err)
	}
	for address, login := range logins {
		if err := file.Put(address, login); err != nil {
			t.Fatal(err)
		}
	}
	if err := file.Save(); err != nil {
		t.Fatal(err)
	}
}
