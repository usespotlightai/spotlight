package session

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"maps"
	"os"
	"strings"
	"time"

	"usespotlight.ai/data-plane/protocol"
)

const (
	servicesStep = "services"
	// servicesWait is longer than the host takes to give up on the services, so its outcome arrives first.
	servicesWait = 6 * time.Minute
	servicesPoll = 250 * time.Millisecond
)

// awaitServices waits for the host to start the run's services, before setup that may need them, and journals how
// each started. It gives the ones that did not start.
func (o Options) awaitServices(
	ctx context.Context, run protocol.Run, journal *journalWriter, log *slog.Logger,
) []protocol.ServiceOutcome {
	if len(run.Spec.Services) == 0 {
		return nil
	}
	if !o.HostServices {
		journal.note(servicesStep, true, "This host does not start the services of a Compose file, so none run. Update the host to start them.")
		return downFor(run, "this host does not start services")
	}

	waiting := journal.begin(ctx, servicesStep)
	outcomes, err := o.servicesStarted(ctx, run)
	if err != nil {
		log.Warn("the run's services did not report how they started", "error", err)
		outcomes = downFor(run, "the host did not say whether it started")
	}

	var down []protocol.ServiceOutcome
	for _, outcome := range outcomes {
		if !outcome.Ready {
			down = append(down, outcome)
		}
	}
	waiting.end(ctx, len(down) > 0, describeServices(outcomes))
	return down
}

func downFor(run protocol.Run, problem string) []protocol.ServiceOutcome {
	outcomes := make([]protocol.ServiceOutcome, 0, len(run.Spec.Services))
	for _, service := range run.Spec.Services {
		outcomes = append(outcomes, protocol.ServiceOutcome{Name: service.Name, From: service.From, Problem: problem})
	}
	return outcomes
}

func (o Options) servicesStarted(ctx context.Context, run protocol.Run) ([]protocol.ServiceOutcome, error) {
	path := o.ServicesFile
	if path == "" {
		path = protocol.ServicesPath
	}
	wait := o.ServicesWait
	if wait <= 0 {
		wait = servicesWait
	}

	waiting, cancel := context.WithTimeout(ctx, wait)
	defer cancel()
	poll := time.NewTicker(servicesPoll)
	defer poll.Stop()

	for {
		body, err := os.ReadFile(path)
		if err == nil {
			var started protocol.ServicesStarted
			if json.Unmarshal(body, &started) == nil && started.Run == run.ID {
				return started.Services, nil
			}
		} else if !errors.Is(err, os.ErrNotExist) {
			return nil, err
		}

		select {
		case <-waiting.Done():
			return nil, fmt.Errorf("no word within %s", wait)
		case <-poll.C:
		}
	}
}

// servicesUnproxied keeps the run's services out of the proxy, so an HTTP client in setup, the agent or a check
// reaches each by its name on the sandbox's network instead of asking egress for it.
func servicesUnproxied(env map[string]string, services []protocol.Service) map[string]string {
	if len(services) == 0 {
		return env
	}
	names := make([]string, 0, len(services))
	for _, service := range services {
		names = append(names, service.Name)
	}

	unproxied := maps.Clone(env)
	for _, key := range []string{"NO_PROXY", "no_proxy"} {
		if local, ok := unproxied[key]; ok {
			unproxied[key] = strings.Join(append([]string{local}, names...), ",")
		}
	}
	return unproxied
}

// describeServices says, for a person, which services started from which Compose files and why others did not.
func describeServices(outcomes []protocol.ServiceOutcome) string {
	byFile := map[string][]string{}
	var files []string
	var problems []string
	for _, outcome := range outcomes {
		if !outcome.Ready {
			problems = append(problems, fmt.Sprintf("%s from %s did not start: %s", outcome.Name, outcome.From, outcome.Problem))
			continue
		}
		if _, seen := byFile[outcome.From]; !seen {
			files = append(files, outcome.From)
		}
		byFile[outcome.From] = append(byFile[outcome.From], outcome.Name)
	}

	var lines []string
	for _, file := range files {
		lines = append(lines, fmt.Sprintf("Started %s from %s.", listed(byFile[file]), file))
	}
	return strings.Join(append(lines, problems...), "\n")
}

func listed(names []string) string {
	switch len(names) {
	case 0:
		return ""
	case 1:
		return names[0]
	default:
		return strings.Join(names[:len(names)-1], ", ") + " and " + names[len(names)-1]
	}
}

// downNote tells the agent which services it cannot reach, so it does not take their absence for a fault of its own.
func downNote(down []protocol.ServiceOutcome) string {
	if len(down) == 0 {
		return ""
	}

	var note strings.Builder
	note.WriteString("These services from the repository's Compose files did not start, so what needs them may fail:\n")
	for _, outcome := range down {
		fmt.Fprintf(&note, "\n- %s (%s): %s\n", outcome.Name, outcome.From, strings.ReplaceAll(outcome.Problem, "\n", "\n  "))
	}
	note.WriteString("\nDo the task as far as you can. In your handover, say which services did not start and why, so that a person can repair them.\n\n")
	return note.String()
}
