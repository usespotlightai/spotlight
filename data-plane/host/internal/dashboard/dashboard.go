package dashboard

import (
	"io"
	"os/exec"

	tea "charm.land/bubbletea/v2"

	"usespotlight.ai/data-plane/host/internal/config"
)

// Host is what the dashboard needs from the machine. Each action runs a spotlight host command through Run, or through Attach when the command needs the terminal.
type Host interface {
	Run(args []string, input string) (string, error)
	Attach(args []string) *exec.Cmd
	Status() Status
	Settings() ([]Setting, error)
	ConfigPath() string
	Logs() (io.ReadCloser, error)
}

type Status struct {
	Name      string
	Service   Service
	Sandboxes Sandboxes
	Checks    []Check
}

type Service struct {
	Installed bool
	Running   bool
	Unit      string
	Process   int
}

type Sandboxes struct {
	Running  *int
	Capacity int
}

// Check has a console mark as its Level: console.Passed, console.Warned or console.Failed.
type Check struct {
	Name    string
	Level   string
	Message string
	Fix     string
}

type Setting struct {
	config.Setting
	Value string
	Set   bool
}

func (s Setting) hidden() bool {
	return s.Secret || s.Group == config.GroupOther
}

func Run(host Host, version string) error {
	final, err := tea.NewProgram(newModel(host, version)).Run()
	if done, ok := final.(model); ok {
		done.logs.stream.stop()
	}
	return err
}
