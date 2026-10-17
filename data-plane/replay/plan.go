package replay

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
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
	Address   string
	Key       string
	Block     map[string]any
	Line      map[string]any
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
		Actions      []string       `json:"actions"`
		Before       map[string]any `json:"before"`
		After        map[string]any `json:"after"`
		AfterUnknown any            `json:"after_unknown"`
	} `json:"change"`
}

type catalogChange struct {
	address  string
	kind     string
	teamID   string
	key      string
	stations []string
	anyTeam  bool
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
	var catalog []catalogChange
	for _, each := range shown.ResourceChanges {
		if each.Mode != "managed" || !fromSpotlight(each.ProviderName) {
			continue
		}

		switch each.Type {
		case lineType:
			lines = append(lines, each)
		case skillType, profileType, integrationType, hookType, secretType:
			if changed := catalogChangeOf(each); changed != nil {
				catalog = append(catalog, *changed)
			}
		}
	}

	var plan planned
	for _, each := range lines {
		plan.add(each, catalog)
	}

	return plan, nil
}

func catalogChangeOf(change resourceChange) *catalogChange {
	switch strings.Join(change.Change.Actions, ",") {
	case "no-op", "read", "":
		return nil
	}

	values := change.Change.Before
	if values == nil {
		values = change.Change.After
	}
	teamID, _ := values["team_id"].(string)
	changed := &catalogChange{address: change.Address, teamID: teamID}

	switch change.Type {
	case skillType:
		changed.kind = "skill"
		changed.key, _ = values["key"].(string)
	case profileType:
		changed.kind = "harness profile"
		changed.key, _ = values["key"].(string)
	case integrationType:
		changed.kind = "integration"
		changed.key, _ = values["source"].(string)
	case hookType:
		changed.kind = "hook"
		changed.key = "*"
		if stations, ok := objectAt(values["match"])["stations"].([]any); ok && len(stations) > 0 {
			for _, each := range stations {
				if key, ok := each.(string); ok {
					changed.stations = append(changed.stations, key)
				}
			}
		}
	case secretType:
		changed.kind = "secret"
		changed.anyTeam = true
	}

	return changed
}

func (c catalogChange) feeds(teamID, stationKey string, station map[string]any) bool {
	if c.anyTeam {
		return true
	}
	if c.teamID != "" && c.teamID != teamID {
		return false
	}
	if c.key == "" {
		return true
	}

	switch c.kind {
	case "skill":
		for _, each := range listAt(station["skills"]) {
			if each == c.key {
				return true
			}
		}
		return false
	case "integration":
		for _, each := range listAt(station["tools"]) {
			if tool, ok := each.(string); ok && strings.HasPrefix(tool, c.key+".") {
				return true
			}
		}
		return false
	case "hook":
		if len(c.stations) == 0 {
			return true
		}
		for _, each := range c.stations {
			if each == stationKey {
				return true
			}
		}
		return false
	default:
		return station["profile"] == c.key
	}
}

func (p *planned) add(change resourceChange, catalog []catalogChange) {
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
					Address:   stationAddress(address, change.Address, key),
					Key:       key,
					Undecided: true,
					Because:   fmt.Sprintf("not checked, since the plan removes %s and adds this station, which may be a station renamed; a renamed station starts with no live config to check it against", strings.Join(removed, ", ")),
				})
			}
			continue
		}

		changed, unknownParts := current.changedFrom(old.values)
		var feeding []string
		for _, each := range catalog {
			if each.feeds(teamID, key, old.values) || each.feeds(teamID, key, current.values) {
				feeding = append(feeding, fmt.Sprintf("%s %s", each.kind, each.address))
			}
		}

		lineChanged := repositoriesChanged || repositoriesUnknown
		if !changed && !lineChanged && len(unknownParts) == 0 && len(feeding) == 0 {
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
			Address:  stationAddress(address, change.Address, key),
			Key:      key,
			Block:    current.block(),
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
		case len(feeding) > 0:
			station.Undecided = true
			station.Because = fmt.Sprintf("not checked, since the plan also changes the %s its runs depend on, which a check cannot replay before apply", strings.Join(feeding, ", "))
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
			Address:   stationAddress(address, change.Address, key),
			Key:       key,
			Undecided: true,
			Because:   "not checked, since the plan replaces its line, so it starts with no live config to check it against",
		})
	}
}

func (p *planned) note(format string, args ...any) {
	p.Notes = append(p.Notes, fmt.Sprintf(format, args...))
}

func stationAddress(lineAddress, resource, key string) string {
	if lineAddress != "" {
		return lineAddress + "/" + key
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
		for _, name := range []string{"rubric", "sample", "trust"} {
			if value := judge[name]; value != nil {
				written[name] = value
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
