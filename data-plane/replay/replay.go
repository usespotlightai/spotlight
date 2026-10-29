package replay

import (
	"flag"
	"fmt"
	"net/url"
	"os"
	"strings"
	"time"
)

const (
	urlVar   = "SPOTLIGHT_URL"
	tokenVar = "SPOTLIGHT_API_TOKEN"

	regressedExit = 2

	maxFailures = 5
	maxBackoff  = 2 * time.Minute
	maxRepeats  = 5
)

type money struct {
	Amount   float64 `json:"amount"`
	Currency string  `json:"currency"`
}

type interval struct {
	Rate float64 `json:"rate"`
	Low  float64 `json:"low"`
	High float64 `json:"high"`
}

type gainEstimate struct {
	Gain         float64 `json:"gain"`
	Low          float64 `json:"low"`
	High         float64 `json:"high"`
	Significance string  `json:"significance"`
	MinGain      float64 `json:"minGain"`
	Tasks        int     `json:"tasks"`
}

func Main(args []string, version string) int {
	if len(args) > 0 && args[0] == "check" {
		return check(args[1:], os.Stdin, os.Stdout, os.Stderr, os.Getenv, version, time.Sleep, time.Now)
	}

	if len(args) == 0 {
		fmt.Fprintf(os.Stderr, "spotlight replay: say which command\n%s\n", replayHelp.Synopsis())
	} else {
		fmt.Fprintf(os.Stderr, "spotlight replay: no command %q\n%s\n", "replay "+args[0], replayHelp.Synopsis())
	}

	return 1
}

func retryDelay(every time.Duration, failures int) time.Duration {
	wait := every << failures
	if wait <= 0 || wait > maxBackoff {
		return maxBackoff
	}

	return wait
}

func teamPath(teamID string) string {
	return "/api/teams/" + url.PathEscape(teamID)
}

func parsed(set *flag.FlagSet, args []string) ([]string, error) {
	var positional []string

	for {
		if err := set.Parse(args); err != nil {
			return nil, err
		}
		if set.NArg() == 0 {
			return positional, nil
		}

		positional = append(positional, set.Arg(0))
		args = set.Args()[1:]
	}
}

func describeInterval(of interval) string {
	return fmt.Sprintf("%.0f%% (%.0f–%.0f%%)", of.Rate*100, of.Low*100, of.High*100)
}

func points(share float64) string {
	return fmt.Sprintf("%+.0f", share*100)
}

func describeGain(gain gainEstimate, reference string) string {
	span := fmt.Sprintf("%s points (%s to %s) over %d tasks", points(gain.Gain), points(gain.Low), points(gain.High), gain.Tasks)
	switch gain.Significance {
	case "better":
		return fmt.Sprintf("Better than %s: %s, past the %.0f-point gain that counts as real", reference, span, gain.MinGain*100)
	case "worse":
		return fmt.Sprintf("Worse than %s: %s", reference, span)
	default:
		return fmt.Sprintf("Within noise of %s: %s, not clearly past the %.0f-point gain that counts as real", reference, span, gain.MinGain*100)
	}
}

func formatMoney(of money) string {
	return strings.TrimSuffix(strings.TrimRight(fmt.Sprintf("%.4f", of.Amount), "0"), ".") + " " + of.Currency
}
