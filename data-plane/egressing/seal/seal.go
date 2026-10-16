package seal

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/ecdh"
	"crypto/hkdf"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"errors"
	"fmt"
	"strings"
)

const (
	version = "v1"
	info    = "spotlight:egress-seal:v1"
	bound   = "spotlight:egress:v1"
)

var ErrUnopenable = errors.New("the sealed value does not open with this run's key")

type Key struct {
	private *ecdh.PrivateKey
}

func NewKey() (*Key, error) {
	private, err := ecdh.X25519().GenerateKey(rand.Reader)
	if err != nil {
		return nil, fmt.Errorf("make the run's key: %w", err)
	}

	return &Key{private: private}, nil
}

func (k *Key) Recipient() string {
	return base64.StdEncoding.EncodeToString(k.private.PublicKey().Bytes())
}

func (k *Key) Open(sealed, runID, secret string) (string, error) {
	parts := strings.Split(sealed, ".")
	if len(parts) != 5 || parts[0] != version {
		return "", ErrUnopenable
	}

	decoded := make([][]byte, 4)
	for at, part := range parts[1:] {
		raw, err := base64.StdEncoding.DecodeString(part)
		if err != nil {
			return "", ErrUnopenable
		}
		decoded[at] = raw
	}
	ephemeralRaw, nonce, tag, encrypted := decoded[0], decoded[1], decoded[2], decoded[3]

	ephemeral, err := ecdh.X25519().NewPublicKey(ephemeralRaw)
	if err != nil {
		return "", ErrUnopenable
	}
	shared, err := k.private.ECDH(ephemeral)
	if err != nil {
		return "", ErrUnopenable
	}

	salt := append(append([]byte{}, ephemeralRaw...), k.private.PublicKey().Bytes()...)
	key, err := hkdf.Key(sha256.New, shared, salt, info, 32)
	if err != nil {
		return "", ErrUnopenable
	}

	block, err := aes.NewCipher(key)
	if err != nil {
		return "", ErrUnopenable
	}
	aead, err := cipher.NewGCM(block)
	if err != nil || len(nonce) != aead.NonceSize() {
		return "", ErrUnopenable
	}

	plain, err := aead.Open(nil, nonce, append(encrypted, tag...), []byte(bound+"\x00"+runID+"\x00"+secret))
	if err != nil {
		return "", ErrUnopenable
	}

	return string(plain), nil
}
