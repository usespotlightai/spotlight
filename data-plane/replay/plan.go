package replay

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"slices"
	"sort"
	"strings"
)

const (
	lineType        = "spotlight_line"
	skillType       = "spotlight_skill"
	profileType     = "spotlight_harness_profile"
	integrationType = "spotlight_integration"
	hookType        = "spotlight_hook"
	secretType      = "spotlight_secret"
	lineProvider    = "usespotlightai/spotlight"
	showCommand     = "terraform show -json <planfile>"
	planOutCommand  = "terraform plan -out=<planfile>"
	workKind        = "work"
)

var errStreamingLog = errors.New("this is the log `terraform plan -json` streams, which contains no station blocks; save the plan with `" + planOutCommand + "`, then pass this the output of `" + showCommand + "`")

type plannedStation struct {
	Resource  string
	LineID    string
	TeamID    string
	Path      string
	Key       string
	Block     map[string]any
	Line      map[string]any
	Changed   plannedChanges
	Undecided bool
	Because   string
}

type planned struct {
	Stations []plannedStation
	Notes    []string
}

type planShown struct {
	FormatVersion   string           `json:"format_version"`
	ResourceChanges []resourceChange `json:"resource_changes"`
}

type resourceChange struct {
	Address      string `json:"address"`
	Mode         string `json:"mode"`
	Type         string `json:"type"`
	ProviderName string `json:"provider_name"`
	Change       struct {
		Actions        []string       `json:"actions"`
		Before         map[string]any `json:"before"`
		After          map[string]any `json:"after"`
		AfterUnknown   any            `json:"after_unknown"`
		AfterSensitive any            `json:"after_sensitive"`
	} `json:"change"`
}

type catalogChange struct {
	address      string
	kind         string
	teamID       string
	keys         []string
	hooks        []plannedHook
	integrations []plannedIntegration
	withheld     string
}

const maxDefinitionBytes = 16 << 10

type plannedIntegration struct {
	Key        string         `json:"key"`
	Definition map[string]any `json:"definition"`
}

type plannedHook struct {
	Key      string   `json:"key"`
	Lines    []string `json:"lines"`
	Stations []string `json:"stations"`
}

type plannedChanges struct {
	Secrets         []string             `json:"secrets,omitempty"`
	Skills          []string             `json:"skills,omitempty"`
	HarnessProfiles []string             `json:"harnessProfiles,omitempty"`
	Integrations    []plannedIntegration `json:"integrations,omitempty"`
	Hooks           []plannedHook        `json:"hooks,omitempty"`
}

var derivedAttributes = map[string]bool{"color": true, "diffs": true, "decisions": true, "memories": true}

var defaultedOff = map[string]bool{"decisions": true, "memories": true}

var textAttributes = []string{"key", "name", "kind", "color", "description", "harness", "model", "effort", "profile", "prompt", "check"}

var flagAttributes = []string{"diffs", "decisions", "memories"}

var listAttributes = []struct{ stored, sent string }{
	{"tools", "tools"},
	{"skills", "skills"},
	{"runners", "runners"},
	{"passes_to", "passesTo"},
}

var alertAttributes = []struct{ stored, sent string }{
	{"measure", "measure"},
	{"rises_by", "risesBy"},
	{"above", "above"},
	{"falls_by", "fallsBy"},
	{"below", "below"},
	{"over", "over"},
}

var repositoryAttributes = []string{"name", "image", "setup"}

func fromSpotlight(provider string) bool {
	return provider == lineProvider || strings.HasSuffix(provider, "/"+lineProvider)
}

func readPlan(in io.Reader) (planned, error) {
	read, err := io.ReadAll(in)
	if err != nil {
		return planned{}, fmt.Errorf("read the plan: %w", err)
	}

	decoder := json.NewDecoder(bytes.NewReader(read))
	decoder.UseNumber()

	var first map[string]any
	if err := decoder.Decode(&first); err != nil {
		return planned{}, fmt.Errorf("the plan is not JSON; pass this the output of `%s`", showCommand)
	}

	_, logged := first["@level"]
	if logged || decoder.More() {
		return planned{}, errStreamingLog
	}

	var shown planShown
	strict := json.NewDecoder(bytes.NewReader(read))
	strict.UseNumber()
	if err := strict.Decode(&shown); err != nil || shown.FormatVersion == "" {
		return planned{}, fmt.Errorf("this is not a saved plan shown as JSON; pass this the output of `%s`", showCommand)
	}

	var lines []resourceChange
	var unnamed, withheld []catalogChange
	var secrets []string
	teams := map[string]*plannedChanges{}
	for _, each := range shown.ResourceChanges {
		if each.Mode != "managed" || !fromSpotlight(each.ProviderName) {
			continue
		}

		if each.Type == lineType {
			lines = append(lines, each)
			continue
		}
		changed := catalogChangeOf(each)
		switch {
		case changed == nil:
		case len(changed.keys) == 0 || changed.kind != "secret" && changed.teamID == "":
			unnamed = append(unnamed, *changed)
		case changed.withheld != "":
			withheld = append(withheld, *changed)
		case changed.kind == "secret":
			secrets = append(secrets, changed.keys...)
		default:
			if teams[changed.teamID] == nil {
				teams[changed.teamID] = &plannedChanges{}
			}
			teams[changed.teamID].add(*changed)
		}
	}

	var plan planned
	for _, each := range lines {
		teamID, _ := each.Change.Before["team_id"].(string)
		changes := plannedChanges{Secrets: secrets}
		if team := teams[teamID]; team != nil {
			changes.Skills, changes.HarnessProfiles, changes.Integrations, changes.Hooks = team.Skills, team.HarnessProfiles, team.Integrations, team.Hooks
		}
		plan.add(each, unnamed, withheld, changes.sorted())
	}

	return plan, nil
}

var keyAttributes = map[string]struct{ kind, key string }{
	skillType:       {"skill", "key"},
	profileType:     {"harness profile", "key"},
	integrationType: {"integration", "integration"},
	hookType:        {"hook", "key"},
	secretType:      {"secret", "name"},
}

func catalogChangeOf(change resourceChange) *catalogChange {
	switch strings.Join(change.Change.Actions, ",") {
	case "no-op", "read", "":
		return nil
	}
	named, ok := keyAttributes[change.Type]
	if !ok {
		return nil
	}

	values := change.Change.Before
	if values == nil {
		values = change.Change.After
	}
	teamID, _ := values["team_id"].(string)
	changed := &catalogChange{address: change.Address, kind: named.kind, teamID: teamID}
	unknown := objectAt(change.Change.AfterUnknown)
	partUnknown := change.Type == hookType && isUnknown(unknown["match"]) || change.Type == integrationType && isUnknown(unknown["definition"])

	for _, side := range []map[string]any{change.Change.After, change.Change.Before} {
		key, _ := side[named.key].(string)
		if key == "" || slices.Contains(changed.keys, key) {
			continue
		}
		changed.keys = append(changed.keys, key)
		switch change.Type {
		case hookType:
			match := objectAt(side["match"])
			changed.hooks = append(changed.hooks, plannedHook{Key: key, Lines: textsAt(match["lines"]), Stations: textsAt(match["stations"])})
		case integrationType:
			var definition map[string]any
			if after, _ := change.Change.After[named.key].(string); after == key {
				definition, _ = change.Change.After["definition"].(map[string]any)
				changed.withheld = withheldReason(definition, objectAt(change.Change.AfterSensitive)["definition"])
			}
			changed.integrations = append(changed.integrations, plannedIntegration{Key: key, Definition: definition})
		}
	}
	if isUnknown(unknown[named.key]) || partUnknown {
		changed.keys = nil
	}

	return changed
}

func withheldReason(definition map[string]any, sensitive any) string {
	if isUnknown(sensitive) {
		return "holds sensitive values"
	}
	var encoded bytes.Buffer
	encoder := json.NewEncoder(&encoded)
	encoder.SetEscapeHTML(false)
	if err := encoder.Encode(definition); err != nil || len(bytes.TrimSuffix(encoded.Bytes(), []byte("\n"))) > maxDefinitionBytes {
		return fmt.Sprintf("is larger than %d KiB", maxDefinitionBytes>>10)
	}

	return ""
}

func textsAt(node any) []string {
	texts := []string{}
	for _, each := range listAt(node) {
		if text, ok := each.(string); ok {
			texts = append(texts, text)
		}
	}

	return texts
}

func (c catalogChange) reaches(teamID string) bool {
	return c.teamID == "" || c.teamID == teamID
}

func (c *plannedChanges) add(changed catalogChange) {
	switch changed.kind {
	case "skill":
		c.Skills = append(c.Skills, changed.keys...)
	case "harness profile":
		c.HarnessProfiles = append(c.HarnessProfiles, changed.keys...)
	case "integration":
		c.Integrations = append(c.Integrations, changed.integrations...)
	case "hook":
		c.Hooks = append(c.Hooks, changed.hooks...)
	}
}

func (c plannedChanges) sorted() plannedChanges {
	for _, keys := range []*[]string{&c.Secrets, &c.Skills, &c.HarnessProfiles} {
		*keys = slices.Compact(slices.Sorted(slices.Values(*keys)))
	}
	c.Integrations = slices.Clone(c.Integrations)
	slices.SortFunc(c.Integrations, func(one, other plannedIntegration) int { return strings.Compare(one.Key, other.Key) })
	c.Hooks = slices.Clone(c.Hooks)
	slices.SortFunc(c.Hooks, func(one, other plannedHook) int { return strings.Compare(one.Key, other.Key) })

	return c
}

func (c plannedChanges) empty() bool {
	return len(c.Secrets)+len(c.Skills)+len(c.HarnessProfiles)+len(c.Integrations)+len(c.Hooks) == 0
}

func (p *planned) add(change resourceChange, unnamed, withheld []catalogChange, changes plannedChanges) {
	actions := strings.Join(change.Change.Actions, ",")

	switch actions {
	case "update", "no-op":
	case "create":
		p.note("%s is a new line, with no live stations to check a change against", change.Address)
		return
	case "delete,create", "create,delete":
		p.replaced(change)
		return
	case "delete":
		p.note("%s is removed, so there is nothing of it to check", change.Address)
		return
	default:
		return
	}

	before, after := change.Change.Before, change.Change.After
	lineID, _ := before["id"].(string)
	teamID, _ := before["team_id"].(string)
	address, _ := before["address"].(string)
	unknown := objectAt(change.Change.AfterUnknown)

	if whole, ok := unknown["station"].(bool); ok && whole {
		p.note("%s has stations known only after apply, so none is checked", change.Address)
		return
	}

	was := stationsByKey(before["station"], nil)
	now := stationsByKey(after["station"], listAt(unknown["station"]))
	repositoriesUnknown := isUnknown(unknown["repository"])
	repositoriesChanged := !repositoriesUnknown && !sameValue(repositoriesOf(before["repository"]), repositoriesOf(after["repository"]))

	var removed []string
	if actions == "update" {
		for _, key := range sortedKeys(was) {
			if _, present := now[key]; !present {
				p.note("%s removes station %s, which leaves nothing to replay", change.Address, key)
				if kind, _ := was[key].values["kind"].(string); kind == workKind {
					removed = append(removed, key)
				}
			}
		}
	}

	for _, key := range sortedKeys(now) {
		current := now[key]
		if current.unknownKey {
			p.note("%s has a station whose key is known only after apply, so it is not checked", change.Address)
			continue
		}

		old, existed := was[key]
		if !existed {
			p.note("%s adds station %s, with no live config to check it against", change.Address, key)
			if kind, _ := current.values["kind"].(string); kind == workKind && len(removed) > 0 {
				p.Stations = append(p.Stations, plannedStation{
					Resource:  change.Address,
					TeamID:    teamID,
					Path:      stationPath(address, change.Address, key),
					Key:       key,
					Undecided: true,
					Because:   fmt.Sprintf("not checked, since the plan removes %s and adds this station, which may be a station renamed; a renamed station starts with no live config to check it against", strings.Join(removed, ", ")),
				})
			}
			continue
		}

		changed, unknownParts := current.changedFrom(old.values)
		var unknownChanges []string
		for _, each := range unnamed {
			if entry := fmt.Sprintf("%s %s", each.kind, each.address); each.reaches(teamID) && !slices.Contains(unknownChanges, entry) {
				unknownChanges = append(unknownChanges, entry)
			}
		}
		var withheldChanges []string
		for _, each := range withheld {
			if each.reaches(teamID) {
				withheldChanges = append(withheldChanges, fmt.Sprintf("%s %s, which the CLI does not send to Spotlight since its planned definition %s", each.kind, each.address, each.withheld))
			}
		}

		lineChanged := repositoriesChanged || repositoriesUnknown
		if !changed && !lineChanged && len(unknownParts) == 0 && len(unknownChanges) == 0 && len(withheldChanges) == 0 && changes.empty() {
			continue
		}

		if kind, _ := current.values["kind"].(string); kind != workKind {
			if changed {
				p.note("%s changes station %s, where nothing runs, so there is nothing to replay", change.Address, key)
			}
			continue
		}

		station := plannedStation{
			Resource: change.Address,
			LineID:   lineID,
			TeamID:   teamID,
			Path:     stationPath(address, change.Address, key),
			Key:      key,
			Block:    current.block(),
			Changed:  changes,
		}

		switch {
		case repositoriesUnknown:
			unknownParts = append(unknownParts, "line's repositories")
		case repositoriesChanged:
			station.Line = map[string]any{"repositories": repositoriesOf(after["repository"])}
		}

		switch {
		case len(unknownParts) > 0:
			station.Undecided = true
			station.Because = fmt.Sprintf("not checked, since Terraform knows its %s only after apply", strings.Join(unknownParts, ", "))
		case len(unknownChanges) > 0:
			station.Undecided = true
			station.Because = fmt.Sprintf("not checked, since the plan also changes the %s, which Terraform names only after apply, so Spotlight cannot tell whether its runs depend on it", strings.Join(unknownChanges, ", "))
		case len(withheldChanges) > 0:
			station.Undecided = true
			station.Because = fmt.Sprintf("not checked, since the plan also changes the %s, so Spotlight cannot tell whether its runs depend on it", strings.Join(withheldChanges, "; "))
		}

		p.Stations = append(p.Stations, station)
	}
}

func (p *planned) replaced(change resourceChange) {
	p.note("%s is replaced, so its stations start anew, with no live config to check a change against", change.Address)

	address, _ := change.Change.Before["address"].(string)
	teamID, _ := change.Change.Before["team_id"].(string)
	for _, each := range listAt(change.Change.After["station"]) {
		station := objectAt(each)
		key, _ := station["key"].(string)
		if kind, _ := station["kind"].(string); key == "" || kind != workKind {
			continue
		}

		p.Stations = append(p.Stations, plannedStation{
			Resource:  change.Address,
			TeamID:    teamID,
			Path:      stationPath(address, change.Address, key),
			Key:       key,
			Undecided: true,
			Because:   "not checked, since the plan replaces its line, so it starts with no live config to check it against",
		})
	}
}

func (p *planned) note(format string, args ...any) {
	p.Notes = append(p.Notes, fmt.Sprintf(format, args...))
}

func stationPath(linePath, resource, key string) string {
	if linePath != "" {
		return linePath + "/" + key
	}

	return resource + "/" + key
}

func repositoriesOf(node any) []any {
	out := []any{}

	for _, each := range listAt(node) {
		repository := objectAt(each)
		written := map[string]any{}
		for _, name := range repositoryAttributes {
			if text, ok := repository[name].(string); ok {
				written[name] = text
			}
		}
		out = append(out, written)
	}

	sort.Slice(out, func(one, other int) bool {
		first, _ := out[one].(map[string]any)["name"].(string)
		second, _ := out[other].(map[string]any)["name"].(string)
		return first < second
	})

	return out
}

type stationState struct {
	values     map[string]any
	unknown    map[string]any
	unknownKey bool
}

func stationsByKey(node any, unknown []any) map[string]stationState {
	out := map[string]stationState{}

	for at, each := range listAt(node) {
		values := objectAt(each)
		var whatsUnknown map[string]any
		if at < len(unknown) {
			whatsUnknown = objectAt(unknown[at])
		}

		key, ok := values["key"].(string)
		if !ok || isUnknown(whatsUnknown["key"]) {
			out[fmt.Sprintf("\x00unknown-%d", at)] = stationState{unknownKey: true}
			continue
		}

		out[key] = stationState{values: values, unknown: whatsUnknown}
	}

	return out
}

func (s stationState) changedFrom(before map[string]any) (bool, []string) {
	var unknownParts []string
	changed := false

	for _, name := range sortedKeys(unionOf(s.values, before, s.unknown)) {
		if isUnknown(s.unknown[name]) {
			switch {
			case defaultedOff[name] && before[name] == true:
				changed = true
			case !derivedAttributes[name]:
				unknownParts = append(unknownParts, name)
			}
			continue
		}

		if !sameValue(s.values[name], before[name]) {
			changed = true
		}
	}

	return changed, unknownParts
}

func (s stationState) block() map[string]any {
	sent := map[string]any{}

	for _, name := range textAttributes {
		if text, ok := s.known(name).(string); ok {
			sent[name] = text
		}
	}

	for _, name := range flagAttributes {
		if flag, ok := s.known(name).(bool); ok {
			sent[name] = flag
		}
	}

	for _, each := range listAttributes {
		if list, ok := s.known(each.stored).([]any); ok {
			sent[each.sent] = list
		}
	}

	if flag, ok := s.known("ends").(bool); ok {
		sent["ends"] = flag
	}

	if judge, ok := s.known("judge").(map[string]any); ok {
		written := map[string]any{}
		for name, key := range map[string]string{"rubric": "rubric", "sample": "sample", "min_agreement": "minAgreement"} {
			if value := judge[name]; value != nil {
				written[key] = value
			}
		}
		sent["judge"] = written
	}

	alerts := []any{}
	for _, each := range listAt(s.known("alert")) {
		alert := objectAt(each)
		written := map[string]any{}
		for _, attribute := range alertAttributes {
			if value := alert[attribute.stored]; value != nil {
				written[attribute.sent] = value
			}
		}
		alerts = append(alerts, written)
	}
	sent["alerts"] = alerts

	return sent
}

func (s stationState) known(name string) any {
	if isUnknown(s.unknown[name]) {
		return nil
	}

	return s.values[name]
}

func isUnknown(node any) bool {
	switch value := node.(type) {
	case bool:
		return value
	case map[string]any:
		for _, each := range value {
			if isUnknown(each) {
				return true
			}
		}
	case []any:
		for _, each := range value {
			if isUnknown(each) {
				return true
			}
		}
	}

	return false
}

func sameValue(one, other any) bool {
	written, _ := json.Marshal(normalised(one))
	again, _ := json.Marshal(normalised(other))

	return bytes.Equal(written, again)
}

func normalised(node any) any {
	switch value := node.(type) {
	case []any:
		if len(value) == 0 {
			return nil
		}
		out := make([]any, len(value))
		for at, each := range value {
			out[at] = normalised(each)
		}
		return out
	case map[string]any:
		out := map[string]any{}
		for key, each := range value {
			if normal := normalised(each); normal != nil {
				out[key] = normal
			}
		}
		if len(out) == 0 {
			return nil
		}
		return out
	default:
		return value
	}
}

func objectAt(node any) map[string]any {
	object, _ := node.(map[string]any)
	if object == nil {
		return map[string]any{}
	}

	return object
}

func listAt(node any) []any {
	list, _ := node.([]any)

	return list
}

func unionOf(maps ...map[string]any) map[string]any {
	out := map[string]any{}
	for _, each := range maps {
		for key := range each {
			out[key] = true
		}
	}

	return out
}

func sortedKeys[T any](entries map[string]T) []string {
	keys := make([]string, 0, len(entries))
	for key := range entries {
		keys = append(keys, key)
	}
	sort.Slice(keys, func(one, other int) bool { return keys[one] < keys[other] })

	return keys
}
