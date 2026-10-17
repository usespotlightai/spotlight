package seal

import (
	"crypto/ecdh"
	"encoding/base64"
	"errors"
	"testing"

	"usespotlight.ai/data-plane/egressing/seal/sealtest"
)

// The control plane's X25519RunSealing sealed these values. A change on one side that breaks the other side fails here.
const (
	controlPlanePrivate = "sGMDFRZy+DsQRa8nKNJOxqAz5VQmij8qotJxDm7gnWs="
	controlPlaneSealed  = "v1.1o5eXNj2G0k4siFghhBwLMMXHsX7r1EL/f7FBHT9ky8=.UAc3AFGL0OALAHco.37mlV67CXU3Tpj6VELkItw==.hM5erVUYjK9q"
)

func keyOf(t *testing.T, written string) *Key {
	t.Helper()

	raw, err := base64.StdEncoding.DecodeString(written)
	if err != nil {
		t.Fatal(err)
	}
	private, err := ecdh.X25519().NewPrivateKey(raw)
	if err != nil {
		t.Fatal(err)
	}

	return &Key{private: private}
}

func TestOpensWhatTheControlPlaneSealedForTheRun(t *testing.T) {
	key := keyOf(t, controlPlanePrivate)

	opened, err := key.Open(controlPlaneSealed, "run_1", "LINEAR_API_KEY")
	if err != nil || opened != "lin_api_1" {
		t.Fatalf("opened %q: %v", opened, err)
	}
}

func TestOpensNothingSealedForAnotherRunSecretOrKey(t *testing.T) {
	key := keyOf(t, controlPlanePrivate)
	stranger, err := NewKey()
	if err != nil {
		t.Fatal(err)
	}

	for name, open := range map[string]func() (string, error){
		"another run":    func() (string, error) { return key.Open(controlPlaneSealed, "run_2", "LINEAR_API_KEY") },
		"another secret": func() (string, error) { return key.Open(controlPlaneSealed, "run_1", "SENTRY_TOKEN") },
		"another key":    func() (string, error) { return stranger.Open(controlPlaneSealed, "run_1", "LINEAR_API_KEY") },
		"no envelope":    func() (string, error) { return key.Open("v1.nothing", "run_1", "LINEAR_API_KEY") },
		"a later format": func() (string, error) { return key.Open("v2"+controlPlaneSealed[2:], "run_1", "LINEAR_API_KEY") },
	} {
		if opened, err := open(); !errors.Is(err, ErrUnopenable) || opened != "" {
			t.Errorf("%s: opened %q (%v)", name, opened, err)
		}
	}
}

func TestNamesItselfAsA32ByteKeyInBase64(t *testing.T) {
	key, err := NewKey()
	if err != nil {
		t.Fatal(err)
	}

	raw, err := base64.StdEncoding.DecodeString(key.Recipient())
	if err != nil || len(raw) != 32 {
		t.Errorf("recipient %q: %v", key.Recipient(), err)
	}
}

func TestOpensWhatTheTestSealerSealsForTheRun(t *testing.T) {
	key, err := NewKey()
	if err != nil {
		t.Fatal(err)
	}

	sealed, err := sealtest.Seal(key.Recipient(), "lin_api_1", "run_1", "LINEAR_API_KEY")
	if err != nil {
		t.Fatal(err)
	}

	if opened, err := key.Open(sealed, "run_1", "LINEAR_API_KEY"); err != nil || opened != "lin_api_1" {
		t.Fatalf("opened %q: %v", opened, err)
	}
}
