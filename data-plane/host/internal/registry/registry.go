package registry

import (
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

const dockerHub = "docker.io"

var hubKeys = []string{"https://index.docker.io/v1/", "index.docker.io", "docker.io", "registry-1.docker.io"}

type Credentials struct {
	path string
}

func From(path string) Credentials {
	return Credentials{path: path}
}

func DefaultPath() string {
	if dir := strings.TrimSpace(os.Getenv("DOCKER_CONFIG")); dir != "" {
		return filepath.Join(dir, "config.json")
	}
	if home, err := os.UserHomeDir(); err == nil && home != "" {
		return filepath.Join(home, ".docker", "config.json")
	}
	return ""
}

type entry struct {
	Auth          string `json:"auth"`
	Username      string `json:"username"`
	Password      string `json:"password"`
	IdentityToken string `json:"identitytoken"`
}

type header struct {
	Username      string `json:"username,omitempty"`
	Password      string `json:"password,omitempty"`
	IdentityToken string `json:"identitytoken,omitempty"`
	ServerAddress string `json:"serveraddress"`
}

func (c Credentials) For(image string) (string, error) {
	if c.path == "" {
		return "", nil
	}

	raw, err := os.ReadFile(c.path)
	if errors.Is(err, os.ErrNotExist) {
		return "", nil
	}
	if err != nil {
		return "", fmt.Errorf("read registry credentials %s: %w", c.path, err)
	}

	var config struct {
		Auths map[string]entry `json:"auths"`
	}
	if err := json.Unmarshal(raw, &config); err != nil {
		return "", fmt.Errorf("read registry credentials %s: %w", c.path, err)
	}

	server := Of(image)
	found, key, ok := lookup(config.Auths, server)
	if !ok {
		return "", nil
	}

	said := header{ServerAddress: key, IdentityToken: found.IdentityToken}
	switch {
	case found.Auth != "":
		decoded, err := base64.StdEncoding.DecodeString(found.Auth)
		if err != nil {
			return "", fmt.Errorf("registry credentials for %s: auth is not base64", server)
		}
		said.Username, said.Password, _ = strings.Cut(string(decoded), ":")
	default:
		said.Username, said.Password = found.Username, found.Password
	}

	encoded, err := json.Marshal(said)
	if err != nil {
		return "", err
	}

	return base64.URLEncoding.EncodeToString(encoded), nil
}

func lookup(auths map[string]entry, server string) (entry, string, bool) {
	keys := []string{server, "https://" + server, "http://" + server}
	if server == dockerHub {
		keys = hubKeys
	}

	for _, key := range keys {
		if found, ok := auths[key]; ok {
			return found, key, true
		}
	}
	return entry{}, "", false
}

func Of(image string) string {
	first, _, found := strings.Cut(image, "/")
	if !found || (!strings.ContainsAny(first, ".:") && first != "localhost") {
		return dockerHub
	}
	return first
}
