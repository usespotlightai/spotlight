package replay

import (
	"bytes"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"testing"
	"time"
)

const token = "q3Vd0n8yXbT2c4kPzR7mW1sLhA9eJ5gUfN6oYiC0xEw"

type asked struct {
	method  string
	path    string
	headers http.Header
	body    map[string]any
}

type spotlight struct {
	t        *testing.T
	mu       sync.Mutex
	asked    []asked
	replays  []string
	answers  map[string]string
	statuses map[string]int
	failing  map[string][]int
}

const candidates = `{"items":[
  {"id":"cand_1","version":0,"address":"core/delivery/build/Shorter prompt","stationId":"st_build","stationAddress":"core/delivery/build","name":"Shorter prompt","station":{"key":"build"},"fingerprint":"` + fp + `","changedFrom":{"fingerprint":"` + liveFP + `","changes":[{"part":"prompt","name":null,"kind":"changed","was":null,"now":null},{"part":"model","name":null,"kind":"changed","was":"sonnet","now":"opus"},{"part":"skill","name":"tdd","kind":"added","was":null,"now":null}]},"createdAt":"2026-10-02T09:00:00.000Z"}
]}`

const (
	fp     = "5a7c9e1b3d5f7a9c1e3b5d7f9a1c3e5b7d9f1a3c5e7b9d1f3a5c7e9b1d3f5a7c"
	liveFP = "9f2c4e7a1b3d5f8a0c6e2b4d7f9a1c3e5b8d0f2a4c6e8b0d2f4a6c8e0b2d4f6a"
)

const sets = `[
  {"id":"set_1","lineId":"line_1","stationId":"st_build","name":"Queue fixes","createdAt":"2026-10-01T09:00:00.000Z","stationGone":false,"entries":[{"runId":"run_1","taskId":"task_1","refusal":null},{"runId":"run_2","taskId":"task_2","refusal":"archive-gone"}]},
  {"id":"set_2","lineId":"line_1","stationId":"st_build","name":"Flaky","createdAt":"2026-10-01T10:00:00.000Z","stationGone":false,"entries":[]},
  {"id":"set_3","lineId":"line_1","stationId":"st_build","name":"Flaky","createdAt":"2026-10-01T11:00:00.000Z","stationGone":false,"entries":[]}
]`

func replayOf(state string, regressed bool) string {
	candidateResult, baselineResult := "succeeded", "succeeded"
	if regressed {
		candidateResult = "failed"
	}

	return `{"id":"replay_1","setId":"set_1","state":"` + state + `","isBaseline":false,
  "candidate":{"id":"cand_1","name":"Shorter prompt","kind":"proposed"},
  "ceiling":{"amount":5,"currency":"USD"},
  "totals":{"entries":2,"settled":2,"succeeded":1,"successRate":0.5,"scored":2,"unscored":0,"spent":{"amount":1.25,"currency":"USD"}},
  "baselineReplayId":"replay_base",
  "comparison":[
    {"taskId":"task_2","candidate":[{"result":"` + candidateResult + `"}],"baseline":[{"result":"` + baselineResult + `"}],"costDelta":0.1,"stepsDelta":3,"scoreDelta":null,"regressed":` + map[bool]string{true: "true", false: "false"}[regressed] + `},
    {"taskId":"task_1","candidate":[{"result":"succeeded"}],"baseline":[],"costDelta":null,"stepsDelta":null,"scoreDelta":null,"regressed":false}
  ]}`
}

const baseline = `{"id":"replay_base","setId":"set_1","state":"finished","isBaseline":true,
  "candidate":{"id":"cand_live","name":"Live config, 2026-10-01","kind":"live"},
  "ceiling":{"amount":5,"currency":"USD"},
  "totals":{"entries":2,"settled":2,"succeeded":2,"successRate":1,"scored":2,"unscored":0,"spent":{"amount":1,"currency":"USD"}},
  "baselineReplayId":"replay_base","comparison":[]}`

func serve(t *testing.T) *spotlight {
	t.Helper()

	s := &spotlight{
		t: t,
		answers: map[string]string{
			"GET /api/resources/workspaces":                                     `{"items":[{"id":"ws_1","slug":"acme"}]}`,
			"GET /api/resources/workspaces/ws_1/lines/import":                   `{"id":"line_1","teamId":"team_1","definition":{"stations":[{"key":"backlog"},{"key":"build"},{"key":"ship"}]}}`,
			"GET /api/resources/workspaces/ws_1/teams/import":                   `{"id":"team_1"}`,
			"GET /api/resources/workspaces/ws_1/replay-candidates":              candidates,
			"GET /api/teams/team_1/replay-sets":                                 sets,
			"POST /api/teams/team_1/replay-sets/set_1/replays":                  `{"id":"replay_1","ceiling":{"amount":5,"currency":"USD"},"baseline":{"id":"replay_base","ceiling":{"amount":5,"currency":"USD"},"status":"starting"}}`,
			"GET /api/teams/team_1/replays/replay_base":                         baseline,
			"POST /api/teams/team_1/replays/replay_1/stop":                      ``,
			"POST /api/resources/lines/line_1/stations/build/replay-candidates": `{"id":"cand_2","version":0,"address":"core/delivery/build/Faster","name":"Faster","fingerprint":"` + fp + `","changedFrom":{"fingerprint":"` + liveFP + `","changes":[{"part":"effort","name":null,"kind":"added","was":null,"now":"low"}]},"createdAt":"2026-10-02T09:00:00.000Z"}`,
		},
		failing: map[string][]int{},
		statuses: map[string]int{
			"POST /api/resources/lines/line_1/stations/build/replay-candidates": http.StatusCreated,
			"POST /api/teams/team_1/replay-sets/set_1/replays":                  http.StatusCreated,
			"POST /api/teams/team_1/replays/replay_1/stop":                      http.StatusNoContent,
		},
	}

	server := httptest.NewServer(http.HandlerFunc(s.handle))
	t.Cleanup(server.Close)
	t.Setenv(urlVar, server.URL+"/")
	t.Setenv(tokenVar, token)

	return s
}

func (s *spotlight) handle(w http.ResponseWriter, r *http.Request) {
	s.mu.Lock()
	defer s.mu.Unlock()

	var body map[string]any
	if read, _ := io.ReadAll(r.Body); len(read) > 0 {
		_ = json.Unmarshal(read, &body)
	}
	s.asked = append(s.asked, asked{method: r.Method, path: r.URL.RequestURI(), headers: r.Header.Clone(), body: body})

	if r.Header.Get("Authorization") != "Bearer "+token || r.Header.Get(clientHeader) != "cli/test" {
		w.WriteHeader(http.StatusUnauthorized)
		_, _ = w.Write([]byte(`{"title":"No valid credentials","status":401}`))
		return
	}

	route := r.Method + " " + r.URL.Path
	if failed := s.failing[route]; len(failed) > 0 {
		s.failing[route] = failed[1:]
		w.WriteHeader(failed[0])
		_, _ = w.Write([]byte(`{"title":"Something went wrong","status":` + strconv.Itoa(failed[0]) + `}`))
		return
	}
	if route == "GET /api/teams/team_1/replays/replay_1" {
		next := s.replays[0]
		if len(s.replays) > 1 {
			s.replays = s.replays[1:]
		}
		_, _ = w.Write([]byte(next))
		return
	}

	answer, held := s.answers[route]
	if !held {
		w.Header().Set("Content-Type", "application/problem+json")
		w.WriteHeader(http.StatusNotFound)
		_, _ = w.Write([]byte(`{"title":"No such thing","detail":"No such thing that you may see","status":404}`))
		return
	}

	if status, set := s.statuses[route]; set {
		w.WriteHeader(status)
	}
	_, _ = w.Write([]byte(answer))
}

func (s *spotlight) last(method, path string) asked {
	s.t.Helper()
	s.mu.Lock()
	defer s.mu.Unlock()

	for at := len(s.asked) - 1; at >= 0; at-- {
		if s.asked[at].method == method && strings.HasPrefix(s.asked[at].path, path) {
			return s.asked[at]
		}
	}

	s.t.Fatalf("Spotlight was never asked %s %s; it was asked %v", method, path, s.asked)
	return asked{}
}

func replaying(args ...string) (string, error) {
	out := new(bytes.Buffer)
	err := runWith(args, strings.NewReader(""), out)

	return out.String(), err
}

func runWith(args []string, in io.Reader, out io.Writer) error {
	return run(args, in, out, "test")
}

func writeBlock(t *testing.T, name, content string) string {
	t.Helper()
	path := filepath.Join(t.TempDir(), name)
	if err := os.WriteFile(path, []byte(content), 0o644); err != nil {
		t.Fatal(err)
	}

	return path
}

func TestProposeSendsTheStationBlockOnceAndSaysWhatItChanges(t *testing.T) {
	spotlight := serve(t)
	block := writeBlock(t, "build.json", `{"key":"build","name":"Build","kind":"work","effort":"low"}`)

	said, err := replaying("propose", "--station", "core/delivery/build", "--name", "Faster", block)
	if err != nil {
		t.Fatalf("propose: %v", err)
	}

	sent := spotlight.last(http.MethodPost, "/api/resources/lines/line_1/stations/build/replay-candidates")
	if sent.headers.Get(idempotencyHeader) == "" {
		t.Fatalf("the proposal carried no Idempotency-Key")
	}
	if sent.body["name"] != "Faster" || sent.body["station"].(map[string]any)["effort"] != "low" {
		t.Fatalf("sent %v", sent.body)
	}
	spotlight.last(http.MethodGet, "/api/resources/workspaces/ws_1/lines/import?address=core%2Fdelivery")

	for _, want := range []string{"Proposed core/delivery/build/Faster (cand_2); nothing is applied.", "effort none → low", "9f2c4e7a1b3d"} {
		if !strings.Contains(said, want) {
			t.Fatalf("said %q, want %q in it", said, want)
		}
	}
}

func TestProposeReadsTheBlockFromStdin(t *testing.T) {
	spotlight := serve(t)
	out := new(bytes.Buffer)

	if err := runWith([]string{"propose", "--station", "core/delivery/build", "--name", "Faster", "--json", "-"}, strings.NewReader(`{"key":"build"}`), out); err != nil {
		t.Fatalf("propose: %v", err)
	}

	if spotlight.last(http.MethodPost, "/api/resources/lines/").body["station"].(map[string]any)["key"] != "build" {
		t.Fatalf("the block from stdin was not sent")
	}

	var answered map[string]any
	if err := json.Unmarshal(out.Bytes(), &answered); err != nil || answered["id"] != "cand_2" {
		t.Fatalf("--json said %q", out.String())
	}
}

func TestProposeRefusesHCLAndWhatIsNoObject(t *testing.T) {
	serve(t)

	for file, content := range map[string]string{
		"build.tf":   `station { key = "build" }`,
		"build.json": `["build"]`,
	} {
		_, err := replaying("propose", "--station", "core/delivery/build", "--name", "Faster", writeBlock(t, file, content))
		if err == nil {
			t.Fatalf("%s was proposed", file)
		}
	}

	_, err := replaying("propose", "--station", "core/delivery/build", "--name", "Faster", writeBlock(t, "build.tf", ""))
	if err == nil || !strings.Contains(err.Error(), "never reads it") {
		t.Fatalf("err = %v, want HCL refused", err)
	}
}

func TestProposeTellsEachProblemAtItsField(t *testing.T) {
	spotlight := serve(t)
	spotlight.answers["POST /api/resources/lines/line_1/stations/build/replay-candidates"] = `{"type":"urn:spotlight:problem:invalid","title":"The replay candidate is not valid","status":422,"errors":[{"path":"station.judge.rubric","message":"must not be empty"}]}`
	spotlight.statuses["POST /api/resources/lines/line_1/stations/build/replay-candidates"] = http.StatusUnprocessableEntity

	_, err := replaying("propose", "--station", "core/delivery/build", "--name", "Blank", writeBlock(t, "b.json", `{"key":"build"}`))
	if err == nil || !strings.Contains(err.Error(), "station.judge.rubric: must not be empty") {
		t.Fatalf("err = %v, want the field problem", err)
	}
}

func TestStationIsCheckedAgainstTheLine(t *testing.T) {
	serve(t)

	for _, station := range []string{"core/delivery", "core//build"} {
		if _, err := replaying("candidates", "--station", station); err == nil || !strings.Contains(err.Error(), "team, line and station key") {
			t.Fatalf("%s: err = %v", station, err)
		}
	}

	_, err := replaying("candidates", "--station", "core/delivery/polish")
	if err == nil || !strings.Contains(err.Error(), "it has backlog, build, ship") {
		t.Fatalf("err = %v, want the line's stations", err)
	}
}

func TestCandidatesListsTheStationsOwn(t *testing.T) {
	spotlight := serve(t)

	said, err := replaying("candidates", "--station", "core/delivery/build")
	if err != nil {
		t.Fatalf("candidates: %v", err)
	}

	spotlight.last(http.MethodGet, "/api/resources/workspaces/ws_1/replay-candidates?station=core%2Fdelivery%2Fbuild")
	for _, want := range []string{"NAME", "Shorter prompt", "cand_1"} {
		if !strings.Contains(said, want) {
			t.Fatalf("said %q, want %q", said, want)
		}
	}
}

func TestShowSaysWhatTheCandidateChanges(t *testing.T) {
	serve(t)

	said, err := replaying("show", "--station", "core/delivery/build", "Shorter prompt")
	if err != nil {
		t.Fatalf("show: %v", err)
	}

	for _, want := range []string{"prompt changed", "model sonnet → opus", "skill tdd added"} {
		if !strings.Contains(said, want) {
			t.Fatalf("said %q, want %q", said, want)
		}
	}

	if _, err := replaying("show", "--station", "core/delivery/build", "Missing"); err == nil || !strings.Contains(err.Error(), "it has Shorter prompt") {
		t.Fatalf("err = %v, want the candidates named", err)
	}
}

func TestSetsListsTheStationsSetsByLineAndKey(t *testing.T) {
	spotlight := serve(t)

	said, err := replaying("sets", "--station", "core/delivery/build")
	if err != nil {
		t.Fatalf("sets: %v", err)
	}

	spotlight.last(http.MethodGet, "/api/teams/team_1/replay-sets?line=line_1&station=build")
	if !strings.Contains(said, "Queue fixes") || !strings.Contains(said, "set_1") {
		t.Fatalf("said %q", said)
	}
}

func TestStartReplaysASetUnderACandidateNamedWithinACeiling(t *testing.T) {
	spotlight := serve(t)

	said, err := replaying("start", "--station", "core/delivery/build", "--set", "Queue fixes", "--candidate", "Shorter prompt", "--ceiling", "5")
	if err != nil {
		t.Fatalf("start: %v", err)
	}

	sent := spotlight.last(http.MethodPost, "/api/teams/team_1/replay-sets/set_1/replays")
	if sent.body["candidate"] != "cand_1" || sent.body["ceiling"].(map[string]any)["amount"] != 5.0 || sent.body["ceiling"].(map[string]any)["currency"] != "USD" || sent.body["repeats"] != 1.0 {
		t.Fatalf("sent %v", sent.body)
	}
	for _, want := range []string{"replay_1", "replay_base", "spotlight replay watch --team core replay_1"} {
		if !strings.Contains(said, want) {
			t.Fatalf("said %q, want %q", said, want)
		}
	}
}

func TestStartReplaysEachRunAsOftenAsAsked(t *testing.T) {
	spotlight := serve(t)

	said, err := replaying("start", "--station", "core/delivery/build", "--set", "Queue fixes", "--candidate", "live", "--ceiling", "5", "--repeats", "3")
	if err != nil {
		t.Fatalf("start: %v", err)
	}
	if sent := spotlight.last(http.MethodPost, "/api/teams/team_1/replay-sets/set_1/replays"); sent.body["repeats"] != 3.0 {
		t.Fatalf("sent %v", sent.body)
	}
	if !strings.Contains(said, "replays each run 3 times") {
		t.Fatalf("said %q", said)
	}
	if _, err := replaying("start", "--station", "core/delivery/build", "--set", "Queue fixes", "--candidate", "live", "--ceiling", "5", "--repeats", "6"); err == nil || !strings.Contains(err.Error(), "--repeats") {
		t.Fatalf("err = %v, want --repeats refused", err)
	}
}

func TestStatusGivesEachRateItsIntervalAndSaysWhenTheGainIsWithinNoise(t *testing.T) {
	spotlight := serve(t)
	spotlight.replays = []string{strings.Replace(
		strings.Replace(replayOf("finished", false), `"totals":{"entries":2,`, `"repeats":2,"againstBaseline":{"gain":-0.5,"low":-1,"high":0,"verdict":"within-noise","minGain":0.05,"tasks":2},"totals":{"interval":{"rate":0.5,"low":0,"high":1},"tasks":2,"tasksScored":2,"entries":2,`, 1),
		`"candidate":[{"result":"succeeded"}],"baseline":[]`, `"candidate":[{"result":"succeeded"},{"result":"failed"}],"baseline":[]`, 1,
	)}

	said, err := replaying("status", "--team", "core", "replay_1")
	if err != nil {
		t.Fatalf("status: %v", err)
	}
	for _, want := range []string{
		"It replays each run 2 times.",
		"Succeeded: 1 of 2 (50%); 50% (0–100%) over 2 of 2 tasks, 0 unscored",
		"Within noise of the baseline: -50 points (-100 to +0) over 2 tasks",
		"succeeded/failed",
	} {
		if !strings.Contains(said, want) {
			t.Fatalf("said %q, want %q", said, want)
		}
	}
}

func TestStartRefusesAnAmbiguousSetAndANothingCeiling(t *testing.T) {
	serve(t)

	if _, err := replaying("start", "--station", "core/delivery/build", "--set", "Flaky", "--candidate", "live", "--ceiling", "5"); err == nil || !strings.Contains(err.Error(), "set_2, set_3") {
		t.Fatalf("err = %v, want the ids to pick from", err)
	}
	if _, err := replaying("start", "--station", "core/delivery/build", "--set", "set_1", "--candidate", "live", "--ceiling", "0"); err == nil {
		t.Fatalf("a ceiling of nothing was taken")
	}
}

func TestStatusShowsRegressionsFirstAndExitsAsRegressed(t *testing.T) {
	spotlight := serve(t)
	spotlight.replays = []string{replayOf("finished", true)}

	said, err := replaying("status", "--team", "core", "replay_1")
	if !errors.Is(err, errRegressed) {
		t.Fatalf("err = %v, want a regression", err)
	}

	regressed := strings.Index(said, "REGRESSED")
	if regressed < 0 || regressed > strings.Index(said, "task_1") {
		t.Fatalf("said %q, want the regression first", said)
	}
	for _, want := range []string{"Succeeded: 1 of 2 (50%), 0 unscored", "Its baseline, finished: 2 of 2 (100%)", "1.25 USD of 5 USD"} {
		if !strings.Contains(said, want) {
			t.Fatalf("said %q, want %q", said, want)
		}
	}
	spotlight.last(http.MethodGet, "/api/resources/workspaces/ws_1/teams/import?address=core")
}

func TestStatusOwnsUpToSpendingPastTheCeiling(t *testing.T) {
	spotlight := serve(t)
	spotlight.replays = []string{strings.Replace(replayOf("over-budget", false), `"spent":{"amount":1.25`, `"spent":{"amount":5.5`, 1)}

	said, err := replaying("status", "--team", "core", "replay_1")
	if err != nil {
		t.Fatalf("status: %v", err)
	}
	if !strings.Contains(said, "5.5 USD of 5 USD spent, over the ceiling by 0.5 USD") {
		t.Fatalf("said %q", said)
	}
}

func TestStatusOfACandidateThatHeldUpExitsCleanly(t *testing.T) {
	spotlight := serve(t)
	spotlight.replays = []string{replayOf("finished", false)}

	if _, err := replaying("status", "--team", "core", "replay_1"); err != nil {
		t.Fatalf("status: %v", err)
	}
}

func TestWatchAsksUntilTheReplayAndItsBaselineEnd(t *testing.T) {
	spotlight := serve(t)
	spotlight.replays = []string{replayOf("running", false), replayOf("running", false), replayOf("finished", true)}
	out := new(bytes.Buffer)
	slept := 0
	c := &cli{api: newAPI(os.Getenv(urlVar), token, "test"), out: out, in: strings.NewReader(""), sleep: func(time.Duration) { slept++ }}

	var answered map[string]any
	err := c.watch([]string{"--team", "core", "replay_1", "--json"})
	if !errors.Is(err, errRegressed) {
		t.Fatalf("err = %v, want a regression", err)
	}
	if slept != 2 {
		t.Fatalf("slept %d times, want 2", slept)
	}
	if json.Unmarshal(out.Bytes(), &answered) != nil || answered["replay"].(map[string]any)["state"] != "finished" || answered["baseline"].(map[string]any)["id"] != "replay_base" {
		t.Fatalf("--json said %q", out.String())
	}
}

func TestStopStopsTheReplayAndAnswersAsSpotlightReadsItAfter(t *testing.T) {
	spotlight := serve(t)
	spotlight.replays = []string{replayOf("stopped", false)}

	said, err := replaying("stop", "--team", "core", "replay_1")
	if err != nil {
		t.Fatalf("stop: %v", err)
	}

	spotlight.last(http.MethodPost, "/api/teams/team_1/replays/replay_1/stop")
	if !strings.Contains(said, "Stopped replay replay_1, now stopped") {
		t.Fatalf("said %q", said)
	}

	out := new(bytes.Buffer)
	if err := runWith([]string{"stop", "--team", "core", "--json", "replay_1"}, strings.NewReader(""), out); err != nil {
		t.Fatalf("stop --json: %v", err)
	}
	var answered map[string]any
	if json.Unmarshal(out.Bytes(), &answered) != nil || answered["state"] != "stopped" || answered["setId"] != "set_1" {
		t.Fatalf("--json said %q", out.String())
	}
}

func watcher(t *testing.T) (*cli, *[]time.Duration) {
	t.Helper()
	slept := []time.Duration{}

	return &cli{
		api:   newAPI(os.Getenv(urlVar), token, "test"),
		out:   new(bytes.Buffer),
		in:    strings.NewReader(""),
		sleep: func(d time.Duration) { slept = append(slept, d) },
	}, &slept
}

func TestWatchRidesOutPassingTroubleBackingOff(t *testing.T) {
	spotlight := serve(t)
	spotlight.replays = []string{replayOf("finished", false)}
	spotlight.failing["GET /api/teams/team_1/replays/replay_1"] = []int{http.StatusBadGateway, http.StatusServiceUnavailable}
	c, slept := watcher(t)

	if err := c.watch([]string{"--team", "core", "--every", "2s", "replay_1"}); err != nil {
		t.Fatalf("watch: %v", err)
	}
	if len(*slept) != 2 || (*slept)[0] != 4*time.Second || (*slept)[1] != 8*time.Second {
		t.Fatalf("slept %v, want 4s then 8s", *slept)
	}
}

func TestWatchGivesUpOnARefusalAtOnceAndOnTroubleThatLasts(t *testing.T) {
	spotlight := serve(t)
	spotlight.replays = []string{replayOf("finished", false)}
	spotlight.failing["GET /api/teams/team_1/replays/replay_1"] = []int{http.StatusNotFound}
	c, slept := watcher(t)

	if err := c.watch([]string{"--team", "core", "replay_1"}); err == nil || len(*slept) != 0 {
		t.Fatalf("err = %v after %d sleeps, want an immediate refusal", err, len(*slept))
	}

	spotlight.failing["GET /api/teams/team_1/replays/replay_1"] = []int{500, 500, 500, 500, 500, 500}
	c, slept = watcher(t)
	err := c.watch([]string{"--team", "core", "replay_1"})
	if err == nil || !strings.Contains(err.Error(), "gave up after 5") || len(*slept) != 4 {
		t.Fatalf("err = %v after %d sleeps", err, len(*slept))
	}
	if (*slept)[3] != 2*time.Minute {
		t.Fatalf("slept %v, want the wait capped at 2m", *slept)
	}
}

func TestWatchAsksAtMostOnceASecond(t *testing.T) {
	serve(t)

	for _, every := range []string{"0s", "-1s", "500ms"} {
		if _, err := replaying("watch", "--team", "core", "--every", every, "replay_1"); err == nil || !strings.Contains(err.Error(), "at least 1s") {
			t.Fatalf("--every %s: err = %v", every, err)
		}
	}
}

func TestProposeTriesOnceMoreUnderTheSameKey(t *testing.T) {
	spotlight := serve(t)
	route := "POST /api/resources/lines/line_1/stations/build/replay-candidates"
	spotlight.failing[route] = []int{http.StatusBadGateway}

	if _, err := replaying("propose", "--station", "core/delivery/build", "--name", "Faster", writeBlock(t, "b.json", `{"key":"build"}`)); err != nil {
		t.Fatalf("propose: %v", err)
	}

	keys := []string{}
	for _, each := range spotlight.asked {
		if each.method+" "+strings.Split(each.path, "?")[0] == route {
			keys = append(keys, each.headers.Get(idempotencyHeader))
		}
	}
	if len(keys) != 2 || keys[0] == "" || keys[0] != keys[1] {
		t.Fatalf("sent keys %v, want one key twice", keys)
	}

	spotlight.failing[route] = []int{http.StatusBadGateway, http.StatusBadGateway}
	if _, err := replaying("propose", "--station", "core/delivery/build", "--name", "Faster", writeBlock(t, "b.json", `{"key":"build"}`)); err == nil {
		t.Fatalf("a create failing twice was taken")
	}
}

func TestEveryCommandNeedsTheAddressAndAToken(t *testing.T) {
	t.Setenv(urlVar, "")
	t.Setenv(tokenVar, "")

	if _, err := replaying("candidates", "--station", "core/delivery/build"); err == nil || !strings.Contains(err.Error(), tokenVar) {
		t.Fatalf("err = %v, want the variables named", err)
	}
}

func TestATokenSpotlightRefusesIsTold(t *testing.T) {
	serve(t)
	t.Setenv(tokenVar, "not-the-token")

	if _, err := replaying("candidates", "--station", "core/delivery/build"); err == nil || !strings.Contains(err.Error(), "No valid credentials") {
		t.Fatalf("err = %v", err)
	}
}
