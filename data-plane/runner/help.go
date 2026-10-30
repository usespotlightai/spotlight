package runner

import "usespotlight.ai/data-plane/help"

var runnerHelp = help.Command{
	Path:    "runner",
	Summary: "Do the runs and checks that the host delivers into this sandbox. The host starts it.",
	Usage:   []string{"spotlight runner", "spotlight runner harnesses <json>", "spotlight runner ssh"},
	Notes:   []string{"spotlight runner ssh answers one SSH connection on stdin and stdout, as the agent user, in the workspace."},
	Docs:    "spotlight-command#spotlight-runner",
}

var Commands = []help.Command{runnerHelp}
