package agent

import (
	"bytes"
	"encoding/json"
	"fmt"
	"slices"

	"usespotlight.ai/data-plane/protocol"
)

func configChanges(was, now protocol.StationConfig) []string {
	var changes []string
	changed := func(format string, args ...any) {
		changes = append(changes, fmt.Sprintf(format, args...))
	}

	if was.Harness != now.Harness {
		changed("harness %s → %s", was.Harness, now.Harness)
	}
	for _, field := range []struct {
		name     string
		was, now *string
	}{
		{"model", was.Model, now.Model},
		{"effort", was.Effort, now.Effort},
		{"image", was.Image, now.Image},
	} {
		if shown(field.was) != shown(field.now) {
			changed("%s %s → %s", field.name, shown(field.was), shown(field.now))
		}
	}

	switch {
	case was.Prompt == nil && now.Prompt != nil:
		changed("prompt added")
	case was.Prompt != nil && now.Prompt == nil:
		changed("prompt removed")
	case was.Prompt != nil && *was.Prompt != *now.Prompt:
		changed("prompt changed")
	}

	switch {
	case was.Profile == nil && now.Profile != nil:
		changed("profile %s added", now.Profile.Key)
	case was.Profile != nil && now.Profile == nil:
		changed("profile %s removed", was.Profile.Key)
	case was.Profile != nil && was.Profile.Key != now.Profile.Key:
		changed("profile %s → %s", was.Profile.Key, now.Profile.Key)
	case was.Profile != nil && !sameJSON(was.Profile.Settings, now.Profile.Settings):
		changed("profile %s settings changed", now.Profile.Key)
	}

	wasSetup := map[string]*string{}
	for _, repository := range was.Repositories {
		wasSetup[repository.Name] = repository.Setup
	}
	nowSetup := map[string]*string{}
	for _, repository := range now.Repositories {
		nowSetup[repository.Name] = repository.Setup
		setup, existed := wasSetup[repository.Name]
		switch {
		case !existed:
			changed("repository %s added", repository.Name)
		case shown(setup) != shown(repository.Setup):
			changed("repository %s setup changed", repository.Name)
		}
	}
	for _, repository := range was.Repositories {
		if _, present := nowSetup[repository.Name]; !present {
			changed("repository %s removed", repository.Name)
		}
	}

	wasHash := map[string]string{}
	for _, skill := range was.Skills {
		wasHash[skill.Key] = skill.Hash
	}
	nowHash := map[string]string{}
	for _, skill := range now.Skills {
		nowHash[skill.Key] = skill.Hash
		hash, existed := wasHash[skill.Key]
		switch {
		case !existed:
			changed("skill %s added", skill.Key)
		case hash != skill.Hash:
			changed("skill %s changed (%s → %s)", skill.Key, short(hash), short(skill.Hash))
		}
	}
	for _, skill := range was.Skills {
		if _, present := nowHash[skill.Key]; !present {
			changed("skill %s removed", skill.Key)
		}
	}

	for _, tool := range now.Tools {
		if !slices.Contains(was.Tools, tool) {
			changed("tool %s added", tool)
		}
	}
	for _, tool := range was.Tools {
		if !slices.Contains(now.Tools, tool) {
			changed("tool %s removed", tool)
		}
	}

	if was.Decisions != now.Decisions {
		changed("decisions %s → %s", onOff(was.Decisions), onOff(now.Decisions))
	}
	if was.Memories != now.Memories {
		changed("memories %s → %s", onOff(was.Memories), onOff(now.Memories))
	}

	switch {
	case was.Judge == nil && now.Judge != nil:
		changed("judge added")
	case was.Judge != nil && now.Judge == nil:
		changed("judge removed")
	case was.Judge != nil:
		if was.Judge.RubricHash != now.Judge.RubricHash {
			changed("judge rubric changed")
		}
		if was.Judge.Sample != now.Judge.Sample {
			changed("judge sample %s → %s", number(was.Judge.Sample), number(now.Judge.Sample))
		}
		if was.Judge.MinAgreement != now.Judge.MinAgreement {
			changed("judge min agreement %s → %s", number(was.Judge.MinAgreement), number(now.Judge.MinAgreement))
		}
	}

	return changes
}

func shown(text *string) string {
	if text == nil {
		return "none"
	}

	return *text
}

func onOff(on bool) string {
	if on {
		return "on"
	}

	return "off"
}

func short(fingerprint string) string {
	if len(fingerprint) > 12 {
		return fingerprint[:12]
	}

	return fingerprint
}

func sameJSON(a, b json.RawMessage) bool {
	var was, now any
	if json.Unmarshal(a, &was) != nil || json.Unmarshal(b, &now) != nil {
		return bytes.Equal(bytes.TrimSpace(a), bytes.TrimSpace(b))
	}

	wasCanonical, _ := json.Marshal(was)
	nowCanonical, _ := json.Marshal(now)

	return bytes.Equal(wasCanonical, nowCanonical)
}
