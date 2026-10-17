package registry_test

import (
	"encoding/base64"
	"encoding/json"
	"os"
	"path/filepath"
	"testing"

	"usespotlight.ai/data-plane/host/internal/registry"
)

func configured(t *testing.T, body string) registry.Credentials {
	t.Helper()

	path := filepath.Join(t.TempDir(), "config.json")
	if err := os.WriteFile(path, []byte(body), 0o600); err != nil {
		t.Fatal(err)
	}
	return registry.From(path)
}

func decoded(t *testing.T, header string) map[string]string {
	t.Helper()

	raw, err := base64.URLEncoding.DecodeString(header)
	if err != nil {
		t.Fatalf("header %q: %v", header, err)
	}
	var said map[string]string
	if err := json.Unmarshal(raw, &said); err != nil {
		t.Fatal(err)
	}
	return said
}

func TestNamesTheRegistryAnImageComesFrom(t *testing.T) {
	for image, want := range map[string]string{
		"ubuntu:24.04":                          "docker.io",
		"acme/runner:main":                      "docker.io",
		"ghcr.io/acme/runner:main":              "ghcr.io",
		"registry.local:5000/runner":            "registry.local:5000",
		"localhost/runner:dev":                  "localhost",
		"123.dkr.ecr.eu-west-1.amazonaws.com/r": "123.dkr.ecr.eu-west-1.amazonaws.com",
	} {
		if got := registry.Of(image); got != want {
			t.Errorf("%s: got %s, want %s", image, got, want)
		}
	}
}

func TestSignsAPullWithTheRegistrysCredentials(t *testing.T) {
	credentials := configured(t, `{"auths":{"ghcr.io":{"auth":"`+
		base64.StdEncoding.EncodeToString([]byte("robot:s3cret"))+`"}}}`)

	header, err := credentials.For("ghcr.io/acme/runner:main")
	if err != nil {
		t.Fatal(err)
	}

	said := decoded(t, header)
	if said["username"] != "robot" || said["password"] != "s3cret" || said["serveraddress"] != "ghcr.io" {
		t.Errorf("said %v", said)
	}
}

func TestFindsDockerHubUnderItsLegacyName(t *testing.T) {
	credentials := configured(t, `{"auths":{"https://index.docker.io/v1/":{"identitytoken":"refresh"}}}`)

	header, err := credentials.For("acme/runner:main")
	if err != nil {
		t.Fatal(err)
	}

	if said := decoded(t, header); said["identitytoken"] != "refresh" {
		t.Errorf("said %v", said)
	}
}

func TestPullsAnonymouslyWhereItHasNoCredentials(t *testing.T) {
	credentials := configured(t, `{"auths":{"ghcr.io":{"auth":"eDp5"}}}`)

	for _, image := range []string{"quay.io/acme/runner:1", "ubuntu:24.04"} {
		if header, err := credentials.For(image); err != nil || header != "" {
			t.Errorf("%s: %q, %v", image, header, err)
		}
	}

	if header, err := registry.From(filepath.Join(t.TempDir(), "missing.json")).For("ghcr.io/x/y"); err != nil || header != "" {
		t.Errorf("a missing file: %q, %v", header, err)
	}
}
