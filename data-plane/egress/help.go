package egress

import "usespotlight.ai/data-plane/help"

var egressHelp = help.Command{
	Path:    "egress",
	Summary: "Run the egress proxy for one sandbox. The host starts it.",
	Usage:   []string{"spotlight egress", "spotlight egress serve"},
	Notes:   []string{"The proxy injects the run's secrets into requests to their hosts."},
	Docs:    "spotlight-command#spotlight-egress",
}

var serveHelp = help.Command{
	Path:    "egress serve",
	Summary: "Run one egress proxy for the sandboxes of a push pool.",
	Usage:   []string{"spotlight egress serve"},
	Docs:    "spotlight-command#spotlight-egress",
}

var Commands = []help.Command{egressHelp, serveHelp}
