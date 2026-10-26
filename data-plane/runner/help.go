package runner

import "usespotlight.ai/data-plane/help"

var runnerHelp = help.Command{
	Path:    "runner",
	Summary: "Do the one run or check that this sandbox started for. The host starts it.",
	Usage:   []string{"spotlight runner", "spotlight runner harnesses <json>"},
	Docs:    "spotlight-command#spotlight-runner",
}

var Commands = []help.Command{runnerHelp}
