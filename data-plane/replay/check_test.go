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
	"strings"
	"sync"
	"testing"
	"time"
)

const (
	deliveryLine = "3f7a2c9e-5d18-4b6a-8e2f-1c9d7b4a6e03"
	coreTeam     = "9c2e6d5a-1f47-4c8b-9a3d-2b7e5f0c1d84"
)

func planFixture(t *testing.T) []byte {
	t.Helper()

	read, err := os.ReadFile(filepath.Join("testdata", "plan.json"))
	if err != nil {
		t.Fatal(err)
	}

	return read
}

func parsedFixture(t *testing.T, plan []byte) planned {
	t.Helper()

	read, err := readPlan(bytes.NewReader(plan))
	if err != nil {
		t.Fatal(err)
	}

	return read
}

func TestReadPlanChecksOnlyTheLiveStationsAnUpdateChanges(t *testing.T) {
	plan := parsedFixture(t, planFixture(t))

	if len(plan.Stations) != 3 {
		t.Fatalf("stations = %+v, want build, polish and review", plan.Stations)
	}

	build, polish, review := plan.Stations[0], plan.Stations[1], plan.Stations[2]
	if polish.Key != "polish" || !polish.Undecided || !strings.Contains(polish.Because, "removes ship and adds this station") {
		t.Fatalf("polish = %+v, want undecided as a station perhaps renamed", polish)
	}
	if build.Key != "build" || build.LineID != deliveryLine || build.TeamID != coreTeam || build.Address != "core/delivery/build" || build.Undecided {
		t.Fatalf("build = %+v", build)
	}
	if review.Key != "review" || !review.Undecided || !strings.Contains(review.Because, "knows its prompt only after apply") {
		t.Fatalf("review = %+v, want undecided on its prompt", review)
	}

	notes := strings.Join(plan.Notes, "\n")
	for _, want := range []string{
		"spotlight_line.delivery removes station ship",
		"spotlight_line.delivery adds station polish",
		"spotlight_line.fresh is a new line",
		"spotlight_line.renamed is replaced",
	} {
		if !strings.Contains(notes, want) {
			t.Errorf("notes lack %q:\n%s", want, notes)
		}
	}
}

func TestReadPlanSendsTheStationAsTheProviderWouldApplyIt(t *testing.T) {
	build := parsedFixture(t, planFixture(t)).Stations[0]

	written, _ := json.Marshal(build.Block)
	var block map[string]any
	_ = json.Unmarshal(written, &block)

	want := map[string]any{
		"key":      "build",
		"name":     "Build",
		"kind":     "work",
		"harness":  "claude-code",
		"model":    "claude-opus-4-5",
		"prompt":   "Build it, then drain the queue.",
		"check":    "npm run lint",
		"tools":    []any{},
		"skills":   []any{},
		"runners":  []any{},
		"passesTo": []any{"review"},
		"ends":     false,
		"judge":    map[string]any{"rubric": "scores: yes-no\nDid it drain the queue?", "sample": 0.5, "trust": 0.6},
		"alerts":   []any{map[string]any{"measure": "sent_back_rate", "risesBy": 0.2, "over": float64(20)}},
	}

	got, _ := json.Marshal(block)
	expected, _ := json.Marshal(want)
	if !bytes.Equal(got, expected) {
		t.Fatalf("block =\n%s\nwant\n%s", got, expected)
	}
}

func TestReadPlanRefusesTheStreamingLog(t *testing.T) {
	stream, err := os.ReadFile(filepath.Join("testdata", "stream.json"))
	if err != nil {
		t.Fatal(err)
	}

	_, err = readPlan(bytes.NewReader(stream))
	if !errors.Is(err, errStreamingLog) || !strings.Contains(err.Error(), "terraform show -json <planfile>") {
		t.Fatalf("err = %v, want the command to run instead", err)
	}

	if _, err := readPlan(strings.NewReader(`{"resources": []}`)); err == nil || !strings.Contains(err.Error(), "terraform show -json") {
		t.Fatalf("err = %v, want a refusal naming terraform show", err)
	}
}

func TestReadPlanIgnoresAThresholdChangedInThePlan(t *testing.T) {
	var shown map[string]any
	_ = json.Unmarshal(planFixture(t), &shown)

	for _, each := range shown["resource_changes"].([]any) {
		change := each.(map[string]any)["change"].(map[string]any)
		if before, ok := change["before"].(map[string]any); ok && before["key"] == "delivery" {
			before["replay_check"] = map[string]any{"max_regressions": 0, "ceiling": 10, "currency": "USD"}
			change["after"].(map[string]any)["replay_check"] = map[string]any{"max_regressions": 5, "ceiling": 900, "currency": "USD"}
		}
	}

	written, _ := json.Marshal(shown)
	for _, each := range parsedFixture(t, written).Stations {
		for key := range each.Block {
			if strings.Contains(strings.ToLower(key), "replay") || key == "maxRegressions" {
				t.Fatalf("station %s sends %s", each.Key, key)
			}
		}
	}
}

type checkServer struct {
	t         *testing.T
	mu        sync.Mutex
	posted    []map[string]any
	keys      []string
	tokens    []string
	verdict   []string
	post      func(w http.ResponseWriter) bool
	reads     int
	exchanges int
}

func (s *checkServer) serve() *httptest.Server {
	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		s.mu.Lock()
		defer s.mu.Unlock()

		s.tokens = append(s.tokens, r.Header.Get("Authorization"))
		w.Header().Set("Content-Type", "application/json")

		switch {
		case r.Method == http.MethodPost && r.URL.Path == exchangePath:
			var asked map[string]string
			_ = json.NewDecoder(r.Body).Decode(&asked)
			if asked["trust"] != "trust_1" || asked["token"] != "oidc-token" {
				w.WriteHeader(http.StatusUnauthorized)
				_, _ = io.WriteString(w, `{"statusCode":401,"message":"No such trust, or a workload it does not admit"}`)
				return
			}
			s.exchanges++
			_, _ = io.WriteString(w, `{"token":"minted","expiresAt":"2026-10-02T10:00:00Z"}`)
		case r.Method == http.MethodPost && r.URL.Path == "/api/teams/"+coreTeam+"/replay-checks":
			var body map[string]any
			_ = json.NewDecoder(r.Body).Decode(&body)
			s.posted = append(s.posted, body)
			s.keys = append(s.keys, r.Header.Get(idempotencyHeader))
			if s.post != nil && s.post(w) {
				return
			}
			w.WriteHeader(http.StatusCreated)
			_, _ = io.WriteString(w, checkAnswer("running"))
		case r.Method == http.MethodGet && r.URL.Path == "/api/teams/"+coreTeam+"/replay-checks/check_1":
			verdict := "running"
			if s.reads < len(s.verdict) {
				verdict = s.verdict[s.reads]
			}
			s.reads++
			_, _ = io.WriteString(w, checkAnswer(verdict))
		default:
			s.t.Errorf("unexpected %s %s", r.Method, r.URL.Path)
			w.WriteHeader(http.StatusNotFound)
		}
	}))
}

func checkAnswer(verdict string) string {
	regressions := `[]`
	if verdict == "failed" {
		regressions = `[{"taskId":"task_2","title":"Drain the queue","candidate":["failed"],"baseline":["succeeded"],"scoreDelta":null,"reasons":[{"code":"check-failed","detail":"npm test"}]}]`
	}
	undecided := `null`
	if verdict == "undecided" {
		undecided = `"too-few-scored"`
	}

	return `{"id":"check_1","setName":"Queue fixes","replayId":"replay_1","keptLive":["check","judge"],
  "verdict":"` + verdict + `","undecidedBecause":` + undecided + `,"tasks":3,"compared":3,
  "threshold":{"maxRegressions":0,"minGain":0.05,"ceiling":{"amount":10,"currency":"USD"}},
  "repeats":3,"gain":{"gain":-0.3333,"low":-1,"high":0,"verdict":"within-noise","minGain":0.05,"tasks":3},
  "candidate":{"state":"finished","entries":9,"scored":9,"succeeded":6,"successRate":0.6667,"interval":{"rate":0.6667,"low":0.3333,"high":1},"tasksScored":3,"spent":{"amount":1.5,"currency":"USD"}},
  "baseline":{"state":"finished","entries":3,"scored":3,"succeeded":3,"successRate":1,"interval":{"rate":1,"low":1,"high":1},"tasksScored":3,"spent":{"amount":1.2,"currency":"USD"}},
  "regressions":` + regressions + `,"replayUrl":"https://app.example.test/w/acme/team/` + coreTeam + `/lines/` + deliveryLine + `/stations/st_build/replays/replay_1"}`
}

type ran struct {
	code   int
	out    string
	errOut string
}

type fakeClock struct{ at time.Time }

func (f *fakeClock) now() time.Time           { return f.at }
func (f *fakeClock) sleep(wait time.Duration) { f.at = f.at.Add(wait) }

func runCheck(t *testing.T, env map[string]string, plan []byte, args ...string) ran {
	t.Helper()

	var out, errOut bytes.Buffer
	clock := &fakeClock{at: time.Date(2026, 10, 2, 9, 0, 0, 0, time.UTC)}
	code := check(append(args, "-"), bytes.NewReader(plan), &out, &errOut, func(name string) string { return env[name] }, "1.2.3", clock.sleep, clock.now)

	return ran{code: code, out: out.String(), errOut: errOut.String()}
}

func TestCheckPassesOnceTheCheckPassesAndSendsNoThreshold(t *testing.T) {
	s := &checkServer{t: t, verdict: []string{"running", "passed"}}
	server := s.serve()
	defer server.Close()

	summary := filepath.Join(t.TempDir(), "summary.md")
	got := runCheck(t, map[string]string{urlVar: server.URL, tokenVar: token, "GITHUB_STEP_SUMMARY": summary}, planFixture(t), "--commit", "4F7C2A9E", "--pull-request", "42")

	if got.code != undecidedExit {
		t.Fatalf("code = %d (review is undecided), out:\n%s%s", got.code, got.out, got.errOut)
	}
	if len(s.posted) != 1 {
		t.Fatalf("posted %d checks, want only build's", len(s.posted))
	}

	body := s.posted[0]
	if body["lineId"] != deliveryLine || body["stationKey"] != "build" {
		t.Fatalf("body = %v", body)
	}
	if reference := body["reference"].(map[string]any); reference["commit"] != "4F7C2A9E" || reference["pullRequest"] != float64(42) {
		t.Fatalf("reference = %v", reference)
	}
	if len(body) != 5 || body["repeats"] != float64(1) {
		t.Fatalf("body carries more than the station, its reference and its repeats: %v", body)
	}
	if !strings.HasPrefix(s.keys[0], "replay-check-") || s.tokens[0] != "Bearer "+token {
		t.Fatalf("key %q, token %q", s.keys[0], s.tokens[0])
	}

	for _, want := range []string{
		"core/delivery/build: PASSED",
		"0 of 3 tasks regressed (at most 0 may)",
		`set "Queue fixes"`,
		"scored with the live check, judge",
		"https://app.example.test/w/acme/team/",
		"core/delivery/review: UNDECIDED",
		"not checked, since Terraform knows its prompt only after apply",
		"note: spotlight_line.fresh is a new line",
	} {
		if !strings.Contains(got.out, want) {
			t.Errorf("output lacks %q:\n%s", want, got.out)
		}
	}

	written, _ := os.ReadFile(summary)
	if !strings.Contains(string(written), "| core/delivery/build | passed |") {
		t.Fatalf("summary:\n%s", written)
	}
}

func TestCheckReplaysEachRunAsOftenAsAskedAndSaysWhenTheGainIsWithinNoise(t *testing.T) {
	s := &checkServer{t: t, verdict: []string{"passed"}}
	server := s.serve()
	defer server.Close()

	summary := filepath.Join(t.TempDir(), "summary.md")
	env := map[string]string{urlVar: server.URL, tokenVar: token, "GITHUB_STEP_SUMMARY": summary}
	got := runCheck(t, env, withoutUnknowns(t, planFixture(t)), "--repeats", "3")
	runCheck(t, env, withoutUnknowns(t, planFixture(t)))

	if got.code != 0 {
		t.Fatalf("code = %d, out:\n%s%s", got.code, got.out, got.errOut)
	}
	if s.posted[0]["repeats"] != float64(3) || s.keys[0] == s.keys[1] {
		t.Fatalf("posted %v with keys %v, want 3 repeats under a key of their own", s.posted[0], s.keys)
	}
	for _, want := range []string{
		"each run replayed 3 times",
		"candidate 6 of 9 succeeded, 67% (33–100%) over 3 tasks, baseline 3 of 3 succeeded, 100% (100–100%) over 3 tasks",
		"Within noise of the baseline: -33 points (-100 to +0) over 3 tasks, not clearly past the 5-point gain that counts as real",
	} {
		if !strings.Contains(got.out, want) {
			t.Errorf("output lacks %q:\n%s", want, got.out)
		}
	}

	written, _ := os.ReadFile(summary)
	if !strings.Contains(string(written), "| Gain |") || !strings.Contains(string(written), "-33 points (-100 to +0), within noise") {
		t.Fatalf("summary:\n%s", written)
	}

	if bad := runCheck(t, env, planFixture(t), "--repeats", "6"); bad.code != refusedExit || !strings.Contains(bad.errOut, "--repeats") {
		t.Fatalf("--repeats 6 answered %d: %s", bad.code, bad.errOut)
	}
}

func TestCheckReusesTheSameKeyForTheSameChange(t *testing.T) {
	s := &checkServer{t: t, verdict: []string{"passed", "passed"}}
	server := s.serve()
	defer server.Close()

	env := map[string]string{urlVar: server.URL, tokenVar: token}
	runCheck(t, env, planFixture(t), "--commit", "abc1234")
	runCheck(t, env, planFixture(t), "--commit", "abc1234")
	runCheck(t, env, planFixture(t), "--commit", "def5678")

	if len(s.keys) != 3 || s.keys[0] != s.keys[1] || s.keys[0] == s.keys[2] {
		t.Fatalf("keys = %v, want one per change and commit", s.keys)
	}
}

func TestCheckExitsByTheWorstVerdict(t *testing.T) {
	onlyBuild := withoutUnknowns(t, planFixture(t))

	for name, tc := range map[string]struct {
		verdicts []string
		post     func(w http.ResponseWriter) bool
		want     int
		says     string
	}{
		"passed":    {verdicts: []string{"passed"}, want: 0, says: "PASSED"},
		"failed":    {verdicts: []string{"failed"}, want: regressedExit, says: `REGRESSED task_2 "Drain the queue": failed where the baseline succeeded, check-failed: npm test`},
		"undecided": {verdicts: []string{"undecided"}, want: undecidedExit, says: "fewer than half the tasks were scored on both sides"},
		"timed out": {verdicts: nil, want: undecidedExit, says: "still running after 1m0s"},
		"refused": {
			post: func(w http.ResponseWriter) bool {
				w.WriteHeader(http.StatusConflict)
				_, _ = io.WriteString(w, `{"type":"urn:spotlight:problem:conflict","status":409,"title":"conflict","detail":"No replay set guards the changes of the station build"}`)
				return true
			},
			want: refusedExit, says: "No replay set guards the changes of the station build",
		},
		"invalid": {
			post: func(w http.ResponseWriter) bool {
				w.WriteHeader(http.StatusUnprocessableEntity)
				_, _ = io.WriteString(w, `{"type":"urn:spotlight:problem:invalid","status":422,"title":"The replay check is not valid","errors":[{"path":"station.effort","message":"is low, medium, high, xhigh or max","severity":"error"}]}`)
				return true
			},
			want: refusedExit, says: "station.effort: is low, medium, high, xhigh or max",
		},
		"nothing to replay": {
			post: func(w http.ResponseWriter) bool {
				w.WriteHeader(http.StatusConflict)
				_, _ = io.WriteString(w, `{"type":"urn:spotlight:problem:nothing-to-replay","status":409,"detail":"The plan changes only check of the station"}`)
				return true
			},
			want: 0, says: "UNCHANGED",
		},
	} {
		t.Run(name, func(t *testing.T) {
			s := &checkServer{t: t, verdict: tc.verdicts, post: tc.post}
			server := s.serve()
			defer server.Close()

			got := runCheck(t, map[string]string{urlVar: server.URL, tokenVar: token}, onlyBuild, "--timeout", "1m")
			if got.code != tc.want || !strings.Contains(got.out, tc.says) {
				t.Fatalf("code = %d, want %d; output:\n%s%s", got.code, tc.want, got.out, got.errOut)
			}
		})
	}
}

func TestCheckAnswersInJSON(t *testing.T) {
	s := &checkServer{t: t, verdict: []string{"failed"}}
	server := s.serve()
	defer server.Close()

	got := runCheck(t, map[string]string{urlVar: server.URL, tokenVar: token}, withoutUnknowns(t, planFixture(t)), "--json")

	var report struct {
		Stations []struct {
			Station string `json:"station"`
			Status  string `json:"status"`
			URL     string `json:"url"`
			Check   struct {
				Regressions []struct {
					TaskID string `json:"taskId"`
				} `json:"regressions"`
			} `json:"check"`
		} `json:"stations"`
		Notes    []string `json:"notes"`
		ExitCode int      `json:"exitCode"`
	}
	if err := json.Unmarshal([]byte(got.out), &report); err != nil {
		t.Fatalf("not JSON: %v\n%s", err, got.out)
	}
	if got.code != regressedExit || report.ExitCode != regressedExit || len(report.Stations) != 1 || report.Stations[0].Status != "failed" || report.Stations[0].Check.Regressions[0].TaskID != "task_2" || len(report.Notes) == 0 {
		t.Fatalf("report = %+v", report)
	}
}

func TestCheckExchangesTheJobsOIDCTokenThroughATrust(t *testing.T) {
	s := &checkServer{t: t, verdict: []string{"passed"}}
	server := s.serve()
	defer server.Close()

	got := runCheck(t, map[string]string{urlVar: server.URL, trustVar: "trust_1", oidcTokenVar: "oidc-token"}, withoutUnknowns(t, planFixture(t)))
	if got.code != 0 {
		t.Fatalf("code = %d\n%s%s", got.code, got.out, got.errOut)
	}
	if s.tokens[1] != "Bearer minted" {
		t.Fatalf("tokens = %v", s.tokens)
	}

	refused := runCheck(t, map[string]string{urlVar: server.URL, trustVar: "trust_1", oidcTokenVar: "forged"}, withoutUnknowns(t, planFixture(t)))
	if refused.code != refusedExit || !strings.Contains(refused.out, "did not admit the OIDC token: No such trust, or a workload it does not admit") || strings.Contains(refused.out, "statusCode") {
		t.Fatalf("code = %d\n%s%s", refused.code, refused.out, refused.errOut)
	}
}

func TestCheckNeedsNoSpotlightWhenNothingIsChecked(t *testing.T) {
	got := runCheck(t, map[string]string{}, []byte(`{"format_version":"1.2","resource_changes":[]}`))

	if got.code != 0 || !strings.Contains(got.out, "nothing to check") {
		t.Fatalf("code = %d\n%s%s", got.code, got.out, got.errOut)
	}
}

func TestCheckRefusesWithoutCredentials(t *testing.T) {
	got := runCheck(t, map[string]string{urlVar: "http://127.0.0.1:9"}, withoutUnknowns(t, planFixture(t)))

	if got.code != refusedExit || !strings.Contains(got.errOut, tokenVar) || !strings.Contains(got.errOut, trustVar) {
		t.Fatalf("code = %d\n%s", got.code, got.errOut)
	}
}

func withoutUnknowns(t *testing.T, plan []byte) []byte {
	t.Helper()

	var shown map[string]any
	_ = json.Unmarshal(plan, &shown)

	kept := []any{}
	for _, each := range shown["resource_changes"].([]any) {
		change := each.(map[string]any)
		if change["address"] != "spotlight_line.delivery" {
			kept = append(kept, change)
			continue
		}

		inner := change["change"].(map[string]any)
		after := inner["after"].(map[string]any)
		unknowns := inner["after_unknown"].(map[string]any)
		stations, unknownStations := []any{}, []any{}
		for at, station := range after["station"].([]any) {
			values := station.(map[string]any)
			if values["key"] == "polish" {
				continue
			}
			if values["key"] == "review" {
				values["prompt"] = "Review."
				values["passes_to"] = []any{"completed"}
			}
			unknown := unknowns["station"].([]any)[at].(map[string]any)
			delete(unknown, "prompt")
			stations = append(stations, values)
			unknownStations = append(unknownStations, unknown)
		}
		after["station"] = stations
		unknowns["station"] = unknownStations
		kept = append(kept, change)
	}
	shown["resource_changes"] = kept

	written, _ := json.Marshal(shown)
	return written
}

func mutated(t *testing.T, plan []byte, change func(changes []any) []any) []byte {
	t.Helper()

	var shown map[string]any
	_ = json.Unmarshal(plan, &shown)
	shown["resource_changes"] = change(shown["resource_changes"].([]any))

	written, _ := json.Marshal(shown)
	return written
}

func lineChange(changes []any, address string) map[string]any {
	for _, each := range changes {
		if change := each.(map[string]any); change["address"] == address {
			return change["change"].(map[string]any)
		}
	}

	return nil
}

func stationIn(side map[string]any, key string) map[string]any {
	for _, each := range side["station"].([]any) {
		if station := each.(map[string]any); station["key"] == key {
			return station
		}
	}

	return nil
}

func TestReadPlanChecksEveryWorkStationWhenTheLinesRepositoriesChange(t *testing.T) {
	plan := mutated(t, withoutUnknowns(t, planFixture(t)), func(changes []any) []any {
		after := lineChange(changes, "spotlight_line.delivery")["after"].(map[string]any)
		after["repository"] = []any{map[string]any{"name": "acme/api", "image": "ghcr.io/acme/api:next", "setup": nil}}
		return changes
	})

	stations := parsedFixture(t, plan).Stations
	keys := []string{}
	for _, each := range stations {
		keys = append(keys, each.Key)
		want := map[string]any{"repositories": []any{map[string]any{"name": "acme/api", "image": "ghcr.io/acme/api:next"}}}
		if !sameValue(each.Line, want) || each.Undecided {
			t.Fatalf("%s line = %v", each.Key, each.Line)
		}
	}
	if strings.Join(keys, ",") != "build,review" {
		t.Fatalf("checked %v, want every live work station", keys)
	}
}

func TestReadPlanLeavesUndecidedAStationWhoseSkillOrProfileThePlanChanges(t *testing.T) {
	plan := mutated(t, withoutUnknowns(t, planFixture(t)), func(changes []any) []any {
		delivery := lineChange(changes, "spotlight_line.delivery")
		for _, side := range []string{"before", "after"} {
			stationIn(delivery[side].(map[string]any), "review")["skills"] = []any{"tdd"}
		}
		return append(changes,
			map[string]any{
				"address": "spotlight_skill.core_tdd", "mode": "managed", "type": "spotlight_skill",
				"provider_name": "registry.terraform.io/usespotlightai/spotlight",
				"change": map[string]any{
					"actions": []any{"update"},
					"before":  map[string]any{"team_id": coreTeam, "key": "tdd"},
					"after":   map[string]any{"team_id": coreTeam, "key": "tdd"},
				},
			},
			map[string]any{
				"address": "spotlight_harness_profile.other_careful", "mode": "managed", "type": "spotlight_harness_profile",
				"provider_name": "registry.terraform.io/usespotlightai/spotlight",
				"change": map[string]any{
					"actions": []any{"update"},
					"before":  map[string]any{"team_id": "another-team", "key": "careful"},
					"after":   map[string]any{"team_id": "another-team", "key": "careful"},
				},
			},
		)
	})

	stations := parsedFixture(t, plan).Stations
	if len(stations) != 2 || stations[0].Undecided || !stations[1].Undecided || !strings.Contains(stations[1].Because, "skill spotlight_skill.core_tdd") {
		t.Fatalf("stations = %+v", stations)
	}

	s := &checkServer{t: t, verdict: []string{"passed"}}
	server := s.serve()
	defer server.Close()
	if got := runCheck(t, map[string]string{urlVar: server.URL, tokenVar: token}, plan); got.code != undecidedExit {
		t.Fatalf("code = %d\n%s", got.code, got.out)
	}
}

func TestReadPlanNotesRemovedLinesIgnoresOtherProvidersAndStationsWhereNothingRuns(t *testing.T) {
	plan := mutated(t, withoutUnknowns(t, planFixture(t)), func(changes []any) []any {
		delivery := lineChange(changes, "spotlight_line.delivery")
		stationIn(delivery["after"].(map[string]any), "backlog")["name"] = "Inbox"
		return append(changes,
			map[string]any{
				"address": "spotlight_line.gone", "mode": "managed", "type": "spotlight_line",
				"provider_name": "registry.terraform.io/usespotlightai/spotlight",
				"change":        map[string]any{"actions": []any{"delete"}, "before": map[string]any{"id": "line_gone"}, "after": nil},
			},
			map[string]any{
				"address": "spotlight_line.lookalike", "mode": "managed", "type": "spotlight_line",
				"provider_name": "registry.terraform.io/not-usespotlightai/spotlight",
				"change":        map[string]any{"actions": []any{"create"}, "before": nil, "after": map[string]any{}},
			},
		)
	})

	read := parsedFixture(t, plan)
	notes := strings.Join(read.Notes, "\n")
	if !strings.Contains(notes, "spotlight_line.gone is removed") || strings.Contains(notes, "lookalike") || !strings.Contains(notes, "changes station backlog, where nothing runs") {
		t.Fatalf("notes:\n%s", notes)
	}
	for _, each := range read.Stations {
		if each.Key == "backlog" {
			t.Fatalf("checked a station where nothing runs")
		}
	}
}

func TestReadPlanCountsDecisionsLeftOutAsChangedWhenTheyWereOn(t *testing.T) {
	plan := mutated(t, withoutUnknowns(t, planFixture(t)), func(changes []any) []any {
		delivery := lineChange(changes, "spotlight_line.delivery")
		stationIn(delivery["before"].(map[string]any), "review")["decisions"] = true
		return changes
	})

	stations := parsedFixture(t, plan).Stations
	if len(stations) != 2 || stations[1].Key != "review" || stations[1].Undecided {
		t.Fatalf("stations = %+v", stations)
	}
	if _, sent := stations[1].Block["decisions"]; sent {
		t.Fatalf("sent decisions Terraform leaves for Spotlight to fill in")
	}
}

func TestCheckRetriesTheStartWithTheSameKeyUntilSpotlightAnswers(t *testing.T) {
	failures := 0
	s := &checkServer{t: t, verdict: []string{"passed"}, post: func(w http.ResponseWriter) bool {
		if failures < 2 {
			failures++
			w.WriteHeader(http.StatusServiceUnavailable)
			return true
		}
		return false
	}}
	server := s.serve()
	defer server.Close()

	got := runCheck(t, map[string]string{urlVar: server.URL, tokenVar: token}, withoutUnknowns(t, planFixture(t)))
	if got.code != 0 || len(s.keys) != 3 || s.keys[0] != s.keys[2] {
		t.Fatalf("code = %d, keys = %v\n%s", got.code, s.keys, got.out)
	}
}

func TestCheckRenewsAnExchangedTokenBeforeItExpires(t *testing.T) {
	verdicts := make([]string, 300)
	for at := range verdicts {
		verdicts[at] = "running"
	}
	verdicts[len(verdicts)-1] = "passed"
	s := &checkServer{t: t, verdict: verdicts}
	server := s.serve()
	defer server.Close()

	got := runCheck(t, map[string]string{urlVar: server.URL, trustVar: "trust_1", oidcTokenVar: "oidc-token"}, withoutUnknowns(t, planFixture(t)), "--timeout", "2h")
	if got.code != 0 || s.exchanges < 2 {
		t.Fatalf("code = %d, exchanges = %d\n%s", got.code, s.exchanges, got.out)
	}
}

func TestStepSummaryEscapesMarkdown(t *testing.T) {
	path := filepath.Join(t.TempDir(), "summary.md")
	title := "Drop *all* [links](https://evil.test) | <b>"
	report := &checkReport{Stations: []*stationCheck{{
		Station: "core/delivery/build",
		Status:  checkFailed,
		Check: &checkRead{Regressions: []checkRegression{{
			TaskID: "task_1", Title: &title, Candidate: []string{"failed"},
		}}},
	}}}

	if err := report.summarise(path); err != nil {
		t.Fatal(err)
	}

	written, _ := os.ReadFile(path)
	if strings.Contains(string(written), "*all*") || strings.Contains(string(written), "[links](") || strings.Contains(string(written), "<b>") || !strings.Contains(string(written), `\*all\*`) {
		t.Fatalf("summary:\n%s", written)
	}
}

func catalogResource(address, kind string, before map[string]any) map[string]any {
	return map[string]any{
		"address": address, "mode": "managed", "type": kind,
		"provider_name": "registry.terraform.io/usespotlightai/spotlight",
		"change":        map[string]any{"actions": []any{"update"}, "before": before, "after": before},
	}
}

func undecidedKeys(stations []plannedStation) string {
	keys := []string{}
	for _, each := range stations {
		if each.Undecided {
			keys = append(keys, each.Key)
		}
	}

	return strings.Join(keys, ",")
}

func TestReadPlanLeavesUndecidedStationsWhoseIntegrationsHooksOrSecretsThePlanChanges(t *testing.T) {
	withTool := func(changes []any) []any {
		delivery := lineChange(changes, "spotlight_line.delivery")
		for _, side := range []string{"before", "after"} {
			stationIn(delivery[side].(map[string]any), "review")["tools"] = []any{"linear.comment"}
		}
		return changes
	}

	for name, tc := range map[string]struct {
		resource map[string]any
		want     string
		says     string
	}{
		"an integration a station's tools come from": {
			resource: catalogResource("spotlight_integration.core_linear", "spotlight_integration", map[string]any{"team_id": coreTeam, "source": "linear"}),
			want:     "review", says: "integration spotlight_integration.core_linear",
		},
		"an integration of another team": {
			resource: catalogResource("spotlight_integration.other_linear", "spotlight_integration", map[string]any{"team_id": "another-team", "source": "linear"}),
			want:     "",
		},
		"a hook matching one station": {
			resource: catalogResource("spotlight_hook.core_notify", "spotlight_hook", map[string]any{"team_id": coreTeam, "key": "notify", "match": map[string]any{"stations": []any{"build"}}}),
			want:     "build", says: "hook spotlight_hook.core_notify",
		},
		"a hook matching every station": {
			resource: catalogResource("spotlight_hook.core_audit", "spotlight_hook", map[string]any{"team_id": coreTeam, "key": "audit", "match": map[string]any{}}),
			want:     "build,review",
		},
		"a secret, which any station may use": {
			resource: catalogResource("spotlight_secret.linear_key", "spotlight_secret", map[string]any{"workspace_id": "ws", "name": "LINEAR_KEY"}),
			want:     "build,review", says: "secret spotlight_secret.linear_key",
		},
	} {
		t.Run(name, func(t *testing.T) {
			plan := mutated(t, withoutUnknowns(t, planFixture(t)), func(changes []any) []any {
				return append(withTool(changes), tc.resource)
			})

			stations := parsedFixture(t, plan).Stations
			if got := undecidedKeys(stations); got != tc.want {
				t.Fatalf("undecided = %q, want %q: %+v", got, tc.want, stations)
			}
			for _, each := range stations {
				if each.Undecided && tc.says != "" && !strings.Contains(each.Because, tc.says) {
					t.Fatalf("%s: %s", each.Key, each.Because)
				}
			}
		})
	}
}

func TestReadPlanLeavesUndecidedTheWorkStationsOfAReplacedLine(t *testing.T) {
	plan := mutated(t, planFixture(t), func(changes []any) []any {
		renamed := lineChange(changes, "spotlight_line.renamed")
		after := renamed["after"].(map[string]any)
		after["station"] = append(after["station"].([]any), map[string]any{"key": "build", "name": "Build", "kind": "work"})
		return changes
	})

	var replaced []plannedStation
	for _, each := range parsedFixture(t, plan).Stations {
		if each.Resource == "spotlight_line.renamed" {
			replaced = append(replaced, each)
		}
	}
	if len(replaced) != 1 || replaced[0].Key != "build" || !replaced[0].Undecided || !strings.Contains(replaced[0].Because, "replaces its line") {
		t.Fatalf("replaced = %+v", replaced)
	}

	got := runCheck(t, map[string]string{}, mutated(t, plan, func(changes []any) []any {
		kept := []any{}
		for _, each := range changes {
			if each.(map[string]any)["address"] != "spotlight_line.delivery" {
				kept = append(kept, each)
			}
		}
		return kept
	}))
	if got.code != undecidedExit {
		t.Fatalf("code = %d\n%s%s", got.code, got.out, got.errOut)
	}
}

func TestUndecidedSaysWhyThereIsNoBaseline(t *testing.T) {
	if !strings.Contains(undecidedSays("no-baseline"), "none can come") {
		t.Fatal(undecidedSays("no-baseline"))
	}
}
