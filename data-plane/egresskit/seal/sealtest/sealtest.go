package sealtest

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/ecdh"
	"crypto/hkdf"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"strings"
)

func Seal(recipient, value, runID, secret string) (string, error) {
	raw, err := base64.StdEncoding.DecodeString(recipient)
	if err != nil {
		return "", err
	}
	public, err := ecdh.X25519().NewPublicKey(raw)
	if err != nil {
		return "", err
	}

	ephemeral, err := ecdh.X25519().GenerateKey(rand.Reader)
	if err != nil {
		return "", err
	}
	shared, err := ephemeral.ECDH(public)
	if err != nil {
		return "", err
	}

	salt := append(append([]byte{}, ephemeral.PublicKey().Bytes()...), raw...)
	key, err := hkdf.Key(sha256.New, shared, salt, "spotlight:egress-seal:v1", 32)
	if err != nil {
		return "", err
	}

	block, err := aes.NewCipher(key)
	if err != nil {
		return "", err
	}
	aead, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}

	nonce := make([]byte, aead.NonceSize())
	if _, err := rand.Read(nonce); err != nil {
		return "", err
	}
	sealed := aead.Seal(nil, nonce, []byte(value), []byte("spotlight:egress:v1\x00"+runID+"\x00"+secret))
	encrypted, tag := sealed[:len(sealed)-aead.Overhead()], sealed[len(sealed)-aead.Overhead():]

	encode := base64.StdEncoding.EncodeToString
	return strings.Join([]string{"v1", encode(ephemeral.PublicKey().Bytes()), encode(nonce), encode(tag), encode(encrypted)}, "."), nil
}
