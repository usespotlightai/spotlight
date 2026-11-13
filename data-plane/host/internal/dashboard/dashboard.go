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

// Account is the CLI's login on this machine, which spotlight login and spotlight logout change.
type Account interface {
	Logins() ([]Login, error)
	Login() *exec.Cmd
	Logout(address string) (string, error)
}

// Editors is what spotlight ssh setup set up, so that VS Code and Cursor open task workspaces.
type Editors interface {
	Editors() EditorSetup
	Setup() *exec.Cmd
}

type EditorSetup struct {
	Configured bool
	Editors    []Editor
}

type Editor struct {
	Name    string
	Ready   bool
	Message string
}

type Login struct {
	Address string
	User    string
}

type Status struct {
	SetUp     bool
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

func Run(host Host, account Account, editors Editors, version string) error {
	final, err := tea.NewProgram(newModel(host, account, editors, version)).Run()
	if done, ok := final.(model); ok {
		done.logs.stream.stop()
	}
	return err
}
