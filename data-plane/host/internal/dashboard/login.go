package dashboard

import (
	"context"
	"errors"
	"fmt"
	"slices"
	"strings"

	"charm.land/bubbles/v2/textinput"
	tea "charm.land/bubbletea/v2"
	"github.com/charmbracelet/x/ansi"

	"usespotlight.ai/data-plane/console"
	"usespotlight.ai/data-plane/credentials"
)

type loginStep int

const (
	addressStep loginStep = iota
	startingStep
	approvingStep
)

type loginView struct {
	step     loginStep
	input    textinput.Model
	note     string
	approval Approval
	opened   bool
	attempt  int
	ctx      context.Context
	cancel   context.CancelFunc
	then     func(model, string) (tea.Model, tea.Cmd)
}

type (
	loginStartedMsg struct {
		attempt  int
		approval Approval
		opened   bool
		err      error
	}
	loginDoneMsg struct {
		attempt int
		user    string
		err     error
	}
)

func newLoginView() loginView {
	return loginView{input: newInput(shownAddress(credentials.DefaultAddress)), cancel: func() {}}
}

func (m model) logIn() (tea.Model, tea.Cmd) {
	return m.logInThen(nil)
}

func (m model) logInThen(then func(model, string) (tea.Model, tea.Cmd)) (tea.Model, tea.Cmd) {
	if m.running != "" || m.account == nil {
		return m, nil
	}
	m.question, m.mode = nil, loggingIn
	m.login.step, m.login.note, m.login.then = addressStep, "", then
	m.login.input.SetValue(strings.TrimPrefix(m.account.Address(), "https://"))
	m.login.input.CursorEnd()
	return m, m.login.input.Focus()
}

func (m model) startLogin() (tea.Model, tea.Cmd) {
	address := strings.TrimSpace(m.login.input.Value())
	if address == "" {
		address = m.login.input.Placeholder
		m.login.input.SetValue(address)
	}
	m.login.cancel()
	m.login.ctx, m.login.cancel = context.WithCancel(context.Background())
	m.login.attempt++
	m.login.step, m.login.note = startingStep, ""
	m.login.input.Blur()

	account, ctx, attempt := m.account, m.login.ctx, m.login.attempt
	return m, tea.Batch(m.spin(), func() tea.Msg {
		approval, err := account.Login(ctx, address)
		opened := err == nil && approval.Open != nil && approval.Open() == nil
		return loginStartedMsg{attempt: attempt, approval: approval, opened: opened, err: err}
	})
}

func (m model) loginStarted(msg loginStartedMsg) (tea.Model, tea.Cmd) {
	if msg.attempt != m.login.attempt || m.mode != loggingIn {
		return m, nil
	}
	if msg.err != nil {
		return m.loginFailed(msg.err)
	}
	m.login.step, m.login.approval, m.login.opened = approvingStep, msg.approval, msg.opened
	wait, ctx, attempt := msg.approval.Wait, m.login.ctx, m.login.attempt
	return m, func() tea.Msg {
		user, err := wait(ctx)
		return loginDoneMsg{attempt: attempt, user: user, err: err}
	}
}

func (m model) loginDone(msg loginDoneMsg) (tea.Model, tea.Cmd) {
	if msg.attempt != m.login.attempt || m.mode != loggingIn {
		return m, nil
	}
	if msg.err != nil {
		return m.loginFailed(msg.err)
	}
	m.login.cancel()
	address := m.login.approval.Address
	m.mode = browsing
	m.last = &outcome{command: loginCommand(), output: fmt.Sprintf("Logged in to %s as %s.", shownAddress(address), msg.user)}
	m.logins = append(slices.DeleteFunc(slices.Clone(m.logins), func(each Login) bool { return each.Address == address }), Login{Address: address, User: msg.user})
	reload := m.loadLogins()
	if m.login.then == nil {
		return m, reload
	}
	next, cmd := m.login.then(m, address)
	return next, tea.Batch(reload, cmd)
}

func (m model) loginFailed(err error) (tea.Model, tea.Cmd) {
	m.login.cancel()
	m.login.step, m.login.note = addressStep, sentence(err.Error())
	if errors.Is(err, context.Canceled) {
		m.login.note = ""
	}
	return m, m.login.input.Focus()
}

func sentence(text string) string {
	if text == "" || strings.ContainsAny(text[len(text)-1:], ".!?") {
		return text
	}
	return text + "."
}

func (m model) endLogin() (tea.Model, tea.Cmd) {
	m.login.cancel()
	m.login.attempt++
	m.login.input.Blur()
	m.mode = browsing
	return m, nil
}

func (m model) openLoginPage() (tea.Model, tea.Cmd) {
	if open := m.login.approval.Open; open != nil {
		m.login.opened = open() == nil
	}
	return m, nil
}

func (m model) waitingForLogin() bool {
	return m.mode == loggingIn && m.login.step != addressStep
}

func (m model) loggedIn(address string) bool {
	return slices.ContainsFunc(m.logins, func(each Login) bool { return each.Address == address })
}

func (m model) loginKeys() []action {
	switch m.login.step {
	case addressStep:
		return []action{
			{keys: []string{"enter"}, label: "log in", do: model.startLogin},
			{keys: []string{"esc"}, label: "cancel", do: model.endLogin},
		}
	case approvingStep:
		return []action{
			{keys: []string{"o"}, label: "open the page", do: model.openLoginPage},
			{keys: []string{"esc"}, label: "stop", do: model.endLogin},
		}
	default:
		return []action{{keys: []string{"esc"}, label: "cancel", do: model.endLogin}}
	}
}

func (m model) loginBody() []string {
	s := m.style
	lines := []string{"", gutter + s.lit.Render("Log in to Spotlight"), ""}
	switch m.login.step {
	case addressStep:
		lines = append(lines, gutter+m.label("address")+m.login.input.View())
		if m.login.note != "" {
			lines = append(lines, "")
			lines = append(lines, m.wrapped(s.mark(console.Failed)+" ", s.text.Render, m.login.note)...)
		}
	case startingStep:
		lines = append(lines,
			gutter+m.label("address")+s.text.Render(m.login.input.Value()),
			"",
			gutter+m.spinner.View()+" "+s.dim.Render("Asking Spotlight for a login code"),
		)
	case approvingStep:
		approval := m.login.approval
		waiting := "Open the page and approve the login. Spotlight waits for it."
		if m.login.opened {
			waiting = "The page is open in your browser. Approve the login there."
		}
		lines = append(lines, gutter+m.label("address")+s.text.Render(shownAddress(approval.Address)))
		lines = append(lines, m.wrappedAt(m.label("page"), s.text.Render, approval.Page)...)
		lines = append(lines,
			gutter+m.label("code")+s.lit.Render(approval.Code)+s.dim.Render("   check that the page shows this code"),
			"",
			gutter+m.spinner.View()+" "+s.text.Render(waiting),
		)
	}
	return lines
}

func (m model) wrapped(lead string, render func(...string) string, text string) []string {
	return m.wrappedAt(strings.Repeat(" ", labelColumn)+lead, render, text)
}

func (m model) wrappedAt(lead string, render func(...string) string, text string) []string {
	indent := strings.Repeat(" ", ansi.StringWidth(lead))
	room := max(m.width-len(gutter)*2-ansi.StringWidth(lead), 20)
	var lines []string
	for i, line := range strings.Split(ansi.Wrap(text, room, " /"), "\n") {
		first := indent
		if i == 0 {
			first = lead
		}
		lines = append(lines, gutter+first+render(line))
	}
	return lines
}
