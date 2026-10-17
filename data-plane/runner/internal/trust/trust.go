package trust

import (
	"bytes"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"slices"
)

var systemBundles = []string{
	"/etc/ssl/certs/ca-certificates.crt",
	"/etc/pki/tls/certs/ca-bundle.crt",
	"/etc/ssl/cert.pem",
}

func Install(authority, bundle string) error {
	return installed(authority, bundle, systemBundles)
}

func Trust(pem []byte, authority, bundle string) error {
	return trusting(pem, authority, bundle, systemBundles)
}

func trusting(pem []byte, authority, bundle string, system []string) error {
	for _, dir := range []string{filepath.Dir(authority), filepath.Dir(bundle)} {
		if err := os.MkdirAll(dir, 0o755); err != nil {
			return fmt.Errorf("make a place for the way out's authority: %w", err)
		}
	}
	if err := replaced(authority, pem, 0o644); err != nil {
		return fmt.Errorf("write the way out's authority: %w", err)
	}

	return installed(authority, bundle, system)
}

func installed(authority, bundle string, system []string) error {
	pem, err := os.ReadFile(authority)
	if errors.Is(err, os.ErrNotExist) {
		return nil
	}
	if err != nil {
		return fmt.Errorf("read the run's authority: %w", err)
	}

	var (
		trusted  []byte
		resolved []string
		failed   []error
	)
	for _, path := range system {
		real, err := filepath.EvalSymlinks(path)
		if errors.Is(err, os.ErrNotExist) || slices.Contains(resolved, real) {
			continue
		}
		if err != nil {
			failed = append(failed, err)
			continue
		}
		resolved = append(resolved, real)

		held, err := os.ReadFile(real)
		if err != nil {
			failed = append(failed, fmt.Errorf("read the image's trusted authorities: %w", err))
			continue
		}
		if trusted == nil {
			trusted = held
		}
	}

	if err := replaced(bundle, joined(trusted, pem), 0o644); err != nil {
		return fmt.Errorf("write the sandbox's trusted authorities: %w", err)
	}

	for _, real := range resolved {
		if err := trustedIn(real, pem); err != nil {
			failed = append(failed, fmt.Errorf("trust the run's authority in %s: %w", real, err))
		}
	}

	return errors.Join(failed...)
}

func trustedIn(path string, pem []byte) error {
	held, err := os.ReadFile(path)
	if err != nil {
		return err
	}
	if bytes.Contains(held, bytes.TrimSpace(pem)) {
		return nil
	}

	info, err := os.Stat(path)
	if err != nil {
		return err
	}

	return replaced(path, joined(held, pem), info.Mode().Perm())
}

func replaced(path string, body []byte, mode os.FileMode) error {
	temporary, err := os.CreateTemp(filepath.Dir(path), "."+filepath.Base(path)+".*")
	if err != nil {
		return err
	}
	defer os.Remove(temporary.Name())

	if _, err := temporary.Write(body); err != nil {
		temporary.Close()
		return err
	}
	if err := temporary.Close(); err != nil {
		return err
	}
	if err := os.Chmod(temporary.Name(), mode); err != nil {
		return err
	}

	return os.Rename(temporary.Name(), path)
}

func joined(held, pem []byte) []byte {
	if len(held) > 0 && !bytes.HasSuffix(held, []byte("\n")) {
		held = append(held, '\n')
	}

	return append(append([]byte{}, held...), pem...)
}
