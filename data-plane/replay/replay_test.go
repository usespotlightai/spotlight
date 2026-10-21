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

	"usespotlight.ai/data-plane/credentials"
)

const token = "q3Vd0n8yXbT2c4kPzR7mW1sLhA9eJ5gUfN6oYiC0xEw"

type receivedRequest struct {
	method  string
	path    string
	headers http.Header
	body    map[string]any
}

type spotlight struct {
	t        *testing.T
	mu       sync.Mutex
	received []receivedRequest
	replays  []string
	answers  map[string]string
	statuses map[string]int
	failing  map[string][]int
}

const candidates = `{"items":[
  {"id":"cand_1","version":0,"address":"core/delivery/build/Shorter prompt","stationId":"st_build","stationPath":"core/delivery/build","name":"Shorter prompt","station":{"key":"build"},"fingerprint":"` + fp + `","changedFrom":{"fingerprint":"` + liveFP + `","changes":[{"part":"prompt","name":null,"kind":"changed","was":null,"now":null},{"part":"model","name":null,"kind":"changed","was":"sonnet","now":"opus"},{"part":"skill","name":"tdd","kind":"added","was":null,"now":null}]},"createdAt":"2026-10-02T09:00:00.000Z"}
]}`

const (
	fp     = "5a7c9e1b3d5f7a9c1e3b5d7f9a1c3e5b7d9f1a3c5e7b9d1f3a5c7e9b1d3f5a7c"
	liveFP = "9f2c4e7a1b3d5f8a0c6e2b4d7f9a1c3e5b8d0f2a4c6e8b0d2f4a6c8e0b2d4f6a"
)

const sets = `[
  {"id":"set_1","lineId":"line_1","stationId":"st_build","name":"Queue fixes","createdAt":"2026-10-01T09:00:00.000Z","stationGone":false,"entries":[{"runId":"run_1","taskId":"task_1","unreplayableReason":null},{"runId":"run_2","taskId":"task_2","unreplayableReason":"archive-gone"}]},
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
  "totals":{"entries":2,"ended":2,"succeeded":1,"successRate":0.5,"scored":2,"unscored":0,"spent":{"amount":1.25,"currency":"USD"}},
  "referenceReplay":{"replayId":"replay_base","successRate":1,"interval":{"rate":1,"low":0.34,"high":1}},
  "baselineReplayId":"replay_base",
  "comparison":[
    {"taskId":"task_2","candidate":[{"result":"` + candidateResult + `"}],"baseline":[{"result":"` + baselineResult + `"}],"costDelta":0.1,"stepsDelta":3,"scoreDelta":null,"regressed":` + map[bool]string{true: "true", false: "false"}[regressed] + `},
    {"taskId":"task_1","candidate":[{"result":"succeeded"}],"baseline":[],"costDelta":null,"stepsDelta":null,"scoreDelta":null,"regressed":false}
  ]}`
}

const baseline = `{"id":"replay_base","setId":"set_1","state":"finished","isBaseline":true,
  "candidate":{"id":"cand_live","name":"Live config, 2026-10-01","kind":"live"},
  "ceiling":{"amount":5,"currency":"USD"},
  "totals":{"entries":2,"ended":2,"succeeded":2,"successRate":1,"interval":{"rate":1,"low":0.34,"high":1},"tasks":2,"tasksScored":2,"scored":2,"unscored":0,"spent":{"amount":1,"currency":"USD"}},
  "referenceReplay":null,"baselineReplayId":"replay_base","comparison":[]}`

func replayUnder(kind, referenceID string) string {
	reference := `"referenceReplay":null`
	if referenceID != "" {
		reference = `"referenceReplay":{"replayId":"` + referenceID + `","successRate":0.6,"interval":{"rate":0.6,"low":0.4,"high":0.8}}`
	}

	return strings.NewReplacer(
		`"kind":"proposed"`, `"kind":"`+kind+`"`,
		`"referenceReplay":{"replayId":"replay_base","successRate":1,"interval":{"rate":1,"low":0.34,"high":1}}`, reference,
	).Replace(replayOf("finished", false))
}

func referenceOf(id, state string) string {
	return strings.NewReplacer(
		`"id":"replay_base"`, `"id":"`+id+`"`,
		`"state":"finished"`, `"state":"`+state+`"`,
		`"isBaseline":true`, `"isBaseline":false`,
		`"succeeded":2,"successRate":1,"interval":{"rate":1,"low":0.34,"high":1}`, `"succeeded":1,"successRate":0.5,"interval":{"rate":0.5,"low":0.1,"high":0.9}`,
	).Replace(baseline)
}

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
	t.Setenv(credentials.DirVar, t.TempDir())

	return s
}

func (s *spotlight) handle(w http.ResponseWriter, r *http.Request) {
	s.mu.Lock()
	defer s.mu.Unlock()

	var body map[string]any
	if read, _ := io.ReadAll(r.Body); len(read) > 0 {
		_ = json.Unmarshal(read, &body)
	}
	s.received = append(s.received, receivedRequest{method: r.Method, path: r.URL.RequestURI(), headers: r.Header.Clone(), body: body})

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

	answer, found := s.answers[route]
	if !found {
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

func (s *spotlight) last(method, path string) receivedRequest {
	s.t.Helper()
	s.mu.Lock()
	defer s.mu.Unlock()

	for at := len(s.received) - 1; at >= 0; at-- {
		if s.received[at].method == method && strings.HasPrefix(s.received[at].path, path) {
			return s.received[at]
		}
	}

	s.t.Fatalf("Spotlight never received %s %s; it received %v", method, path, s.received)
	return receivedRequest{}
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

	output, err := replaying("propose", "--station", "core/delivery/build", "--name", "Faster", block)
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
		if !strings.Contains(output, want) {
			t.Fatalf("output %q, want %q in it", output, want)
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
		t.Fatalf("--json wrote %q", out.String())
	}
}

func TestProposeRejectsHCLAndWhatIsNoObject(t *testing.T) {
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
		t.Fatalf("err = %v, want HCL rejected", err)
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

	output, err := replaying("candidates", "--station", "core/delivery/build")
	if err != nil {
		t.Fatalf("candidates: %v", err)
	}

	spotlight.last(http.MethodGet, "/api/resources/workspaces/ws_1/replay-candidates?station=core%2Fdelivery%2Fbuild")
	for _, want := range []string{"NAME", "Shorter prompt", "cand_1"} {
		if !strings.Contains(output, want) {
			t.Fatalf("output %q, want %q", output, want)
		}
	}
}

func TestShowSaysWhatTheCandidateChanges(t *testing.T) {
	serve(t)

	output, err := replaying("show", "--station", "core/delivery/build", "Shorter prompt")
	if err != nil {
		t.Fatalf("show: %v", err)
	}

	for _, want := range []string{"prompt changed", "model sonnet → opus", "skill tdd added"} {
		if !strings.Contains(output, want) {
			t.Fatalf("output %q, want %q", output, want)
		}
	}

	if _, err := replaying("show", "--station", "core/delivery/build", "Missing"); err == nil || !strings.Contains(err.Error(), "it has Shorter prompt") {
		t.Fatalf("err = %v, want the candidates named", err)
	}
}

func TestSetsListsTheStationsSetsByLineAndKey(t *testing.T) {
	spotlight := serve(t)

	output, err := replaying("sets", "--station", "core/delivery/build")
	if err != nil {
		t.Fatalf("sets: %v", err)
	}

	spotlight.last(http.MethodGet, "/api/teams/team_1/replay-sets?line=line_1&station=build")
	if !strings.Contains(output, "Queue fixes") || !strings.Contains(output, "set_1") {
		t.Fatalf("output %q", output)
	}
}

func TestStartReplaysASetUnderACandidateNamedWithinACeiling(t *testing.T) {
	spotlight := serve(t)

	output, err := replaying("start", "--station", "core/delivery/build", "--set", "Queue fixes", "--candidate", "Shorter prompt", "--ceiling", "5")
	if err != nil {
		t.Fatalf("start: %v", err)
	}

	sent := spotlight.last(http.MethodPost, "/api/teams/team_1/replay-sets/set_1/replays")
	if sent.body["candidate"] != "cand_1" || sent.body["ceiling"].(map[string]any)["amount"] != 5.0 || sent.body["ceiling"].(map[string]any)["currency"] != "USD" || sent.body["repeats"] != 1.0 {
		t.Fatalf("sent %v", sent.body)
	}
	for _, want := range []string{"replay_1", "replay_base", "spotlight replay watch --team core replay_1"} {
		if !strings.Contains(output, want) {
			t.Fatalf("output %q, want %q", output, want)
		}
	}
}

func TestStartReplaysEachRunAsOftenAsRequested(t *testing.T) {
	spotlight := serve(t)

	output, err := replaying("start", "--station", "core/delivery/build", "--set", "Queue fixes", "--candidate", "live", "--ceiling", "5", "--repeats", "3")
	if err != nil {
		t.Fatalf("start: %v", err)
	}
	if sent := spotlight.last(http.MethodPost, "/api/teams/team_1/replay-sets/set_1/replays"); sent.body["repeats"] != 3.0 {
		t.Fatalf("sent %v", sent.body)
	}
	if !strings.Contains(output, "replays each run 3 times") {
		t.Fatalf("output %q", output)
	}
	if _, err := replaying("start", "--station", "core/delivery/build", "--set", "Queue fixes", "--candidate", "live", "--ceiling", "5", "--repeats", "6"); err == nil || !strings.Contains(err.Error(), "--repeats") {
		t.Fatalf("err = %v, want --repeats rejected", err)
	}
}

func TestStatusShowsEachRateWithItsIntervalAndSaysWhenTheGainIsWithinNoise(t *testing.T) {
	spotlight := serve(t)
	spotlight.replays = []string{strings.Replace(
		strings.Replace(replayOf("finished", false), `"totals":{"entries":2,`, `"repeats":2,"gainOverReference":{"gain":-0.5,"low":-1,"high":0,"significance":"within-noise","minGain":0.05,"tasks":2},"totals":{"interval":{"rate":0.5,"low":0,"high":1},"tasks":2,"tasksScored":2,"entries":2,`, 1),
		`"candidate":[{"result":"succeeded"}],"baseline":[]`, `"candidate":[{"result":"succeeded"},{"result":"failed"}],"baseline":[]`, 1,
	)}

	output, err := replaying("status", "--team", "core", "replay_1")
	if err != nil {
		t.Fatalf("status: %v", err)
	}
	for _, want := range []string{
		"It replays each run 2 times.",
		"Succeeded: 1 of 2 (50%); 50% (0–100%) over 2 of 2 tasks, 0 unscored",
		"Within noise of the baseline: -50 points (-100 to +0) over 2 tasks",
		"succeeded/failed",
	} {
		if !strings.Contains(output, want) {
			t.Fatalf("output %q, want %q", output, want)
		}
	}
}

func TestStartRejectsAnAmbiguousSetAndANothingCeiling(t *testing.T) {
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

	output, err := replaying("status", "--team", "core", "replay_1")
	if !errors.Is(err, errRegressed) || !strings.Contains(err.Error(), "the candidate regressed against its reference replay on 1 of 2 tasks") {
		t.Fatalf("err = %v, want a regression", err)
	}

	regressed := strings.Index(output, "REGRESSED")
	if regressed < 0 || regressed > strings.Index(output, "task_1") {
		t.Fatalf("output %q, want the regression first", output)
	}
	for _, want := range []string{"Succeeded: 1 of 2 (50%), 0 unscored", "Compared with the baseline, finished: 2 of 2 (100%); 100% (34–100%) over 2 of 2 tasks, 0 unscored\n\n", "CANDIDATE  COMPARED WITH  COST Δ", "1.25 USD of 5 USD"} {
		if !strings.Contains(output, want) {
			t.Fatalf("output %q, want %q", output, want)
		}
	}
	spotlight.last(http.MethodGet, "/api/resources/workspaces/ws_1/teams/import?address=core")
}

func TestStatusOwnsUpToSpendingPastTheCeiling(t *testing.T) {
	spotlight := serve(t)
	spotlight.replays = []string{strings.Replace(replayOf("ceiling-reached", false), `"spent":{"amount":1.25`, `"spent":{"amount":5.5`, 1)}

	output, err := replaying("status", "--team", "core", "replay_1")
	if err != nil {
		t.Fatalf("status: %v", err)
	}
	if !strings.Contains(output, "5.5 USD of 5 USD spent, over the ceiling by 0.5 USD") {
		t.Fatalf("output %q", output)
	}
}

func TestStatusOfACandidateThatDidNotRegressExitsCleanly(t *testing.T) {
	spotlight := serve(t)
	spotlight.replays = []string{replayOf("finished", false)}

	if _, err := replaying("status", "--team", "core", "replay_1"); err != nil {
		t.Fatalf("status: %v", err)
	}
}

func TestWatchReadsUntilTheReplayAndItsReferenceReplayHaveEnded(t *testing.T) {
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
	if json.Unmarshal(out.Bytes(), &answered) != nil || answered["replay"].(map[string]any)["state"] != "finished" || answered["referenceReplay"].(map[string]any)["id"] != "replay_base" {
		t.Fatalf("--json wrote %q", out.String())
	}
}

func TestStopStopsTheReplayAndAnswersAsSpotlightReadsItAfter(t *testing.T) {
	spotlight := serve(t)
	spotlight.replays = []string{replayOf("stopped", false)}

	output, err := replaying("stop", "--team", "core", "replay_1")
	if err != nil {
		t.Fatalf("stop: %v", err)
	}

	spotlight.last(http.MethodPost, "/api/teams/team_1/replays/replay_1/stop")
	if !strings.Contains(output, "Stopped replay replay_1, now stopped") {
		t.Fatalf("output %q", output)
	}

	out := new(bytes.Buffer)
	if err := runWith([]string{"stop", "--team", "core", "--json", "replay_1"}, strings.NewReader(""), out); err != nil {
		t.Fatalf("stop --json: %v", err)
	}
	var answered map[string]any
	if json.Unmarshal(out.Bytes(), &answered) != nil || answered["state"] != "stopped" || answered["setId"] != "set_1" {
		t.Fatalf("--json wrote %q", out.String())
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

func TestWatchGivesUpOnAClientErrorAtOnceAndOnTroubleThatLasts(t *testing.T) {
	spotlight := serve(t)
	spotlight.replays = []string{replayOf("finished", false)}
	spotlight.failing["GET /api/teams/team_1/replays/replay_1"] = []int{http.StatusNotFound}
	c, slept := watcher(t)

	if err := c.watch([]string{"--team", "core", "replay_1"}); err == nil || len(*slept) != 0 {
		t.Fatalf("err = %v after %d sleeps, want an immediate error", err, len(*slept))
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

func TestWatchReadsAtMostOnceASecond(t *testing.T) {
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
	for _, each := range spotlight.received {
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
	t.Setenv(credentials.DirVar, t.TempDir())

	if _, err := replaying("candidates", "--station", "core/delivery/build"); err == nil || !strings.Contains(err.Error(), urlVar) {
		t.Fatalf("err = %v, want the address named", err)
	}

	serve(t)
	t.Setenv(tokenVar, "")

	if _, err := replaying("candidates", "--station", "core/delivery/build"); err == nil || !strings.Contains(err.Error(), tokenVar) || !strings.Contains(err.Error(), "spotlight login") {
		t.Fatalf("err = %v, want the token and spotlight login named", err)
	}
}

func TestEveryCommandFallsBackToTheLoginForTheAddress(t *testing.T) {
	spotlight := serve(t)
	t.Setenv(tokenVar, "")
	loggedIn(t, os.Getenv(urlVar), token)

	if _, err := replaying("candidates", "--station", "core/delivery/build"); err != nil {
		t.Fatalf("candidates with the login: %v", err)
	}
	if got := spotlight.last(http.MethodGet, "/api/resources/workspaces/ws_1/replay-candidates").headers.Get("Authorization"); got != "Bearer "+token {
		t.Fatalf("Authorization = %q, want the login's token", got)
	}

	t.Setenv(tokenVar, "not-the-token")
	if _, err := replaying("candidates", "--station", "core/delivery/build"); err == nil || !strings.Contains(err.Error(), "No valid credentials") {
		t.Fatalf("err = %v, want SPOTLIGHT_API_TOKEN to win over the login", err)
	}
}

func TestALoginInSeveralWorkspacesNeedsTheWorkspaceChosen(t *testing.T) {
	spotlight := serve(t)
	spotlight.answers["GET /api/resources/workspaces"] = `{"items":[{"id":"ws_2","slug":"other"},{"id":"ws_1","slug":"acme"}]}`
	t.Setenv(workspaceVar, "")

	if _, err := replaying("candidates", "--station", "core/delivery/build"); err == nil || !strings.Contains(err.Error(), "you belong to 2 workspaces: other, acme") || !strings.Contains(err.Error(), workspaceVar) {
		t.Fatalf("err = %v, want the workspaces listed and the choice named", err)
	}

	if _, err := replaying("candidates", "--workspace", "acme", "--station", "core/delivery/build"); err != nil {
		t.Fatalf("candidates with --workspace: %v", err)
	}
	spotlight.last(http.MethodGet, "/api/resources/workspaces/ws_1/replay-candidates")

	t.Setenv(workspaceVar, "acme")
	if _, err := replaying("sets", "--station", "core/delivery/build"); err != nil {
		t.Fatalf("sets with %s: %v", workspaceVar, err)
	}

	if _, err := replaying("candidates", "--workspace", "nowhere", "--station", "core/delivery/build"); err == nil || !strings.Contains(err.Error(), "not a member of workspace nowhere") {
		t.Fatalf("err = %v, want the unknown workspace named", err)
	}
}

func loggedIn(t *testing.T, address, token string) {
	t.Helper()

	path, err := credentials.Path(os.Getenv)
	if err != nil {
		t.Fatal(err)
	}
	key, err := credentials.Address(address)
	if err != nil {
		t.Fatal(err)
	}

	file, err := credentials.Load(path)
	if err != nil {
		t.Fatal(err)
	}
	if err := file.Put(key, credentials.Login{Token: token, User: "person@example.com"}); err != nil {
		t.Fatal(err)
	}
	if err := file.Save(); err != nil {
		t.Fatal(err)
	}
}

func TestATokenSpotlightDoesNotAcceptIsReported(t *testing.T) {
	serve(t)
	t.Setenv(tokenVar, "not-the-token")

	if _, err := replaying("candidates", "--station", "core/delivery/build"); err == nil || !strings.Contains(err.Error(), "No valid credentials") {
		t.Fatalf("err = %v", err)
	}
}

func TestStatusNamesTheReferenceReplayAndFollowsIt(t *testing.T) {
	for _, each := range []struct {
		name, kind, reference string
		noBaseline            bool
		want                  string
	}{
		{"paired", "proposed", "replay_earlier", false, "an earlier baseline"},
		{"paired with the current baseline", "proposed", "replay_base", false, "the baseline"},
		{"with the answer", "oracle", "replay_live", false, "the live config"},
		{"with the answer against the current baseline", "oracle", "replay_base", false, "the baseline"},
		{"searched", "searched", "replay_seed", false, "the search's starting config"},
		{"searched in a set with no baseline", "searched", "replay_seed", true, "the search's starting config"},
	} {
		t.Run(each.name, func(t *testing.T) {
			spotlight := serve(t)
			replay := strings.Replace(replayUnder(each.kind, each.reference), `"totals":{`, `"gainOverReference":{"gain":0.2,"low":0.1,"high":0.3,"significance":"better","minGain":0.05,"tasks":2},"totals":{`, 1)
			if each.noBaseline {
				replay = strings.Replace(replay, `"baselineReplayId":"replay_base"`, `"baselineReplayId":null`, 1)
			}
			spotlight.replays = []string{replay}
			spotlight.answers["GET /api/teams/team_1/replays/"+each.reference] = referenceOf(each.reference, "finished")

			output, err := replaying("status", "--team", "core", "replay_1")
			if err != nil {
				t.Fatalf("status: %v", err)
			}
			for _, want := range []string{
				"Compared with " + each.want + ", finished: 1 of 2 (50%); 50% (10–90%) over 2 of 2 tasks, 0 unscored\nOn the tasks both scored: 60% (40–80%)\n",
				"Better than " + each.want + ": +20 points (+10 to +30) over 2 tasks",
			} {
				if !strings.Contains(output, want) {
					t.Fatalf("output %q, want %q", output, want)
				}
			}
			spotlight.last(http.MethodGet, "/api/teams/team_1/replays/"+each.reference)
			for _, received := range spotlight.received {
				if each.reference != "replay_base" && received.path == "/api/teams/team_1/replays/replay_base" {
					t.Fatalf("requested the baseline, not the replay it is compared with")
				}
			}
		})
	}
}

func TestWatchWaitsForTheReferenceReplay(t *testing.T) {
	for _, each := range []struct {
		kind, reference, want string
	}{
		{"oracle", "replay_live", "the live config"},
		{"searched", "replay_seed", "the search's starting config"},
		{"proposed", "replay_earlier", "an earlier baseline"},
	} {
		t.Run(each.kind, func(t *testing.T) {
			spotlight := serve(t)
			spotlight.replays = []string{replayUnder(each.kind, each.reference)}
			route := "GET /api/teams/team_1/replays/" + each.reference
			spotlight.answers[route] = referenceOf(each.reference, "running")
			out := new(bytes.Buffer)
			slept := 0
			c := &cli{api: newAPI(os.Getenv(urlVar), token, "test"), out: out, in: strings.NewReader(""), sleep: func(time.Duration) {
				slept++
				spotlight.mu.Lock()
				spotlight.answers[route] = referenceOf(each.reference, "finished")
				spotlight.mu.Unlock()
			}}

			if err := c.watch([]string{"--team", "core", "replay_1"}); err != nil {
				t.Fatalf("watch: %v", err)
			}
			if slept != 1 || !strings.Contains(out.String(), "Compared with "+each.want+", finished:") {
				t.Fatalf("slept %d times and wrote %q", slept, out.String())
			}
		})
	}
}

func TestStatusOfTheBaselineComparesItWithNothing(t *testing.T) {
	spotlight := serve(t)
	spotlight.replays = []string{strings.Replace(baseline, `"id":"replay_base"`, `"id":"replay_1"`, 1)}

	output, err := replaying("status", "--team", "core", "replay_1")
	if err != nil {
		t.Fatalf("status: %v", err)
	}
	if !strings.Contains(output, "It is the set's baseline.\n") || strings.Contains(output, "Compared with") {
		t.Fatalf("output %q", output)
	}
	for _, received := range spotlight.received {
		if received.path == "/api/teams/team_1/replays/replay_base" {
			t.Fatalf("requested another replay")
		}
	}
}

func TestStatusSaysWhyNothingIsCompared(t *testing.T) {
	for _, each := range []struct {
		name, replay, want string
	}{
		{"no baseline", strings.Replace(replayUnder("proposed", ""), `"baselineReplayId":"replay_base"`, `"baselineReplayId":null`, 1), "It is compared with nothing: the set has no baseline.\n"},
		{"live replay gone", replayUnder("oracle", ""), "It is compared with nothing: the live replay it was compared with is gone.\n"},
		{"paired replay gone", replayUnder("proposed", ""), "It is compared with nothing: the replay it was set beside is gone.\n"},
	} {
		t.Run(each.name, func(t *testing.T) {
			spotlight := serve(t)
			spotlight.replays = []string{each.replay}

			output, err := replaying("status", "--team", "core", "replay_1")
			if err != nil {
				t.Fatalf("status: %v", err)
			}
			if !strings.Contains(output, each.want) {
				t.Fatalf("output %q, want %q", output, each.want)
			}
		})
	}
}

func TestStatusAnswersInJSONWithTheReferenceReplay(t *testing.T) {
	spotlight := serve(t)
	spotlight.replays = []string{replayUnder("searched", "replay_seed")}
	spotlight.answers["GET /api/teams/team_1/replays/replay_seed"] = referenceOf("replay_seed", "finished")

	output, err := replaying("status", "--team", "core", "--json", "replay_1")
	if err != nil {
		t.Fatalf("status: %v", err)
	}

	var answered struct {
		Replay struct {
			Reference struct {
				ReplayID string `json:"replayId"`
			} `json:"referenceReplay"`
		} `json:"replay"`
		Reference struct {
			ID string `json:"id"`
		} `json:"referenceReplay"`
		Baseline any `json:"baseline"`
	}
	if json.Unmarshal([]byte(output), &answered) != nil || answered.Replay.Reference.ReplayID != "replay_seed" || answered.Reference.ID != "replay_seed" || answered.Baseline != nil {
		t.Fatalf("--json wrote %q", output)
	}

	spotlight.replays = []string{replayUnder("oracle", "")}
	output, err = replaying("status", "--team", "core", "--json", "replay_1")
	var bare map[string]any
	if err != nil || json.Unmarshal([]byte(output), &bare) != nil || bare["referenceReplay"] != nil {
		t.Fatalf("err = %v, --json wrote %q", err, output)
	}
}
