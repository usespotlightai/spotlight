package dashboard

import (
	"context"
	"crypto/rand"
	"errors"
	"fmt"
	"slices"
	"strconv"
	"strings"

	"charm.land/bubbles/v2/textinput"
	tea "charm.land/bubbletea/v2"

	"usespotlight.ai/data-plane/console"
	"usespotlight.ai/data-plane/host/internal/harnesses"
)

const defaultCapacity = "5"

type setupStep int

const (
	loadingStep setupStep = iota
	workspaceStep
	harnessStep
	keyKindStep
	keyValueStep
	nameStep
	capacityStep
	confirmStep
	workingStep
)

type keyNeed struct {
	harness harnesses.Harness
	choice  int
	value   string
	saved   bool
}

func (k keyNeed) name() string {
	return k.harness.Keys[k.choice]
}

type setupView struct {
	step       setupStep
	address    string
	workspaces []Workspace
	workspace  int
	held       []string
	picked     []bool
	cursor     int
	needs      []keyNeed
	at         int
	input      textinput.Model
	name       string
	capacity   string
	note       string
	attempt    int
	ctx        context.Context
	cancel     context.CancelFunc
	poolToken  string
	poolKey    string
	poolMade   bool
	image      string
	doing      string
	building   string
	progress   chan string
}

type (
	setupLoadedMsg struct {
		attempt    int
		workspaces []Workspace
		held       []string
		err        error
	}
	setupHeldMsg struct {
		attempt int
		held    []string
		err     error
	}
	setupStepMsg struct {
		attempt int
		key     string
		pool    bool
		image   string
		err     error
	}
	buildLineMsg struct {
		attempt int
		line    string
	}
)

func newSetupView() setupView {
	return setupView{input: newInput(""), cancel: func() {}}
}

func setupCommand() string {
	return shownCommand(hosting("init"))
}

func (m model) setUpHost() (tea.Model, tea.Cmd) {
	if m.setup == nil || m.account == nil {
		return m.attach(hosting("init")...)
	}
	if m.running != "" {
		return m, nil
	}
	address := m.account.SuggestedAddress()
	switch {
	case address == "" && len(m.logins.all) > 1:
		return m.openPaletteWith("set up a host for ")
	case address == "" || !m.loggedIn(address):
		return m.logInThen(model.setUpHostFor)
	}
	return m.setUpHostFor(address)
}

func (m model) setUpHostAt(address string) (tea.Model, tea.Cmd) {
	switch {
	case address == "":
		return m.setUpHost()
	case m.setup == nil || m.account == nil:
		return m, nil
	case m.loggedIn(address):
		return m.setUpHostFor(address)
	}
	next, cmd := m.logInThen(model.setUpHostFor)
	at := next.(model)
	at.login.input.SetValue(shownAddress(address))
	at.login.input.CursorEnd()
	return at, cmd
}

func (m model) setUpHostFor(address string) (tea.Model, tea.Cmd) {
	if m.running != "" || m.setup == nil {
		return m, nil
	}
	m.setupView.cancel()
	ctx, cancel := context.WithCancel(context.Background())
	m.setupView = setupView{
		step: loadingStep, address: address, input: m.setupView.input, ctx: ctx, cancel: cancel,
		attempt: m.setupView.attempt + 1, picked: make([]bool, len(harnesses.All())),
		name: m.setup.SuggestedName(), capacity: defaultCapacity,
	}
	m.setupView.newPool()
	m.question, m.mode = nil, settingUp
	setup, attempt := m.setup, m.setupView.attempt
	return m, tea.Batch(m.spin(), func() tea.Msg {
		workspaces, err := setup.Workspaces(ctx, address)
		if err != nil || len(workspaces) != 1 {
			return setupLoadedMsg{attempt: attempt, workspaces: workspaces, err: err}
		}
		held, err := setup.HeldKeys(ctx, address, workspaces[0].ID)
		return setupLoadedMsg{attempt: attempt, workspaces: workspaces, held: held, err: err}
	})
}

func (m model) setupLoaded(msg setupLoadedMsg) (tea.Model, tea.Cmd) {
	if msg.attempt != m.setupView.attempt || m.mode != settingUp {
		return m, nil
	}
	v := &m.setupView
	switch {
	case msg.err != nil:
		v.note = sentence(msg.err.Error())
		return m, nil
	case len(msg.workspaces) == 0:
		v.note = "Your login belongs to no workspace. Make one in Spotlight first."
		return m, nil
	}
	v.workspaces, v.held = msg.workspaces, msg.held
	if len(msg.workspaces) == 1 {
		v.step = harnessStep
		return m, nil
	}
	v.step = workspaceStep
	return m, nil
}

func (m model) pickWorkspace() (tea.Model, tea.Cmd) {
	v := &m.setupView
	v.workspace, v.step, v.note = v.cursor, loadingStep, ""
	setup, ctx, attempt, address, workspace := m.setup, v.ctx, v.attempt, v.address, v.workspaces[v.cursor].ID
	return m, tea.Batch(m.spin(), func() tea.Msg {
		held, err := setup.HeldKeys(ctx, address, workspace)
		return setupHeldMsg{attempt: attempt, held: held, err: err}
	})
}

func (m model) setupHeld(msg setupHeldMsg) (tea.Model, tea.Cmd) {
	if msg.attempt != m.setupView.attempt || m.mode != settingUp || m.setupView.step != loadingStep {
		return m, nil
	}
	v := &m.setupView
	if msg.err != nil {
		v.step, v.note = workspaceStep, sentence(msg.err.Error())
		return m, nil
	}
	v.held, v.step, v.cursor = msg.held, harnessStep, 0
	return m, nil
}

func (m model) moveCursor(by int) func(model) (tea.Model, tea.Cmd) {
	return func(m model) (tea.Model, tea.Cmd) {
		m.setupView.cursor = min(max(m.setupView.cursor+by, 0), m.setupChoices()-1)
		return m, nil
	}
}

func (m model) setupChoices() int {
	v := m.setupView
	switch v.step {
	case workspaceStep:
		return len(v.workspaces)
	case harnessStep:
		return len(v.picked)
	case keyKindStep:
		return len(v.needs[v.at].harness.Keys)
	}
	return 0
}

func (m model) togglePick() (tea.Model, tea.Cmd) {
	m.setupView.picked = slices.Clone(m.setupView.picked)
	m.setupView.picked[m.setupView.cursor] = !m.setupView.picked[m.setupView.cursor]
	return m, nil
}

func (v setupView) pickedHarnesses() []harnesses.Harness {
	var picked []harnesses.Harness
	for i, each := range harnesses.All() {
		if v.picked[i] {
			picked = append(picked, each)
		}
	}
	return picked
}

func (m model) pickHarnesses() (tea.Model, tea.Cmd) {
	v := &m.setupView
	if len(v.pickedHarnesses()) == 0 {
		v.note = "Pick at least one harness with space."
		return m, nil
	}
	v.note = ""
	var needs []keyNeed
	for _, each := range v.pickedHarnesses() {
		at := slices.IndexFunc(v.needs, func(need keyNeed) bool { return need.harness.ID == each.ID })
		if at >= 0 {
			needs = append(needs, v.needs[at])
			continue
		}
		needs = append(needs, keyNeed{harness: each})
	}
	v.needs, v.at = needs, 0
	return m.askKey()
}

func (v setupView) keysBefore(at int) []string {
	names := slices.Clone(v.held)
	for i := range at {
		if !v.coveredBy(v.needs[i], names) {
			names = append(names, v.needs[i].name())
		}
	}
	return names
}

func (v setupView) coveredBy(need keyNeed, names []string) bool {
	return slices.ContainsFunc(need.harness.Keys, func(name string) bool { return slices.Contains(names, name) })
}

func (v setupView) covered(at int) bool {
	return v.coveredBy(v.needs[at], v.keysBefore(at))
}

func (v setupView) asked() []int {
	var asked []int
	for i := range v.needs {
		if !v.covered(i) {
			asked = append(asked, i)
		}
	}
	return asked
}

func (m model) askKey() (tea.Model, tea.Cmd) {
	v := &m.setupView
	for v.at < len(v.needs) && v.covered(v.at) {
		v.at++
	}
	if v.at >= len(v.needs) {
		return m.askText(nameStep, v.name, false)
	}
	if len(v.needs[v.at].harness.Keys) > 1 {
		v.step, v.cursor = keyKindStep, v.needs[v.at].choice
		return m, nil
	}
	return m.askText(keyValueStep, v.needs[v.at].value, true)
}

func (m model) pickKeyKind() (tea.Model, tea.Cmd) {
	v := &m.setupView
	v.needs = slices.Clone(v.needs)
	if v.needs[v.at].choice != v.cursor {
		v.needs[v.at].choice, v.needs[v.at].value, v.needs[v.at].saved = v.cursor, "", false
	}
	return m.askText(keyValueStep, v.needs[v.at].value, true)
}

func (m model) askText(step setupStep, value string, secret bool) (tea.Model, tea.Cmd) {
	v := &m.setupView
	v.step, v.note = step, ""
	v.input.SetValue(value)
	v.input.CursorEnd()
	v.input.EchoMode = textinput.EchoNormal
	if secret {
		v.input.EchoMode = textinput.EchoPassword
	}
	return m, v.input.Focus()
}

func (m model) enterText() (tea.Model, tea.Cmd) {
	v := &m.setupView
	value := strings.TrimSpace(v.input.Value())
	switch v.step {
	case keyValueStep:
		if value == "" {
			v.note = "Paste the key. Spotlight keeps it as a workspace secret."
			return m, nil
		}
		v.needs = slices.Clone(v.needs)
		v.needs[v.at].value, v.needs[v.at].saved = value, false
		v.at++
		return m.askKey()
	case nameStep:
		if !slug(value) {
			v.note = "Use lowercase words joined by dashes, as in my-laptop."
			return m, nil
		}
		if value != v.name {
			v.name = value
			v.newPool()
		}
		return m.askText(capacityStep, v.capacity, false)
	case capacityStep:
		if n, err := strconv.Atoi(value); err != nil || n < 1 {
			v.note = "Give a whole number of 1 or more."
			return m, nil
		}
		v.capacity = value
		v.input.Blur()
		v.step, v.note = confirmStep, ""
		return m, nil
	}
	return m, nil
}

func (v *setupView) newPool() {
	v.poolToken, v.poolKey, v.poolMade = rand.Text()+rand.Text(), rand.Text(), false
}

func slug(text string) bool {
	if text == "" || len(text) > 63 || strings.HasPrefix(text, "-") || strings.HasSuffix(text, "-") || strings.Contains(text, "--") {
		return false
	}
	return strings.IndexFunc(text, func(r rune) bool { return (r < 'a' || r > 'z') && (r < '0' || r > '9') && r != '-' }) < 0
}

func (m model) setupBack() (tea.Model, tea.Cmd) {
	v := &m.setupView
	v.note = ""
	switch v.step {
	case loadingStep:
		if len(v.workspaces) > 1 {
			v.step, v.cursor = workspaceStep, v.workspace
			return m, nil
		}
	case harnessStep:
		if len(v.workspaces) > 1 {
			v.step, v.cursor = workspaceStep, v.workspace
			return m, nil
		}
	case keyKindStep, keyValueStep:
		if v.step == keyValueStep && len(v.needs[v.at].harness.Keys) > 1 {
			v.input.Blur()
			v.step, v.cursor = keyKindStep, v.needs[v.at].choice
			return m, nil
		}
		return m.lastKeyBefore(v.at)
	case nameStep:
		return m.lastKeyBefore(len(v.needs))
	case capacityStep:
		return m.askText(nameStep, v.name, false)
	case confirmStep:
		return m.askText(capacityStep, v.capacity, false)
	}
	return m.endSetup()
}

func (m model) lastKeyBefore(at int) (tea.Model, tea.Cmd) {
	v := &m.setupView
	asked := v.asked()
	for i := len(asked) - 1; i >= 0; i-- {
		if asked[i] < at {
			v.at = asked[i]
			return m.askText(keyValueStep, v.needs[v.at].value, true)
		}
	}
	v.input.Blur()
	v.step, v.cursor = harnessStep, 0
	return m, nil
}

func (v setupView) firstStep() bool {
	return v.step == workspaceStep || v.step == harnessStep && len(v.workspaces) < 2 || v.step == loadingStep && len(v.workspaces) < 2
}

func (m model) endSetup() (tea.Model, tea.Cmd) {
	m.setupView.cancel()
	m.setupView.attempt++
	m.setupView.input.Blur()
	m.mode = browsing
	return m, nil
}

func (m model) startSetup() (tea.Model, tea.Cmd) {
	v := &m.setupView
	v.step, v.note = workingStep, ""
	return m.nextSetupStep()
}

func (m model) nextSetupStep() (tea.Model, tea.Cmd) {
	v := &m.setupView
	setup, ctx, attempt := m.setup, v.ctx, v.attempt
	address, workspace := v.address, v.workspaces[v.workspace].ID

	for _, at := range v.asked() {
		need := v.needs[at]
		if need.saved {
			continue
		}
		name, value := need.name(), need.value
		v.doing = "Saving " + name + " as a workspace secret"
		return m, tea.Batch(m.spin(), func() tea.Msg {
			return setupStepMsg{attempt: attempt, key: name, err: setup.SaveKey(ctx, address, workspace, name, value)}
		})
	}

	if !v.poolMade {
		name, token, key := v.name, v.poolToken, v.poolKey
		v.doing = "Making the pull pool " + name
		return m, tea.Batch(m.spin(), func() tea.Msg {
			return setupStepMsg{attempt: attempt, pool: true, err: setup.MakePool(ctx, address, workspace, name, token, key)}
		})
	}

	if v.image == "" {
		picked := v.pickedHarnesses()
		ids := make([]string, 0, len(picked))
		for _, each := range picked {
			ids = append(ids, each.ID)
		}
		v.doing, v.building = "Building the image with "+names(picked), ""
		v.progress = make(chan string, 64)
		progress := v.progress
		build := func() tea.Msg {
			defer close(progress)
			image, err := setup.Build(ctx, ids, func(line string) {
				select {
				case progress <- line:
				default:
				}
			})
			return setupStepMsg{attempt: attempt, image: image, err: err}
		}
		return m, tea.Batch(m.spin(), build, nextBuildLine(attempt, progress))
	}

	args := hosting("init", "--url", address, "--token-stdin", "--image", v.image, "--capacity", v.capacity, "--name", v.name, "--yes")
	token := v.poolToken
	m.setupView.cancel()
	m.setupView.input.Blur()
	m.mode = browsing
	return m.runShown(shownCommand(args), token, args...)
}

func nextBuildLine(attempt int, progress <-chan string) tea.Cmd {
	return func() tea.Msg {
		line, open := <-progress
		if !open {
			return nil
		}
		return buildLineMsg{attempt: attempt, line: line}
	}
}

func (m model) buildLine(msg buildLineMsg) (tea.Model, tea.Cmd) {
	if msg.attempt != m.setupView.attempt || m.setupView.image != "" || m.setupView.progress == nil {
		return m, nil
	}
	m.setupView.building = msg.line
	return m, nextBuildLine(msg.attempt, m.setupView.progress)
}

func (m model) setupStepDone(msg setupStepMsg) (tea.Model, tea.Cmd) {
	if msg.attempt != m.setupView.attempt || m.mode != settingUp {
		return m, nil
	}
	v := &m.setupView
	if errors.Is(msg.err, ErrPoolNameTaken) {
		next, cmd := m.askText(nameStep, v.name, false)
		taken := next.(model)
		taken.setupView.note = "A pool named " + v.name + " is in the workspace. Pick another name."
		return taken, cmd
	}
	if msg.err != nil {
		v.note = sentence(msg.err.Error())
		return m, nil
	}
	switch {
	case msg.key != "":
		v.needs = slices.Clone(v.needs)
		for _, at := range v.asked() {
			if v.needs[at].name() == msg.key {
				v.needs[at].saved, v.needs[at].value = true, ""
			}
		}
	case msg.pool:
		v.poolMade = true
	case msg.image != "":
		v.image, v.building = msg.image, ""
	}
	return m.nextSetupStep()
}

func (m model) retrySetup() (tea.Model, tea.Cmd) {
	m.setupView.note = ""
	return m.nextSetupStep()
}

func (m model) setupFailed() bool {
	return m.mode == settingUp && m.setupView.step == workingStep && m.setupView.note != ""
}

func (m model) waitingForSetup() bool {
	v := m.setupView
	return m.mode == settingUp && (v.step == loadingStep && v.note == "" || v.step == workingStep && v.note == "")
}

func names(picked []harnesses.Harness) string {
	shown := make([]string, 0, len(picked))
	for _, each := range picked {
		shown = append(shown, each.Name)
	}
	return strings.Join(shown, ", ")
}

func (m model) setupKeys() []action {
	v := m.setupView
	cancel := action{keys: []string{"esc"}, label: "back", do: model.setupBack}
	if v.firstStep() {
		cancel.label = "cancel"
	}
	move := []action{
		{keys: []string{"up", "k"}, keyLabel: "↑↓", label: "move", do: m.moveCursor(-1)},
		{keys: []string{"down", "j"}, do: m.moveCursor(1)},
	}
	switch v.step {
	case workspaceStep:
		return slices.Concat(move, []action{{keys: []string{"enter"}, label: "pick", do: model.pickWorkspace}, cancel})
	case harnessStep:
		return slices.Concat(move, []action{
			{keys: []string{"space"}, label: "pick", do: model.togglePick},
			{keys: []string{"enter"}, label: "next", do: model.pickHarnesses},
			cancel,
		})
	case keyKindStep:
		return slices.Concat(move, []action{{keys: []string{"enter"}, label: "pick", do: model.pickKeyKind}, cancel})
	case keyValueStep, nameStep, capacityStep:
		return []action{{keys: []string{"enter"}, label: "next", do: model.enterText}, cancel}
	case confirmStep:
		return []action{{keys: []string{"enter"}, label: "set up", do: model.startSetup}, cancel}
	case workingStep:
		if v.note != "" {
			return []action{{keys: []string{"r"}, label: "retry", do: model.retrySetup}, {keys: []string{"esc"}, label: "close", do: model.endSetup}}
		}
		return []action{{keys: []string{"esc"}, label: "stop", do: model.endSetup}}
	}
	return []action{{keys: []string{"esc"}, label: "cancel", do: model.endSetup}}
}

func (m model) setupBody() []string {
	s, v := m.style, m.setupView
	lines := []string{"", gutter + s.lit.Render("Set up this computer as a host"), ""}
	lines = append(lines, gutter+m.label("address")+s.text.Render(shownAddress(v.address)))
	if v.step > workspaceStep && len(v.workspaces) > 0 {
		lines = append(lines, gutter+m.label("workspace")+s.text.Render(v.workspaces[v.workspace].Name))
	}
	if v.step > harnessStep {
		lines = append(lines, gutter+m.label("harnesses")+s.text.Render(names(v.pickedHarnesses())))
		for _, i := range v.asked() {
			if need := v.needs[i]; i < v.at || v.step > keyValueStep {
				lines = append(lines, gutter+m.label("key")+s.text.Render(need.name())+s.dim.Render("  a workspace secret"))
			}
		}
		for _, name := range v.held {
			if slices.ContainsFunc(v.pickedHarnesses(), func(h harnesses.Harness) bool { return slices.Contains(h.Keys, name) }) {
				lines = append(lines, gutter+m.label("key")+s.text.Render(name)+s.dim.Render("  the workspace has it"))
			}
		}
	}
	if v.step > nameStep {
		lines = append(lines, gutter+m.label("pool")+s.text.Render(v.name))
	}
	if v.step > capacityStep {
		lines = append(lines, gutter+m.label("sandboxes")+s.text.Render(v.capacity+" at once"))
	}
	lines = append(lines, "")

	switch v.step {
	case loadingStep:
		if v.note == "" {
			lines = append(lines, gutter+m.spinner.View()+" "+s.dim.Render("Reading your workspaces"))
		}
	case workspaceStep:
		lines = append(lines, gutter+s.text.Render("Which workspace does this host serve?"))
		for i, each := range v.workspaces {
			lines = append(lines, m.choiceLine(i == v.cursor, "", each.Name, each.Slug))
		}
	case harnessStep:
		lines = append(lines, gutter+s.text.Render("Which agents run on this host? Space picks, Enter goes on."))
		for i, each := range harnesses.All() {
			box := "[ ]"
			if v.picked[i] {
				box = "[x]"
			}
			lines = append(lines, m.choiceLine(i == v.cursor, box+" ", each.Name, ""))
		}
	case keyKindStep:
		need := v.needs[v.at]
		lines = append(lines, gutter+s.text.Render(fmt.Sprintf("Which key does %s use?", need.harness.Name)))
		for i, name := range need.harness.Keys {
			key, _ := harnesses.KeyNamed(name)
			lines = append(lines, m.choiceLine(i == v.cursor, "", key.Label, name))
		}
	case keyValueStep:
		key, _ := harnesses.KeyNamed(v.needs[v.at].name())
		lines = append(lines, gutter+s.text.Render("Paste the "+key.Label+"."), "")
		lines = append(lines, gutter+m.label("key")+v.input.View())
		lines = append(lines, "", gutter+s.dim.Render("Spotlight keeps it as the workspace secret "+key.Name+". Runs never see it."))
	case nameStep:
		lines = append(lines, gutter+m.label("pool")+v.input.View())
		lines = append(lines, "", gutter+s.dim.Render("Spotlight makes a pull pool with this name for this host."))
	case capacityStep:
		lines = append(lines, gutter+m.label("sandboxes")+v.input.View())
		lines = append(lines, "", gutter+s.dim.Render("How many sandboxes this host runs at once."))
	case confirmStep:
		lines = append(lines, m.wrappedAt("", s.text.Render, "Enter saves the keys, makes the pool, builds the image and installs the host service.")...)
	case workingStep:
		if v.note == "" {
			lines = append(lines, gutter+m.spinner.View()+" "+s.text.Render(v.doing))
			if v.building != "" {
				lines = append(lines, m.wrapped("", s.dim.Render, v.building)...)
			}
		}
	}

	if v.note != "" {
		lines = append(lines, "")
		lines = append(lines, m.wrappedAt(s.mark(console.Failed)+" ", s.text.Render, v.note)...)
	}
	return lines
}

func (m model) choiceLine(at bool, lead, title, detail string) string {
	s := m.style
	line := gutter + "  " + lead + s.text.Render(title)
	if at {
		line = gutter + s.accent.Render("› ") + lead + s.lit.Render(title)
	}
	if detail != "" {
		line += "  " + s.dim.Render(detail)
	}
	return line
}
