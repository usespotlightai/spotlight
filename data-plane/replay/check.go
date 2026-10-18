package replay

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"
)

const CheckUsage = `  spotlight replay check [--json] [--timeout 60m] [--every 15s] [--commit <sha>] [--pull-request <n>] [--repeats 1] <plan.json | ->
      checks each station a saved Terraform plan changes against the replay set
      that gates the station's changes, under the live line's replay_check;
      pass it the output of ` + "`terraform show -json <planfile>`" + `. Reads SPOTLIGHT_URL and
      SPOTLIGHT_API_TOKEN (a workspace token that may plan), or SPOTLIGHT_OIDC_TRUST
      to exchange the CI job's OIDC token (GitHub Actions, or SPOTLIGHT_OIDC_TOKEN).
      --every is how often it reads the status of the checks while they run.
      --repeats replays each run of the set up to 5 times within the line's
      ceiling; each side's success then carries a 95% interval, and the
      candidate's gain over the baseline says whether it is within noise.
      A station the plan renames, a line it replaces, and a station whose
      skill, profile, integration, hook or secret it changes are undecided.
      Appends a summary to GITHUB_STEP_SUMMARY when set. Exits 1 when a check
      could not start or failed to run, else 2 when a change regressed past its
      threshold, else 3 when a check is undecided or still running at the
      timeout (it keeps running), else 0`

const (
	checkPassed    = "passed"
	checkFailed    = "failed"
	checkUndecided = "undecided"
	checkRunning   = "running"
	checkUnchanged = "unchanged"
	checkErrored   = "errored"

	errorExit     = 1
	undecidedExit = 3

	nothingToReplay = "urn:spotlight:problem:nothing-to-replay"
)

type checkSide struct {
	State       *string   `json:"state"`
	Entries     int       `json:"entries"`
	Scored      int       `json:"scored"`
	Succeeded   *int      `json:"succeeded"`
	SuccessRate *float64  `json:"successRate"`
	Interval    *interval `json:"interval"`
	TasksScored int       `json:"tasksScored"`
	Spent       *money    `json:"spent"`
}

type checkRegression struct {
	TaskID    string   `json:"taskId"`
	Title     *string  `json:"title"`
	Candidate []string `json:"candidate"`
	Baseline  []string `json:"baseline"`
	Reasons   []struct {
		Code   string  `json:"code"`
		Detail *string `json:"detail"`
	} `json:"reasons"`
}

type checkRead struct {
	ID                  string   `json:"id"`
	SetName             *string  `json:"setName"`
	ReplayID            string   `json:"replayId"`
	ScoringPinnedToLive []string `json:"scoringPinnedToLive"`
	Result              string   `json:"result"`
	UndecidedBecause    *string  `json:"undecidedBecause"`
	Tasks               int      `json:"tasks"`
	Compared            int      `json:"compared"`
	Threshold           struct {
		MaxRegressions int     `json:"maxRegressions"`
		MinGain        float64 `json:"minGain"`
		Ceiling        money   `json:"ceiling"`
	} `json:"threshold"`
	Repeats     int               `json:"repeats"`
	Gain        *gainEstimate     `json:"gain"`
	Candidate   checkSide         `json:"candidate"`
	Baseline    checkSide         `json:"baseline"`
	Regressions []checkRegression `json:"regressions"`
	ReplayURL   *string           `json:"replayUrl"`
}

type stationCheck struct {
	Station  string     `json:"station"`
	Resource string     `json:"resource"`
	Status   string     `json:"status"`
	Message  string     `json:"message,omitempty"`
	URL      string     `json:"url,omitempty"`
	Check    *checkRead `json:"check,omitempty"`

	teamID  string
	pending bool
	misses  int
}

type checkReport struct {
	Stations []*stationCheck `json:"stations"`
	Notes    []string        `json:"notes"`
	ExitCode int             `json:"exitCode"`
}

type checking struct {
	api   *api
	sleep func(time.Duration)
	now   func() time.Time
}

type checkOptions struct {
	json        bool
	timeout     time.Duration
	every       time.Duration
	commit      string
	pullRequest int
	repeats     int
	plan        string
}

func checkOptionsOf(args []string) (checkOptions, error) {
	set := flag.NewFlagSet("check", flag.ContinueOnError)
	set.SetOutput(io.Discard)

	asJSON := set.Bool("json", false, "answer in JSON")
	timeout := set.Duration("timeout", 60*time.Minute, "how long to wait for the checks")
	every := set.Duration("every", 15*time.Second, "how often to read the status")
	commit := set.String("commit", "", "the commit that plans the change")
	pullRequest := set.Int("pull-request", 0, "the pull request that plans the change")
	repeats := set.Int("repeats", 1, "how many times to replay each run")

	positional, err := parsed(set, args)
	if err != nil {
		return checkOptions{}, fmt.Errorf("%w\nusage:\n%s", err, CheckUsage)
	}
	if len(positional) != 1 {
		return checkOptions{}, fmt.Errorf("name the plan, the output of `%s`, or - to read it from stdin\nusage:\n%s", showCommand, CheckUsage)
	}
	if *timeout <= 0 {
		return checkOptions{}, fmt.Errorf("--timeout is how long to wait, above 0, not %s", *timeout)
	}
	if *every < time.Second {
		return checkOptions{}, fmt.Errorf("--every is at least 1s, not %s", *every)
	}
	if *pullRequest < 0 {
		return checkOptions{}, fmt.Errorf("--pull-request is the number of a pull request, not %d", *pullRequest)
	}
	if *repeats < 1 || *repeats > maxRepeats {
		return checkOptions{}, fmt.Errorf("--repeats is how many times to replay each run, from 1 to %d, not %d", maxRepeats, *repeats)
	}

	return checkOptions{
		json:        *asJSON,
		timeout:     *timeout,
		every:       *every,
		commit:      *commit,
		pullRequest: *pullRequest,
		repeats:     *repeats,
		plan:        positional[0],
	}, nil
}

func check(args []string, in io.Reader, out, errOut io.Writer, env func(string) string, version string, sleep func(time.Duration), now func() time.Time) int {
	options, err := checkOptionsOf(args)
	if err != nil {
		fmt.Fprintln(errOut, "spotlight replay check:", err)
		return errorExit
	}

	plan, err := planFrom(options.plan, in)
	if err != nil {
		fmt.Fprintln(errOut, "spotlight replay check:", err)
		return errorExit
	}

	report := &checkReport{Notes: plan.Notes, Stations: []*stationCheck{}}

	var client *api
	if plan.wanted() > 0 {
		client, err = checkAPI(env, version, now)
		if err != nil {
			fmt.Fprintln(errOut, "spotlight replay check:", err)
			return errorExit
		}
	}

	c := &checking{api: client, sleep: sleep, now: now}
	c.run(plan, options, report)

	report.ExitCode = report.exitCode()

	if options.json {
		encoder := json.NewEncoder(out)
		encoder.SetIndent("", "  ")
		if err := encoder.Encode(report); err != nil {
			fmt.Fprintln(errOut, "spotlight replay check:", err)
			return errorExit
		}
	} else {
		report.print(out)
	}

	if path := env("GITHUB_STEP_SUMMARY"); path != "" {
		if err := report.summarise(path); err != nil {
			fmt.Fprintln(errOut, "spotlight replay check: could not write the step summary:", err)
		}
	}

	return report.ExitCode
}

func planFrom(path string, in io.Reader) (planned, error) {
	if path == "-" {
		return readPlan(in)
	}

	file, err := os.Open(path)
	if err != nil {
		return planned{}, fmt.Errorf("open the plan: %w", err)
	}
	defer file.Close()

	return readPlan(file)
}

func (p planned) wanted() int {
	wanted := 0
	for _, each := range p.Stations {
		if !each.Undecided {
			wanted++
		}
	}

	return wanted
}

func (c *checking) run(plan planned, options checkOptions, report *checkReport) {
	for _, each := range plan.Stations {
		checked := &stationCheck{Station: each.Path, Resource: each.Resource, teamID: each.TeamID}
		report.Stations = append(report.Stations, checked)

		if each.Undecided {
			checked.Status = checkUndecided
			checked.Message = each.Because
			continue
		}

		c.start(checked, each, options)
	}

	deadline := c.now().Add(options.timeout)
	for {
		waiting := false
		for _, checked := range report.Stations {
			if checked.pending {
				c.follow(checked)
				waiting = waiting || checked.pending
			}
		}

		left := deadline.Sub(c.now())
		if !waiting || left <= 0 {
			break
		}

		wait := options.every
		for _, checked := range report.Stations {
			if checked.pending && checked.misses > 0 {
				wait = max(wait, retryDelay(options.every, checked.misses))
			}
		}
		c.sleep(min(wait, left))
	}

	for _, checked := range report.Stations {
		if checked.pending {
			checked.pending = false
			checked.Status = checkRunning
			checked.Message = fmt.Sprintf("still running after %s; it keeps running, so follow it at its link", options.timeout)
		}
	}
}

func (c *checking) start(checked *stationCheck, each plannedStation, options checkOptions) {
	reference := map[string]any{}
	if options.commit != "" {
		reference["commit"] = options.commit
	}
	if options.pullRequest > 0 {
		reference["pullRequest"] = options.pullRequest
	}

	body := map[string]any{"lineId": each.LineID, "stationKey": each.Key, "station": each.Block, "reference": reference, "repeats": options.repeats}
	if each.Line != nil {
		body["line"] = each.Line
	}

	key := checkKey(each, options)
	var read checkRead
	var err error
	for failures := 0; ; failures++ {
		err = c.api.call(http.MethodPost, teamPath(each.TeamID)+"/replay-checks", body, map[string]string{idempotencyHeader: key}, &read)
		if !transient(err) || failures+1 >= maxFailures {
			break
		}
		c.sleep(retryDelay(options.every, failures+1))
	}

	var answer *answered
	switch {
	case errors.As(err, &answer) && answer.errorBody.Type == nothingToReplay:
		checked.Status = checkUnchanged
		checked.Message = answer.errorBody.Detail
	case err != nil:
		checked.Status = checkErrored
		checked.Message = err.Error()
	default:
		c.record(checked, read)
	}
}

func (c *checking) follow(checked *stationCheck) {
	var read checkRead
	err := c.api.get(teamPath(checked.teamID)+"/replay-checks/"+url.PathEscape(checked.Check.ID), &read)
	if err != nil {
		if !transient(err) {
			checked.pending = false
			checked.Status = checkErrored
			checked.Message = err.Error()
			return
		}
		checked.misses++
		if checked.misses >= maxFailures {
			checked.pending = false
			checked.Status = checkErrored
			checked.Message = fmt.Sprintf("gave up after %d failed tries in a row: %v", checked.misses, err)
		}
		return
	}

	checked.misses = 0
	c.record(checked, read)
}

func (c *checking) record(checked *stationCheck, read checkRead) {
	checked.Check = &read
	checked.Status = read.Result
	checked.pending = read.Result == checkRunning
	if read.ReplayURL != nil {
		checked.URL = *read.ReplayURL
	}
}

func checkKey(each plannedStation, options checkOptions) string {
	written, _ := json.Marshal([]any{each.LineID, each.Key, each.Block, each.Line, options.commit, options.pullRequest, options.repeats})
	sum := sha256.Sum256(written)

	return "replay-check-" + hex.EncodeToString(sum[:])
}

func (r *checkReport) exitCode() int {
	worst := 0
	for _, each := range r.Stations {
		switch each.Status {
		case checkErrored:
			return errorExit
		case checkFailed:
			worst = regressedExit
		case checkUndecided, checkRunning:
			if worst == 0 {
				worst = undecidedExit
			}
		}
	}

	return worst
}

func (r *checkReport) print(out io.Writer) {
	for _, note := range r.Notes {
		fmt.Fprintf(out, "note: %s\n", note)
	}

	if len(r.Stations) == 0 {
		fmt.Fprintln(out, "The plan changes no live station of a line, so there is nothing to check.")
		return
	}

	for _, each := range r.Stations {
		fmt.Fprintf(out, "\n%s: %s\n", each.Station, strings.ToUpper(each.Status))
		if each.Message != "" {
			fmt.Fprintf(out, "  %s\n", each.Message)
		}

		read := each.Check
		if read == nil {
			continue
		}

		set := "its gating set"
		if read.SetName != nil {
			set = fmt.Sprintf("set %q", *read.SetName)
		}
		fmt.Fprintf(out, "  %d of %d tasks regressed (at most %d may), replaying %s: %d tasks, %d scored on both sides\n",
			len(read.Regressions), read.Tasks, read.Threshold.MaxRegressions, set, read.Tasks, read.Compared)
		if read.UndecidedBecause != nil {
			fmt.Fprintf(out, "  undecided: %s\n", describeUndecided(*read.UndecidedBecause))
		}
		if read.Repeats > 1 {
			fmt.Fprintf(out, "  each run replayed %d times\n", read.Repeats)
		}
		fmt.Fprintf(out, "  candidate %s, baseline %s\n", describeSide(read.Candidate), describeSide(read.Baseline))
		if read.Gain != nil {
			fmt.Fprintf(out, "  %s\n", describeGain(*read.Gain, "the baseline"))
		}
		fmt.Fprintf(out, "  spent %s of a %s ceiling\n", describeSpent(read.Candidate.Spent), formatMoney(read.Threshold.Ceiling))
		if len(read.ScoringPinnedToLive) > 0 {
			fmt.Fprintf(out, "  scored with the live %s, which the plan also changes\n", strings.Join(read.ScoringPinnedToLive, ", "))
		}
		for _, regressed := range read.Regressions {
			fmt.Fprintf(out, "  REGRESSED %s: %s\n", describeTask(regressed), describeReasons(regressed))
		}
		if each.URL != "" {
			fmt.Fprintf(out, "  %s\n", each.URL)
		}
	}
}

func (r *checkReport) summarise(path string) error {
	file, err := os.OpenFile(path, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0o644)
	if err != nil {
		return err
	}
	defer file.Close()

	var written strings.Builder
	written.WriteString("## Spotlight replay check\n\n")
	for _, note := range r.Notes {
		fmt.Fprintf(&written, "> %s\n\n", markdownCell(note))
	}

	if len(r.Stations) == 0 {
		written.WriteString("The plan changes no live station of a line, so there is nothing to check.\n")
		_, err := file.WriteString(written.String())
		return err
	}

	written.WriteString("| Station | Result | Regressed | Candidate | Baseline | Gain | Spent | Replay |\n")
	written.WriteString("| --- | --- | --- | --- | --- | --- | --- | --- |\n")
	for _, each := range r.Stations {
		regressed, candidate, baseline, gain, spent, link := "", "", "", "", "", ""
		if read := each.Check; read != nil {
			regressed = fmt.Sprintf("%d of %d (at most %d)", len(read.Regressions), read.Tasks, read.Threshold.MaxRegressions)
			candidate = describeSide(read.Candidate)
			baseline = describeSide(read.Baseline)
			gain = gainCell(read.Gain)
			spent = describeSpent(read.Candidate.Spent)
		}
		if each.URL != "" {
			link = fmt.Sprintf("[open](%s)", each.URL)
		}
		fmt.Fprintf(&written, "| %s | %s | %s | %s | %s | %s | %s | %s |\n", markdownCell(each.Station), markdownCell(each.Status), markdownCell(regressed), markdownCell(candidate), markdownCell(baseline), markdownCell(gain), markdownCell(spent), link)
	}

	for _, each := range r.Stations {
		if each.Message == "" && (each.Check == nil || (len(each.Check.Regressions) == 0 && each.Check.Gain == nil)) {
			continue
		}
		fmt.Fprintf(&written, "\n### %s\n\n", markdownCell(each.Station))
		if each.Message != "" {
			fmt.Fprintf(&written, "%s\n\n", markdownCell(each.Message))
		}
		if each.Check != nil && each.Check.Gain != nil {
			fmt.Fprintf(&written, "%s\n\n", markdownCell(describeGain(*each.Check.Gain, "the baseline")))
		}
		if each.Check != nil {
			for _, regressed := range each.Check.Regressions {
				fmt.Fprintf(&written, "- **%s**: %s\n", markdownCell(describeTask(regressed)), markdownCell(describeReasons(regressed)))
			}
		}
	}

	_, err = file.WriteString(written.String())
	return err
}

var markdownSpecials = strings.NewReplacer(
	"\\", "\\\\", "`", "\\`", "*", "\\*", "_", "\\_", "[", "\\[", "]", "\\]",
	"<", "\\<", ">", "\\>", "#", "\\#", "!", "\\!", "|", "\\|", "~", "\\~",
	"\n", " ", "\r", " ",
)

func markdownCell(text string) string {
	return markdownSpecials.Replace(text)
}

func describeUndecided(because string) string {
	switch because {
	case "stopped":
		return "the replay was stopped"
	case "over-ceiling":
		return "the replay hit its ceiling before every task ran"
	case "baseline-unfinished":
		return "the baseline replay of the live config did not finish"
	case "no-baseline":
		return "no baseline replay of the live config the check started against is left, and none can come, since the live config or its set moved on"
	case "too-few-scored":
		return "fewer than half the tasks were scored on both sides"
	case "replay-gone":
		return "the replay is gone"
	default:
		return because
	}
}

func describeSide(side checkSide) string {
	if side.Succeeded == nil || side.SuccessRate == nil {
		return "nothing scored yet"
	}
	if side.Interval == nil {
		return fmt.Sprintf("%d of %d succeeded (%.0f%%)", *side.Succeeded, side.Scored, *side.SuccessRate*100)
	}

	return fmt.Sprintf("%d of %d succeeded, %s over %d tasks", *side.Succeeded, side.Scored, describeInterval(*side.Interval), side.TasksScored)
}

func gainCell(gain *gainEstimate) string {
	if gain == nil {
		return "-"
	}

	significance := gain.Significance
	if significance == "within-noise" {
		significance = "within noise"
	}

	return fmt.Sprintf("%s points (%s to %s), %s", points(gain.Gain), points(gain.Low), points(gain.High), significance)
}

func describeSpent(spent *money) string {
	if spent == nil {
		return "nothing"
	}

	return formatMoney(*spent)
}

func describeTask(regressed checkRegression) string {
	if regressed.Title != nil && *regressed.Title != "" {
		return fmt.Sprintf("%s %q", regressed.TaskID, *regressed.Title)
	}

	return regressed.TaskID
}

func describeReasons(regressed checkRegression) string {
	baseline := "none"
	if len(regressed.Baseline) > 0 {
		baseline = strings.Join(regressed.Baseline, "/")
	}

	reasons := make([]string, 0, len(regressed.Reasons))
	for _, each := range regressed.Reasons {
		if each.Detail != nil && *each.Detail != "" {
			reasons = append(reasons, each.Code+": "+*each.Detail)
		} else {
			reasons = append(reasons, each.Code)
		}
	}

	text := fmt.Sprintf("%s where the baseline %s", strings.Join(regressed.Candidate, "/"), baseline)
	if len(reasons) > 0 {
		text += ", " + strings.Join(reasons, "; ")
	}

	return text
}
