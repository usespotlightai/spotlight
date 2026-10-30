package ssh

import (
	"strings"
	"testing"
)

func TestSettingAKeyKeepsTheRestOfTheFile(t *testing.T) {
	for name, each := range map[string]struct{ before, after string }{
		"empty file":            {"", "{\n\t\"k\": 600\n}\n"},
		"blank file":            {"  \n", "{\n\t\"k\": 600\n}\n"},
		"empty object":          {"{}\n", "{\n\t\"k\": 600\n}\n"},
		"empty object on lines": {"{\n}\n", "{\n\t\"k\": 600\n}\n"},
		"comments and a trailing comma": {
			"// top\n{\n    \"a\": 1, // one\n    /* b */ \"b\": [1, {\"c\": \"}\"}],\n}\n",
			"// top\n{\n    \"a\": 1, // one\n    /* b */ \"b\": [1, {\"c\": \"}\"}],\n    \"k\": 600\n}\n",
		},
		"no trailing comma and a line comment": {
			"{\n  \"a\": \"x // y\" // note\n}",
			"{\n  \"a\": \"x // y\", // note\n  \"k\": 600\n}",
		},
		"one line": {"{\"a\": true}", "{\"a\": true,\n\t\"k\": 600\n}"},
		"existing value": {
			"{\n\t\"k\": 15, // short\n\t\"z\": null\n}\n",
			"{\n\t\"k\": 600, // short\n\t\"z\": null\n}\n",
		},
		"existing string value": {"{\"k\": \"15\"}", "{\"k\": 600}"},
		"byte order mark":       {"\ufeff{\n  \"a\": 1\n}\n", "\ufeff{\n  \"a\": 1,\n  \"k\": 600\n}\n"},
	} {
		settings, err := parseObject(each.before)
		if err != nil {
			t.Errorf("%s: %v", name, err)
			continue
		}
		got := settings.set("k", "600")
		if got != each.after {
			t.Errorf("%s:\n%q\nwant\n%q", name, got, each.after)
		}

		again, err := parseObject(got)
		if err != nil {
			t.Errorf("%s: the result does not parse: %v", name, err)
			continue
		}
		if found, ok := again.find("k"); !ok || found.value != "600" {
			t.Errorf("%s: k = %+v, %v", name, found, ok)
		}
		if twice := again.set("k", "600"); twice != got {
			t.Errorf("%s: setting it again changed\n%q\nto\n%q", name, got, twice)
		}
	}
}

func TestParsingRejectsWhatIsNotAnObject(t *testing.T) {
	for _, text := range []string{"[]", "{\"a\": 1", "{\"a\" 1}", "{\"a\": 1} x", "{/* open", "{\"a\": \"b\n\"}"} {
		if _, err := parseObject(text); err == nil {
			t.Errorf("parseObject(%q) gave no error", text)
		}
	}
}

func TestFindTakesTheLastOfARepeatedKey(t *testing.T) {
	settings, err := parseObject(`{"k": 1, "k": 700}`)
	if err != nil {
		t.Fatal(err)
	}
	if found, _ := settings.find("k"); found.value != "700" {
		t.Errorf("k = %q", found.value)
	}
	if got := settings.set("k", "600"); !strings.Contains(got, `"k": 600, "k": 600`) {
		t.Errorf("set = %q", got)
	}
}
