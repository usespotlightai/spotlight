package dashboard

import (
	"fmt"
	"strings"

	tea "charm.land/bubbletea/v2"
)

func editorsCommand() string {
	return "spotlight ssh setup"
}

func (s EditorSetup) waiting() []string {
	var names []string
	for _, each := range s.Editors {
		if !each.Ready {
			names = append(names, each.Name)
		}
	}
	return names
}

func (m model) setUpEditors() (tea.Model, tea.Cmd) {
	if m.running != "" || m.editors == nil || m.account == nil {
		return m, nil
	}
	address := m.account.SuggestedAddress()
	switch {
	case address == "" && len(m.logins.all) > 1:
		return m.openPaletteWith("set up editors for ")
	case address == "" || !m.loggedIn(address):
		return m.logInThen(model.setUpEditorsFor)
	}
	return m.setUpEditorsFor(address)
}

func (m model) setUpEditorsFor(address string) (tea.Model, tea.Cmd) {
	setUp := func(timeout string) func(model) (tea.Model, tea.Cmd) {
		return runs("ssh", "setup", "--url", address, timeout)
	}
	var waiting []string
	if m.editorSetup != nil {
		waiting = m.editorSetup.waiting()
	}
	if len(waiting) == 0 {
		return setUp("--no-editor-timeout")(m)
	}
	return m.ask(
		fmt.Sprintf("Let %s wait up to 10 minutes to connect? A stopped sandbox can take minutes to start.", strings.Join(waiting, " and ")),
		setUp("--editor-timeout"), setUp("--no-editor-timeout"),
	)
}
