package main

import (
	"fmt"
	"os"

	"usespotlight.ai/data-plane/agent"
	"usespotlight.ai/data-plane/egress"
	"usespotlight.ai/data-plane/host"
	"usespotlight.ai/data-plane/login"
	"usespotlight.ai/data-plane/replay"
	"usespotlight.ai/data-plane/runner"
	"usespotlight.ai/data-plane/telemetry"
)

var version = "dev"

const usage = `usage:
` + agent.Usage + `

` + host.Usage + `
` + runner.Usage + `
` + egress.Usage + `
` + replay.Usage + `
` + login.Usage + `
  spotlight version`

func main() {
	os.Exit(run(os.Args[1:]))
}

func run(args []string) int {
	if len(args) == 0 {
		fmt.Fprintln(os.Stderr, usage)
		return 1
	}

	defer telemetry.Start(roleOf(args[0]), version).Stop()

	switch args[0] {
	case "host":
		return host.Main(args[1:], version)
	case "runner":
		return runner.Main(args[1:], version)
	case "egress":
		return egress.Main(args[1:], version)
	case "replay":
		return replay.Main(args[1:], version)
	case "login":
		return login.Main(args[1:], version)
	case "logout":
		return login.Logout(args[1:], version)
	case "version":
		fmt.Println(version)
	case "help", "-h", "--help":
		fmt.Println(usage)
	default:
		return agent.Main(args)
	}

	return 0
}

func roleOf(command string) string {
	switch command {
	case "host", "runner", "egress", "replay":
		return command
	case "login", "logout":
		return "login"
	default:
		return "agent"
	}
}
