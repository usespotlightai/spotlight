package agent

import (
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"os"
	"strings"

	"usespotlight.ai/data-plane/protocol"
)

const traceUsage = `usage:
  spotlight trace --task <id> [--out <path>]`

func traceCmd(args []string, out io.Writer) error {
	flags := flag.NewFlagSet("trace", flag.ContinueOnError)
	flags.SetOutput(io.Discard)
	task := flags.String("task", "", "the task whose trace to write")
	path := flags.String("out", "", "where to write it (a temporary file by default)")

	if err := flags.Parse(args); err != nil {
		return fmt.Errorf("%s", traceUsage)
	}
	if strings.TrimSpace(*task) == "" {
		return fmt.Errorf("--task is required\n%s", traceUsage)
	}

	trace, err := fetchTrace(*task)
	if err != nil {
		return err
	}

	written, err := json.MarshalIndent(trace, "", "  ")
	if err != nil {
		return err
	}

	file, err := traceFile(*path)
	if err != nil {
		return err
	}
	defer file.Close()

	if _, err := file.Write(written); err != nil {
		return fmt.Errorf("write the trace: %w", err)
	}

	fmt.Fprintf(
		out,
		"Wrote the trace to %s — %d nodes, %d faults, %s. Read and search that "+
			"file with your own tools rather than loading it whole.\n",
		file.Name(), trace.Rows, trace.Faults, tookMs(trace.Ms),
	)

	return nil
}

func traceFile(path string) (*os.File, error) {
	if strings.TrimSpace(path) == "" {
		file, err := os.CreateTemp("", "spotlight-trace-*.json")
		if err != nil {
			return nil, fmt.Errorf("make a file for the trace: %w", err)
		}
		return file, nil
	}

	file, err := os.Create(path)
	if err != nil {
		return nil, fmt.Errorf("open %s: %w", path, err)
	}

	return file, nil
}

func fetchTrace(taskID string) (protocol.Trace, error) {
	endpoint, token := os.Getenv(protocol.HandoverURLVar), os.Getenv(protocol.HandoverTokenVar)
	if endpoint == "" || token == "" {
		return protocol.Trace{}, fmt.Errorf(
			"no run to read a trace from: spotlight runs inside a Spotlight workspace",
		)
	}

	asked, err := json.Marshal(protocol.TraceRequest{Task: taskID})
	if err != nil {
		return protocol.Trace{}, err
	}

	answered, err := post(
		strings.TrimSuffix(endpoint, "/")+protocol.HandoverTracePath, token, asked,
	)
	if err != nil {
		return protocol.Trace{}, err
	}

	var trace protocol.Trace
	if err := json.Unmarshal([]byte(answered), &trace); err != nil {
		return protocol.Trace{}, fmt.Errorf("Spotlight answered with %q", answered)
	}

	return trace, nil
}

func tookMs(ms int) string {
	if ms >= 1000 {
		return fmt.Sprintf("%.1fs", float64(ms)/1000)
	}

	return fmt.Sprintf("%dms", ms)
}
