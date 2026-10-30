package sshd

import (
	"crypto/ed25519"
	"crypto/rand"
	"encoding/pem"
	"errors"
	"fmt"
	"os"
	"path/filepath"

	"golang.org/x/crypto/ssh"
)

// Two connections that start together must get the same key.
func HostKey(path string) ([]byte, error) {
	if key, err := os.ReadFile(path); err == nil {
		return key, nil
	} else if !errors.Is(err, os.ErrNotExist) {
		return nil, fmt.Errorf("read the sandbox's host key: %w", err)
	}

	_, private, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		return nil, fmt.Errorf("make the sandbox's host key: %w", err)
	}
	block, err := ssh.MarshalPrivateKey(private, "")
	if err != nil {
		return nil, fmt.Errorf("make the sandbox's host key: %w", err)
	}
	key := pem.EncodeToMemory(block)

	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		return nil, fmt.Errorf("keep the sandbox's host key: %w", err)
	}
	made, err := os.CreateTemp(filepath.Dir(path), ".host-key-*")
	if err != nil {
		return nil, fmt.Errorf("keep the sandbox's host key: %w", err)
	}
	defer os.Remove(made.Name())

	if _, err := made.Write(key); err != nil {
		made.Close()
		return nil, fmt.Errorf("keep the sandbox's host key: %w", err)
	}
	if err := made.Close(); err != nil {
		return nil, fmt.Errorf("keep the sandbox's host key: %w", err)
	}

	if err := os.Link(made.Name(), path); errors.Is(err, os.ErrExist) {
		return os.ReadFile(path)
	} else if err != nil {
		return nil, fmt.Errorf("keep the sandbox's host key: %w", err)
	}

	return key, nil
}

func Signer(key []byte) (ssh.Signer, error) {
	signer, err := ssh.ParsePrivateKey(key)
	if err != nil {
		return nil, fmt.Errorf("read the sandbox's host key: %w", err)
	}
	return signer, nil
}
