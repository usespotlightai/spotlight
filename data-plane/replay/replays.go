package replay

import (
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"net/url"
	"strconv"
	"strings"
	"time"
)

type replaySet struct {
	ID          string `json:"id"`
	StationID   string `json:"stationId"`
	Name        string `json:"name"`
	CreatedAt   string `json:"createdAt"`
	StationGone bool   `json:"stationGone"`
	Entries     []struct {
		RunID              string  `json:"runId"`
		TaskID             string  `json:"taskId"`
		UnreplayableReason *string `json:"unreplayableReason"`
	} `json:"entries"`
}

type spend struct {
	Amount   float64 `json:"amount"`
	Currency string  `json:"currency"`
}

type entry struct {
	Result string `json:"result"`
}

type interval struct {
	Rate float64 `json:"rate"`
	Low  float64 `json:"low"`
	High float64 `json:"high"`
}

type gainReading struct {
	Gain    float64 `json:"gain"`
	Low     float64 `json:"low"`
	High    float64 `json:"high"`
	Verdict string  `json:"verdict"`
	MinGain float64 `json:"minGain"`
	Tasks   int     `json:"tasks"`
}

type counterpart struct {
	ReplayID    string    `json:"replayId"`
	SuccessRate *float64  `json:"successRate"`
	Interval    *interval `json:"interval"`
}

type replayRead struct {
	ID        string `json:"id"`
	SetID     string `json:"setId"`
	State     string `json:"state"`
	Candidate *struct {
		ID   string `json:"id"`
		Name string `json:"name"`
		Kind string `json:"kind"`
	} `json:"candidate"`
	IsBaseline bool  `json:"isBaseline"`
	Ceiling    spend `json:"ceiling"`
	Repeats    int   `json:"repeats"`
	Totals     struct {
		Entries     int       `json:"entries"`
		Settled     int       `json:"settled"`
		Succeeded   *int      `json:"succeeded"`
		SuccessRate *float64  `json:"successRate"`
		Interval    *interval `json:"interval"`
		Scored      int       `json:"scored"`
		Tasks       int       `json:"tasks"`
		TasksScored int       `json:"tasksScored"`
		Unscored    int       `json:"unscored"`
		Spent       spend     `json:"spent"`
	} `json:"totals"`
	AgainstBaseline  *gainReading `json:"againstBaseline"`
	ComparedWith     *counterpart `json:"comparedWith"`
	BaselineReplayID *string      `json:"baselineReplayId"`
	Comparison       []struct {
		TaskID     string   `json:"taskId"`
		Candidate  []entry  `json:"candidate"`
		Baseline   []entry  `json:"baseline"`
		CostDelta  *float64 `json:"costDelta"`
		StepsDelta *float64 `json:"stepsDelta"`
		ScoreDelta *float64 `json:"scoreDelta"`
		Regressed  bool     `json:"regressed"`
	} `json:"comparison"`
}

type started struct {
	ID       string `json:"id"`
	Ceiling  spend  `json:"ceiling"`
	Baseline *struct {
		ID     string `json:"id"`
		Status string `json:"status"`
	} `json:"baseline"`
}

type followed struct {
	Replay       replayRead
	ComparedWith *replayRead
	raw          struct {
		Replay       json.RawMessage `json:"replay"`
		ComparedWith json.RawMessage `json:"comparedWith"`
	}
}

const (
	live        = "live"
	maxFailures = 5
	maxBackoff  = 2 * time.Minute
	maxRepeats  = 5
)

func backedOff(every time.Duration, failures int) time.Duration {
	wait := every << failures
	if wait <= 0 || wait > maxBackoff {
		return maxBackoff
	}

	return wait
}

func (c *cli) sets(args []string) error {
	flags := flagsFor("sets")
	if err := flags.parse(args); err != nil {
		return err
	}

	at, err := c.station(*flags.station)
	if err != nil {
		return err
	}

	var raw json.RawMessage
	var sets []replaySet
	if err := c.api.read(at.sets(), &raw, &sets); err != nil {
		return fmt.Errorf("list the replay sets of %s: %w", at.address, err)
	}

	if *flags.json {
		return c.printJSON(raw)
	}

	if len(sets) == 0 {
		fmt.Fprintf(c.out, "%s has no replay sets; pick one on the station's page.\n", at.address)
		return nil
	}

	table := tabled(c.out)
	fmt.Fprintln(table, "NAME\tRUNS\tREPLAYABLE\tCREATED\tID")
	for _, each := range sets {
		replayable := 0
		for _, run := range each.Entries {
			if run.UnreplayableReason == nil {
				replayable++
			}
		}
		fmt.Fprintf(table, "%s\t%d\t%d\t%s\t%s\n", each.Name, len(each.Entries), replayable, each.CreatedAt, each.ID)
	}

	return table.Flush()
}

func (c *cli) setsAt(at *station) ([]replaySet, error) {
	var sets []replaySet
	if err := c.api.get(at.sets(), &sets); err != nil {
		return nil, fmt.Errorf("list the replay sets of %s: %w", at.address, err)
	}

	return sets, nil
}

func (c *cli) start(args []string) error {
	flags := flagsFor("start")
	setNamed := flags.set.String("set", "", "the replay set, by name or id")
	candidateNamed := flags.set.String("candidate", "", "the candidate, by name or id, or live")
	ceiling := flags.set.String("ceiling", "", "the most the replay may spend")
	currency := flags.set.String("currency", "USD", "the currency the ceiling is in")
	repeats := flags.set.Int("repeats", 1, "how many times to replay each run")
	if err := flags.parse(args); err != nil {
		return err
	}
	if *repeats < 1 || *repeats > maxRepeats {
		return fmt.Errorf("--repeats is how many times to replay each run, from 1 to %d, not %d", maxRepeats, *repeats)
	}
	if *setNamed == "" || *candidateNamed == "" {
		return fmt.Errorf("--set and --candidate name what to replay, and under what\nusage:\n%s", Usage)
	}
	amount, err := strconv.ParseFloat(*ceiling, 64)
	if err != nil || amount <= 0 {
		return fmt.Errorf("--ceiling is the most the replay may spend, as a number above 0, not %q", *ceiling)
	}

	at, err := c.station(*flags.station)
	if err != nil {
		return err
	}

	sets, err := c.setsAt(at)
	if err != nil {
		return err
	}
	set, err := pick(sets, *setNamed, "replay set", at.address)
	if err != nil {
		return err
	}

	candidateID := live
	if *candidateNamed != live {
		candidates, _, err := c.candidatesOf(at)
		if err != nil {
			return err
		}
		found, err := pick(candidates, *candidateNamed, "candidate", at.address)
		if err != nil {
			return err
		}
		candidateID = found.ID
	}

	var raw json.RawMessage
	var made started
	if err := c.api.post(
		teamPath(at.teamID)+"/replay-sets/"+url.PathEscape(set.ID)+"/replays",
		map[string]any{"candidate": candidateID, "ceiling": spend{Amount: amount, Currency: *currency}, "repeats": *repeats},
		&raw,
	); err != nil {
		return fmt.Errorf("start a replay of %s: %w", set.Name, err)
	}
	if err := json.Unmarshal(raw, &made); err != nil {
		return fmt.Errorf("Spotlight answered with %q", string(raw))
	}

	if *flags.json {
		return c.printJSON(raw)
	}

	fmt.Fprintf(c.out, "Started replay %s of %s under %s, spending at most %s.\n", made.ID, set.Name, *candidateNamed, money(made.Ceiling))
	if *repeats > 1 {
		fmt.Fprintf(c.out, "It replays each run %d times, to measure how much its results move by chance.\n", *repeats)
	}
	if made.Baseline != nil && made.Baseline.ID != made.ID {
		fmt.Fprintf(c.out, "Its baseline, the live config, replays beside it as %s, with a ceiling of its own.\n", made.Baseline.ID)
	}
	fmt.Fprintf(c.out, "Follow it with: spotlight replay watch --team %s %s\n", at.team, made.ID)

	return nil
}

type replayFlags struct {
	set  *flag.FlagSet
	team *string
	json *bool
}

func replayFlagsFor(name string) replayFlags {
	set := flag.NewFlagSet(name, flag.ContinueOnError)
	set.SetOutput(io.Discard)

	return replayFlags{
		set:  set,
		team: set.String("team", "", "the team the replay is of, by its key"),
		json: set.Bool("json", false, "answer in JSON"),
	}
}

func (f replayFlags) parse(args []string) (string, error) {
	positional, err := parsed(f.set, args)
	if err != nil {
		return "", fmt.Errorf("%w\nusage:\n%s", err, Usage)
	}
	if len(positional) != 1 {
		return "", fmt.Errorf("name the replay, by its id\nusage:\n%s", Usage)
	}

	return positional[0], nil
}

func (c *cli) status(args []string) error {
	flags := replayFlagsFor("status")
	id, err := flags.parse(args)
	if err != nil {
		return err
	}

	teamID, err := c.teamID(*flags.team)
	if err != nil {
		return err
	}

	read, err := c.follow(teamID, id)
	if err != nil {
		return err
	}

	return c.report(read, *flags.json)
}

func (c *cli) watch(args []string) error {
	flags := replayFlagsFor("watch")
	every := flags.set.Duration("every", 15*time.Second, "how often to ask")
	id, err := flags.parse(args)
	if err != nil {
		return err
	}
	if *every < time.Second {
		return fmt.Errorf("--every is at least 1s, not %s", *every)
	}

	teamID, err := c.teamID(*flags.team)
	if err != nil {
		return err
	}

	failures := 0
	for {
		read, err := c.follow(teamID, id)
		if err != nil {
			if !transient(err) {
				return err
			}
			failures++
			if failures >= maxFailures {
				return fmt.Errorf("gave up after %d failed tries in a row: %w", failures, err)
			}
			if !*flags.json {
				fmt.Fprintf(c.out, "could not ask (%v); asking again\n", err)
			}
			c.sleep(backedOff(*every, failures))
			continue
		}
		failures = 0

		if read.ended() {
			return c.report(read, *flags.json)
		}

		if !*flags.json {
			fmt.Fprintf(c.out, "%s: %d of %d settled, %s spent\n", read.Replay.State, read.Replay.Totals.Settled, read.Replay.Totals.Entries, money(read.Replay.Totals.Spent))
		}
		c.sleep(*every)
	}
}

func (c *cli) stop(args []string) error {
	flags := replayFlagsFor("stop")
	id, err := flags.parse(args)
	if err != nil {
		return err
	}

	teamID, err := c.teamID(*flags.team)
	if err != nil {
		return err
	}

	if err := c.api.post(teamPath(teamID)+"/replays/"+url.PathEscape(id)+"/stop", nil, nil); err != nil {
		return fmt.Errorf("stop replay %s: %w", id, err)
	}

	var raw json.RawMessage
	var read replayRead
	if err := c.api.read(teamPath(teamID)+"/replays/"+url.PathEscape(id), &raw, &read); err != nil {
		return fmt.Errorf("read replay %s once stopped: %w", id, err)
	}

	if *flags.json {
		return c.printJSON(raw)
	}

	fmt.Fprintf(c.out, "Stopped replay %s, now %s: nothing more of it starts, and its running runs stop.\n", id, read.State)

	return nil
}

func (c *cli) follow(teamID, id string) (followed, error) {
	var read followed
	if err := c.api.read(teamPath(teamID)+"/replays/"+url.PathEscape(id), &read.raw.Replay, &read.Replay); err != nil {
		return followed{}, fmt.Errorf("read replay %s: %w", id, err)
	}

	compared := read.Replay.ComparedWith
	if compared != nil && compared.ReplayID != read.Replay.ID {
		read.ComparedWith = &replayRead{}
		if err := c.api.read(teamPath(teamID)+"/replays/"+url.PathEscape(compared.ReplayID), &read.raw.ComparedWith, read.ComparedWith); err != nil {
			return followed{}, fmt.Errorf("read the replay it is compared with, %s: %w", compared.ReplayID, err)
		}
	}

	return read, nil
}

func (f followed) ended() bool {
	return ended(f.Replay.State) && (f.ComparedWith == nil || ended(f.ComparedWith.State))
}

func ended(state string) bool {
	return state != "queued" && state != "running"
}

func (f followed) regressions() int {
	regressed := 0
	for _, each := range f.Replay.Comparison {
		if each.Regressed {
			regressed++
		}
	}

	return regressed
}

func (c *cli) report(read followed, asJSON bool) error {
	if asJSON {
		if err := c.printJSON(read.raw); err != nil {
			return err
		}
	} else {
		c.printReplay(read)
	}

	if read.regressions() > 0 {
		return fmt.Errorf("%w on %d of %d tasks", errRegressed, read.regressions(), len(read.Replay.Comparison))
	}

	return nil
}

func (c *cli) printReplay(read followed) {
	replay := read.Replay
	under := "a candidate since withdrawn"
	if replay.Candidate != nil {
		under = fmt.Sprintf("%s (%s)", replay.Candidate.Name, replay.Candidate.Kind)
	}

	fmt.Fprintf(c.out, "Replay %s under %s: %s, %s of %s spent%s\n", replay.ID, under, replay.State, money(replay.Totals.Spent), money(replay.Ceiling), overCeiling(replay))
	if replay.Repeats > 1 {
		fmt.Fprintf(c.out, "It replays each run %d times.\n", replay.Repeats)
	}
	fmt.Fprintf(c.out, "Succeeded: %s, %d unscored\n", totalsSay(replay), replay.Totals.Unscored)
	switch {
	case replay.IsBaseline:
		fmt.Fprint(c.out, "It is the set's baseline.\n\n")
	case read.ComparedWith != nil:
		against := counterpartSays(replay)
		fmt.Fprintf(c.out, "Compared with %s, %s: %s, %d unscored\n", against, read.ComparedWith.State, totalsSay(*read.ComparedWith), read.ComparedWith.Totals.Unscored)
		if both, differs := bothScoredSays(replay.ComparedWith, *read.ComparedWith); differs {
			fmt.Fprintf(c.out, "On the tasks both scored: %s\n", both)
		}
		if replay.AgainstBaseline != nil {
			fmt.Fprintf(c.out, "%s\n", gainSays(*replay.AgainstBaseline, against))
		}
		fmt.Fprintln(c.out)
	default:
		fmt.Fprintf(c.out, "It is compared with nothing: %s.\n\n", nothingComparedSays(replay))
	}

	table := tabled(c.out)
	fmt.Fprintln(table, "\tTASK\tCANDIDATE\tCOMPARED WITH\tCOST Δ\tSTEPS Δ\tSCORE Δ")
	for _, each := range replay.Comparison {
		mark := ""
		if each.Regressed {
			mark = "REGRESSED"
		}
		fmt.Fprintf(table, "%s\t%s\t%s\t%s\t%s\t%s\t%s\n", mark, each.TaskID, resultsSay(each.Candidate), resultsSay(each.Baseline), signed(each.CostDelta), signed(each.StepsDelta), signed(each.ScoreDelta))
	}
	_ = table.Flush()
}

func counterpartSays(replay replayRead) string {
	if replay.BaselineReplayID != nil && replay.ComparedWith.ReplayID == *replay.BaselineReplayID {
		return "the baseline"
	}

	switch candidateKind(replay) {
	case "searched":
		return "the search's starting config"
	case "oracle":
		return "the live config"
	default:
		return "an earlier baseline"
	}
}

func nothingComparedSays(replay replayRead) string {
	switch {
	case candidateKind(replay) == "oracle":
		return "the live replay it was compared with is gone"
	case replay.BaselineReplayID == nil:
		return "the set has no baseline"
	default:
		return "the replay it was set beside is gone"
	}
}

func candidateKind(replay replayRead) string {
	if replay.Candidate == nil {
		return ""
	}

	return replay.Candidate.Kind
}

func bothScoredSays(compared *counterpart, its replayRead) (string, bool) {
	if compared.Interval == nil {
		return "", false
	}

	both := intervalSays(*compared.Interval)

	return both, its.Totals.Interval == nil || intervalSays(*its.Totals.Interval) != both
}

func resultsSay(copies []entry) string {
	if len(copies) == 0 {
		return "none"
	}

	results := make([]string, 0, len(copies))
	for _, each := range copies {
		results = append(results, each.Result)
	}

	return strings.Join(results, "/")
}

func totalsSay(replay replayRead) string {
	said := rate(replay.Totals.Succeeded, replay.Totals.SuccessRate, replay.Totals.Scored)
	if replay.Totals.Interval == nil {
		return said
	}

	return fmt.Sprintf("%s; %s over %d of %d tasks", said, intervalSays(*replay.Totals.Interval), replay.Totals.TasksScored, replay.Totals.Tasks)
}

func intervalSays(of interval) string {
	return fmt.Sprintf("%.0f%% (%.0f–%.0f%%)", of.Rate*100, of.Low*100, of.High*100)
}

func points(share float64) string {
	return fmt.Sprintf("%+.0f", share*100)
}

func gainSays(gain gainReading, against string) string {
	span := fmt.Sprintf("%s points (%s to %s) over %d tasks", points(gain.Gain), points(gain.Low), points(gain.High), gain.Tasks)
	switch gain.Verdict {
	case "better":
		return fmt.Sprintf("Better than %s: %s, past the %.0f-point gain that counts as real", against, span, gain.MinGain*100)
	case "worse":
		return fmt.Sprintf("Worse than %s: %s", against, span)
	default:
		return fmt.Sprintf("Within noise of %s: %s, not clearly past the %.0f-point gain that counts as real", against, span, gain.MinGain*100)
	}
}

func overCeiling(replay replayRead) string {
	over := replay.Totals.Spent.Amount - replay.Ceiling.Amount
	if replay.Totals.Spent.Currency != replay.Ceiling.Currency || over <= 0 {
		return ""
	}

	return fmt.Sprintf(", over the ceiling by %s, spent by runs already running when it was reached", money(spend{Amount: over, Currency: replay.Ceiling.Currency}))
}

func rate(succeeded *int, share *float64, scored int) string {
	if succeeded == nil || share == nil {
		return "nothing scored yet"
	}

	return fmt.Sprintf("%d of %d (%.0f%%)", *succeeded, scored, *share*100)
}

func money(of spend) string {
	return strings.TrimSuffix(strings.TrimRight(fmt.Sprintf("%.4f", of.Amount), "0"), ".") + " " + of.Currency
}

func signed(value *float64) string {
	if value == nil {
		return "-"
	}

	return strconv.FormatFloat(*value, 'f', -1, 64)
}

func (c *cli) printJSON(value any) error {
	encoder := json.NewEncoder(c.out)
	encoder.SetIndent("", "  ")

	return encoder.Encode(value)
}
