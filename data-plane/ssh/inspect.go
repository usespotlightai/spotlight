package ssh

import (
	"fmt"
	"os"
	"path/filepath"
)

// Setup is what spotlight ssh setup set up on this computer for its user.
type Setup struct {
	Configured bool     `json:"configured"`
	Editors    []Editor `json:"editors"`
}

type Editor struct {
	Name    string `json:"name"`
	Ready   bool   `json:"ready"`
	Message string `json:"message"`
}

func Inspect(env func(string) string, system string) Setup {
	home := env("HOME")
	if home == "" {
		return Setup{Editors: []Editor{}}
	}
	setup := Setup{Configured: configured(home), Editors: []Editor{}}
	for _, each := range editors(system, env) {
		state := readEditorTimeout(each)
		switch {
		case state.err != nil:
			setup.Editors = append(setup.Editors, Editor{Name: each.name, Message: fmt.Sprintf("Sorry, %s cannot be read: %v.", homeShown(each.settings, home), state.err)})
		case state.enough():
			setup.Editors = append(setup.Editors, Editor{Name: each.name, Ready: true, Message: state.described()})
		default:
			setup.Editors = append(setup.Editors, Editor{Name: each.name, Message: state.described() + " A stopped sandbox can take minutes to start."})
		}
	}
	return setup
}

func configured(home string) bool {
	managed := filepath.Join(home, ".ssh", "spotlight", "config")
	if _, err := os.Stat(managed); err != nil {
		return false
	}
	config, err := os.ReadFile(filepath.Join(home, ".ssh", "config"))
	if err != nil {
		return false
	}
	_, missing := withInclude(string(config), managed)
	return !missing
}
