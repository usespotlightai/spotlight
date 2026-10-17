package trust

import (
	"os"
	"path/filepath"
	"testing"
)

func TestTrustsTheRunsAuthorityBesideWhatTheImageAlreadyTrusts(t *testing.T) {
	dir := t.TempDir()
	authority, bundle := filepath.Join(dir, "authority.pem"), filepath.Join(dir, "bundle.pem")
	debian, alpine, absent := filepath.Join(dir, "debian.crt"), filepath.Join(dir, "alpine.pem"), filepath.Join(dir, "rhel.crt")

	for path, body := range map[string]string{authority: "RUN\n", debian: "PUBLIC\nACME", alpine: "OTHER\n"} {
		if err := os.WriteFile(path, []byte(body), 0o644); err != nil {
			t.Fatal(err)
		}
	}

	if err := installed(authority, bundle, []string{debian, absent, alpine}); err != nil {
		t.Fatal(err)
	}

	for path, want := range map[string]string{bundle: "PUBLIC\nACME\nRUN\n", debian: "PUBLIC\nACME\nRUN\n", alpine: "OTHER\nRUN\n"} {
		if got, _ := os.ReadFile(path); string(got) != want {
			t.Errorf("%s holds %q", filepath.Base(path), got)
		}
	}
	if _, err := os.Stat(absent); !os.IsNotExist(err) {
		t.Error("made a bundle the image did not have")
	}
}

func TestLeavesTrustAloneWithNoEgress(t *testing.T) {
	dir := t.TempDir()
	system := filepath.Join(dir, "system.crt")
	if err := os.WriteFile(system, []byte("PUBLIC\n"), 0o644); err != nil {
		t.Fatal(err)
	}

	if err := installed(filepath.Join(dir, "none.pem"), filepath.Join(dir, "bundle.pem"), []string{system}); err != nil {
		t.Fatal(err)
	}
	if got, _ := os.ReadFile(system); string(got) != "PUBLIC\n" {
		t.Errorf("changed the system bundle: %q", got)
	}
}

func TestTrustsOnceThroughALinkAndAgainWithoutRepeating(t *testing.T) {
	dir := t.TempDir()
	authority, bundle := filepath.Join(dir, "authority.pem"), filepath.Join(dir, "bundle.pem")
	real, link := filepath.Join(dir, "ca-certificates.crt"), filepath.Join(dir, "cert.pem")
	if err := os.WriteFile(authority, []byte("RUN\n"), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(real, []byte("PUBLIC\n"), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := os.Symlink(real, link); err != nil {
		t.Fatal(err)
	}

	for range 2 {
		if err := installed(authority, bundle, []string{real, link}); err != nil {
			t.Fatal(err)
		}
	}

	if got, _ := os.ReadFile(real); string(got) != "PUBLIC\nRUN\n" {
		t.Errorf("the system bundle holds %q", got)
	}
	if target, _ := os.Readlink(link); target != real {
		t.Errorf("the link now points at %q", target)
	}
}

func TestWritesTheSandboxBundleEvenWhenASystemBundleWillNotChange(t *testing.T) {
	dir := t.TempDir()
	authority, bundle := filepath.Join(dir, "authority.pem"), filepath.Join(dir, "bundle.pem")
	locked := filepath.Join(dir, "locked")
	if err := os.Mkdir(locked, 0o755); err != nil {
		t.Fatal(err)
	}
	system := filepath.Join(locked, "ca.crt")
	if err := os.WriteFile(authority, []byte("RUN\n"), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(system, []byte("PUBLIC\n"), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := os.Chmod(locked, 0o555); err != nil {
		t.Fatal(err)
	}
	defer os.Chmod(locked, 0o755)

	if err := installed(authority, bundle, []string{system}); err == nil && os.Geteuid() != 0 {
		t.Error("said nothing of the bundle it could not change")
	}
	if got, _ := os.ReadFile(bundle); string(got) != "PUBLIC\nRUN\n" {
		t.Errorf("the sandbox bundle holds %q", got)
	}
	if got, _ := os.ReadFile(system); string(got) != "PUBLIC\n" && string(got) != "PUBLIC\nRUN\n" {
		t.Errorf("the system bundle was left half-written: %q", got)
	}
}

func TestTrustsAnAuthorityItHoldsInMemory(t *testing.T) {
	dir := t.TempDir()
	authority, bundle := filepath.Join(dir, "egress", "authority.pem"), filepath.Join(dir, "egress", "bundle.pem")
	system := filepath.Join(dir, "system.crt")
	if err := os.WriteFile(system, []byte("PUBLIC\n"), 0o644); err != nil {
		t.Fatal(err)
	}

	if err := trusting([]byte("WAY OUT\n"), authority, bundle, []string{system}); err != nil {
		t.Fatal(err)
	}

	for path, want := range map[string]string{authority: "WAY OUT\n", bundle: "PUBLIC\nWAY OUT\n", system: "PUBLIC\nWAY OUT\n"} {
		if got, _ := os.ReadFile(path); string(got) != want {
			t.Errorf("%s holds %q", filepath.Base(path), got)
		}
	}
}
