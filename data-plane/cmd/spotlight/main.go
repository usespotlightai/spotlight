package main

import (
	"fmt"
	"os"

	"usespotlight.ai/data-plane/agent"
	"usespotlight.ai/data-plane/egress"
	"usespotlight.ai/data-plane/host"
	"usespotlight.ai/data-plane/runner"
)

var version = "dev"

const usage = `usage:
` + agent.Usage + `

` + host.Usage + `
` + runner.Usage + `
` + egress.Usage + `
  spotlight version`

func main() {
	args := os.Args[1:]
	if len(args) == 0 {
		fmt.Fprintln(os.Stderr, usage)
		os.Exit(1)
	}

	switch args[0] {
	case "host":
		os.Exit(host.Main(args[1:], version))
	case "runner":
		os.Exit(runner.Main(args[1:], version))
	case "egress":
		os.Exit(egress.Main(args[1:], version))
	case "version":
		fmt.Println(version)
	case "help", "-h", "--help":
		fmt.Println(usage)
	default:
		os.Exit(agent.Main(args))
	}
}
