package config_test

import (
	"errors"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"usespotlight.ai/data-plane/host/internal/config"
)

func TestAChangeKeepsTheCommentsAndOrderOfTheFile(t *testing.T) {
	path := filepath.Join(t.TempDir(), "host.env")
	write(t, path, "# the build box\nSPOTLIGHT_URL=https://spotlight.test\nSPOTLIGHT_CAPACITY=2\nSPOTLIGHT_CAPACITY=3\nSPOTLIGHT_HOST_NAME=box\n")

	file, err := config.Open(path)
	if err != nil {
		t.Fatal(err)
	}
	if err := file.Set("SPOTLIGHT_CAPACITY", " 8 "); err != nil {
		t.Fatal(err)
	}
	if !file.Unset("SPOTLIGHT_HOST_NAME") || file.Unset("SPOTLIGHT_TRUST") {
		t.Error("unset reports the wrong removals")
	}
	if err := file.Set("SPOTLIGHT_POOL_TOKEN", "pool-token"); err != nil {
		t.Fatal(err)
	}
	if err := file.Save(); err != nil {
		t.Fatal(err)
	}

	raw, _ := os.ReadFile(path)
	want := "# the build box\nSPOTLIGHT_URL=https://spotlight.test\nSPOTLIGHT_CAPACITY=8\nSPOTLIGHT_POOL_TOKEN=pool-token\n"
	if string(raw) != want {
		t.Errorf("saved:\n%s\nwant:\n%s", raw, want)
	}
	info, _ := os.Stat(path)
	if info.Mode().Perm() != 0o600 {
		t.Errorf("mode %v: the file holds a token", info.Mode().Perm())
	}
	if leftovers, _ := filepath.Glob(filepath.Join(filepath.Dir(path), ".host.env-*")); len(leftovers) > 0 {
		t.Errorf("left %v", leftovers)
	}
}

func TestAValueIsOneLine(t *testing.T) {
	file, _ := config.Open(filepath.Join(t.TempDir(), "host.env"))
	if err := file.Set("SPOTLIGHT_URL", "https://a.test\nSPOTLIGHT_TRUST=x"); err == nil {
		t.Error("a value with a line break is saved")
	}
}

func TestOpeningAMissingFileGivesNoValues(t *testing.T) {
	file, err := config.Open(filepath.Join(t.TempDir(), "missing", "host.env"))
	if err != nil || len(file.Values()) != 0 {
		t.Fatalf("values %v, error %v", file.Values(), err)
	}
	if err := file.Set("SPOTLIGHT_URL", "https://spotlight.test"); err != nil {
		t.Fatal(err)
	}
	if err := file.Save(); err != nil {
		t.Fatalf("save makes the directory: %v", err)
	}
}

func TestLooksUpAFriendlyKeyOrItsVariable(t *testing.T) {
	for _, key := range []string{"capacity", "SPOTLIGHT_CAPACITY"} {
		setting, err := config.Lookup(key)
		if err != nil || setting.Env != "SPOTLIGHT_CAPACITY" || !setting.Live {
			t.Errorf("%s: %+v, %v", key, setting, err)
		}
	}

	if setting, err := config.Lookup("token"); err != nil || setting.Env != "SPOTLIGHT_POOL_TOKEN" || setting.Live || !setting.Secret {
		t.Errorf("token: %+v, %v", setting, err)
	}
	if setting, err := config.Lookup("HTTPS_PROXY"); err != nil || setting.Live {
		t.Errorf("another variable: %+v, %v", setting, err)
	}
	if _, err := config.Lookup("capacty"); err == nil {
		t.Error("a misspelt key is accepted")
	}
}

func TestErrorsNameTheFriendlyKey(t *testing.T) {
	isolated(t)

	_, err := config.Parse("dev", map[string]string{
		"SPOTLIGHT_URL": "https://spotlight.test", "SPOTLIGHT_POOL_TOKEN": "pool-token", "SPOTLIGHT_CAPACITY": "zero",
	})
	got := config.Friendly(err).Error()
	if !strings.Contains(got, `capacity: "zero" is not a count`) || strings.Contains(got, "SPOTLIGHT_") {
		t.Errorf("error %q", got)
	}

	if got := config.Friendly(errors.New("OTEL_TRACES_SAMPLER_ARG and OTEL_TRACES_SAMPLER")).Error(); got != "traces-sampler-arg and traces-sampler" {
		t.Errorf("error %q: a longer variable is named by a shorter one's key", got)
	}
}

func TestMasksAllButTheEndOfASecret(t *testing.T) {
	if got := config.Mask("spl_0123456789abcd"); got != "••••abcd" {
		t.Errorf("mask %q", got)
	}
	if got := config.Mask("short"); got != "••••" {
		t.Errorf("mask %q shows a short secret", got)
	}
}

func TestNamesTheProcessThatHoldsTheLock(t *testing.T) {
	state := t.TempDir()
	if pid, err := config.Serving(state); pid != 0 || err != nil {
		t.Fatalf("no host: pid %d, error %v", pid, err)
	}

	release, err := config.Lock(state)
	if err != nil {
		t.Fatal(err)
	}
	if pid, err := config.Serving(state); pid != os.Getpid() || err != nil {
		t.Errorf("pid %d, error %v", pid, err)
	}

	release()
	if pid, err := config.Serving(state); pid != 0 || err != nil {
		t.Errorf("a released lock: pid %d, error %v", pid, err)
	}
}

func TestSavingThroughALinkKeepsTheLink(t *testing.T) {
	dir := t.TempDir()
	target := filepath.Join(dir, "shared.env")
	write(t, target, "SPOTLIGHT_URL=https://spotlight.test\n")
	link := filepath.Join(dir, "host.env")
	if err := os.Symlink(target, link); err != nil {
		t.Fatal(err)
	}

	file, _ := config.Open(link)
	if err := file.Set("SPOTLIGHT_CAPACITY", "3"); err != nil {
		t.Fatal(err)
	}
	if err := file.Save(); err != nil {
		t.Fatal(err)
	}

	if info, _ := os.Lstat(link); info.Mode()&os.ModeSymlink == 0 {
		t.Error("the link was replaced by a file")
	}
	if raw, _ := os.ReadFile(target); !strings.Contains(string(raw), "SPOTLIGHT_CAPACITY=3") {
		t.Errorf("target:\n%s", raw)
	}
}
