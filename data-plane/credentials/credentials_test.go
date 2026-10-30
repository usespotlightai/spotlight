package credentials

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func envOf(values map[string]string) func(string) string {
	return func(name string) string { return values[name] }
}

func TestPathFollowsTheConfigDirThenXDGThenHome(t *testing.T) {
	for _, each := range []struct {
		env  map[string]string
		want string
	}{
		{map[string]string{DirVar: "/etc/spot", xdgVar: "/xdg", "HOME": "/home/p"}, "/etc/spot/credentials.json"},
		{map[string]string{xdgVar: "/xdg", "HOME": "/home/p"}, "/xdg/spotlight/credentials.json"},
		{map[string]string{"HOME": "/home/p"}, "/home/p/.config/spotlight/credentials.json"},
	} {
		got, err := Path(envOf(each.env))
		if err != nil || got != each.want {
			t.Errorf("Path(%v) = %q, %v, want %q", each.env, got, err, each.want)
		}
	}

	if _, err := Path(envOf(nil)); err == nil || !strings.Contains(err.Error(), DirVar) {
		t.Errorf("err = %v, want %s named", err, DirVar)
	}
}

func TestAddressKeepsTheSchemeAndHostOnly(t *testing.T) {
	for raw, want := range map[string]string{
		"https://app.usespotlight.ai":             "https://app.usespotlight.ai",
		"https://App.UseSpotlight.AI/":            "https://app.usespotlight.ai",
		"HTTPS://app.usespotlight.ai/inbox?x=1#y": "https://app.usespotlight.ai",
		"https://app.usespotlight.ai:443":         "https://app.usespotlight.ai",
		"https://spotlight.acme.com:8443/":        "https://spotlight.acme.com:8443",
		"http://localhost:3000/":                  "http://localhost:3000",
		"http://localhost:80":                     "http://localhost",
		"http://127.0.0.1:5173":                   "http://127.0.0.1:5173",
		"http://[::1]:5173":                       "http://[::1]:5173",
		"http://[::1]":                            "http://[::1]",
		"http://app.spotlight.localhost":          "http://app.spotlight.localhost",
		"http://spotlight.test:8080":              "http://spotlight.test:8080",
		"  https://app.usespotlight.ai  ":         "https://app.usespotlight.ai",
	} {
		got, err := Address(raw)
		if err != nil || got != want {
			t.Errorf("Address(%q) = %q, %v, want %q", raw, got, err, want)
		}
	}
}

func TestAddressRejectsPlainHTTPAndWhatIsNoURL(t *testing.T) {
	for _, raw := range []string{"http://app.usespotlight.ai", "http://10.0.0.4:3000", "app.usespotlight.ai", "ftp://app.usespotlight.ai", "https://", ""} {
		if got, err := Address(raw); err == nil {
			t.Errorf("Address(%q) = %q, want an error", raw, got)
		}
	}
}

func TestSaveMakesAPrivateFileAndDirectory(t *testing.T) {
	path := filepath.Join(t.TempDir(), "spotlight", "credentials.json")

	file, err := Load(path)
	if err != nil {
		t.Fatal(err)
	}
	if _, found := file.Login("https://app.usespotlight.ai"); found {
		t.Fatalf("a missing file has a login")
	}
	if err := file.Put("https://app.usespotlight.ai", Login{Token: "tok_1", User: "person@example.com"}); err != nil {
		t.Fatal(err)
	}
	if err := file.Save(); err != nil {
		t.Fatal(err)
	}

	for at, want := range map[string]os.FileMode{path: 0o600, filepath.Dir(path): 0o700} {
		info, err := os.Stat(at)
		if err != nil {
			t.Fatal(err)
		}
		if info.Mode().Perm() != want {
			t.Errorf("%s has mode %v, want %v", at, info.Mode().Perm(), want)
		}
	}

	leftovers, _ := filepath.Glob(filepath.Join(filepath.Dir(path), ".credentials-*"))
	if len(leftovers) > 0 {
		t.Errorf("temporary files stay: %v", leftovers)
	}

	var saved struct {
		Logins map[string]Login `json:"logins"`
	}
	raw, _ := os.ReadFile(path)
	if err := json.Unmarshal(raw, &saved); err != nil || saved.Logins["https://app.usespotlight.ai"] != (Login{Token: "tok_1", User: "person@example.com"}) {
		t.Fatalf("saved %s, %v", raw, err)
	}
}

func TestSaveKeepsWhatItDoesNotKnow(t *testing.T) {
	path := filepath.Join(t.TempDir(), "credentials.json")
	before := `{
  "version": 2,
  "logins": {
    "https://other.example.com": {"token": "tok_other", "user": "other@example.com", "expiresAt": "2026-11-01T00:00:00Z"},
    "https://app.usespotlight.ai": {"token": "tok_old", "user": "old@example.com", "workspace": "acme"}
  }
}`
	if err := os.WriteFile(path, []byte(before), 0o644); err != nil {
		t.Fatal(err)
	}

	file, err := Load(path)
	if err != nil {
		t.Fatal(err)
	}
	if err := file.Put("https://app.usespotlight.ai", Login{Token: "tok_new", User: "person@example.com"}); err != nil {
		t.Fatal(err)
	}
	if err := file.Save(); err != nil {
		t.Fatal(err)
	}

	var after map[string]any
	raw, _ := os.ReadFile(path)
	if err := json.Unmarshal(raw, &after); err != nil {
		t.Fatal(err)
	}
	logins := after["logins"].(map[string]any)
	other := logins["https://other.example.com"].(map[string]any)
	mine := logins["https://app.usespotlight.ai"].(map[string]any)

	if after["version"] != float64(2) || other["token"] != "tok_other" || other["expiresAt"] != "2026-11-01T00:00:00Z" {
		t.Errorf("lost what it does not know: %s", raw)
	}
	if mine["token"] != "tok_new" || mine["user"] != "person@example.com" || mine["workspace"] != "acme" {
		t.Errorf("the new login is %v", mine)
	}

	info, _ := os.Stat(path)
	if info.Mode().Perm() != 0o600 {
		t.Errorf("mode %v, want 0600", info.Mode().Perm())
	}
}

func TestRemoveKeepsTheOtherLogins(t *testing.T) {
	path := filepath.Join(t.TempDir(), "credentials.json")
	file, _ := Load(path)
	_ = file.Put("https://a.example.com", Login{Token: "tok_a"})
	_ = file.Put("https://b.example.com", Login{Token: "tok_b"})

	if !file.Remove("https://a.example.com") || file.Remove("https://a.example.com") {
		t.Fatalf("Remove said the wrong thing")
	}
	if err := file.Save(); err != nil {
		t.Fatal(err)
	}

	reloaded, err := Load(path)
	if err != nil {
		t.Fatal(err)
	}
	if _, found := reloaded.Login("https://a.example.com"); found {
		t.Errorf("the removed login stays")
	}
	if login, found := reloaded.Login("https://b.example.com"); !found || login.Token != "tok_b" {
		t.Errorf("the other login is %v, %v", login, found)
	}
}

func TestLoadRejectsAFileThatIsNotJSON(t *testing.T) {
	path := filepath.Join(t.TempDir(), "credentials.json")
	_ = os.WriteFile(path, []byte("token=abc"), 0o600)

	if _, err := Load(path); err == nil || !strings.Contains(err.Error(), path) {
		t.Fatalf("err = %v, want the path named", err)
	}
}

func TestStoredFindsTheLoginByTheNormalisedAddress(t *testing.T) {
	dir := t.TempDir()
	env := envOf(map[string]string{DirVar: dir})

	file, _ := Load(filepath.Join(dir, "credentials.json"))
	_ = file.Put("https://app.usespotlight.ai", Login{Token: "tok_1"})
	if err := file.Save(); err != nil {
		t.Fatal(err)
	}

	if got, err := Stored(env, "https://App.usespotlight.ai/api/"); err != nil || got != "tok_1" {
		t.Errorf("Stored = %q, %v", got, err)
	}
	if got, err := Stored(env, "https://other.example.com"); err != nil || got != "" {
		t.Errorf("Stored for another address = %q, %v", got, err)
	}
	if got, err := Stored(envOf(nil), "https://app.usespotlight.ai"); err != nil || got != "" {
		t.Errorf("Stored with no home = %q, %v", got, err)
	}
}

func TestChooseTakesTheFlagThenTheEnvironmentThenTheOneLogin(t *testing.T) {
	dir := t.TempDir()
	file, _ := Load(filepath.Join(dir, "credentials.json"))
	_ = file.Put("https://staging.example.com", Login{Token: "tok_1"})
	if err := file.Save(); err != nil {
		t.Fatal(err)
	}

	for _, each := range []struct {
		env   map[string]string
		given string
		want  string
	}{
		{map[string]string{DirVar: dir}, "", "https://staging.example.com"},
		{map[string]string{DirVar: dir, URLVar: "http://localhost:3000/"}, "", "http://localhost:3000"},
		{map[string]string{DirVar: dir, URLVar: "http://localhost:3000"}, "https://flag.example.com/", "https://flag.example.com"},
		{map[string]string{DirVar: t.TempDir()}, "", DefaultAddress},
		{nil, "", DefaultAddress},
	} {
		if got, err := Choose(envOf(each.env), each.given); err != nil || got != each.want {
			t.Errorf("Choose(%v, %q) = %q, %v, want %q", each.env, each.given, got, err, each.want)
		}
	}
}

func TestChooseNamesTheLoginsWhenThereAreSeveral(t *testing.T) {
	dir := t.TempDir()
	file, _ := Load(filepath.Join(dir, "credentials.json"))
	_ = file.Put("https://staging.example.com", Login{Token: "tok_1"})
	_ = file.Put("https://app.usespotlight.ai", Login{Token: "tok_2"})
	_ = file.Put("https://gone.example.com", Login{})
	if err := file.Save(); err != nil {
		t.Fatal(err)
	}

	_, err := Choose(envOf(map[string]string{DirVar: dir}), "")
	if err == nil || !strings.Contains(err.Error(), "https://app.usespotlight.ai, https://staging.example.com.") {
		t.Errorf("err = %v, want both logins named", err)
	}
}
