package config

import (
	"bufio"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
)

const envConfigPath = "SPOTLIGHT_CONFIG"

// Path is where the runner's settings are persisted. SPOTLIGHT_CONFIG overrides it.
func Path() string {
	if p := strings.TrimSpace(os.Getenv(envConfigPath)); p != "" {
		return p
	}
	if os.Geteuid() == 0 {
		return "/etc/spotlight/runner.env"
	}
	if home, err := os.UserHomeDir(); err == nil && home != "" {
		return filepath.Join(home, ".spotlight", "runner.env")
	}
	return "/etc/spotlight/runner.env"
}

// Read parses the persisted config. A missing file is no values, not an error.
func Read() (map[string]string, error) {
	file, err := os.Open(Path())
	if err != nil {
		if os.IsNotExist(err) {
			return map[string]string{}, nil
		}
		return nil, err
	}
	defer file.Close()

	values := map[string]string{}
	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		key, value, ok := strings.Cut(line, "=")
		if !ok {
			continue
		}
		values[strings.TrimSpace(key)] = strings.TrimSpace(value)
	}

	return values, scanner.Err()
}

// Merge writes updates into the config file, keeping whatever else is there.
func Merge(updates map[string]string) error {
	values, err := Read()
	if err != nil {
		return err
	}
	for key, value := range updates {
		values[key] = value
	}

	keys := make([]string, 0, len(values))
	for key := range values {
		keys = append(keys, key)
	}
	sort.Strings(keys)

	var builder strings.Builder
	for _, key := range keys {
		fmt.Fprintf(&builder, "%s=%s\n", key, values[key])
	}

	if err := os.MkdirAll(filepath.Dir(Path()), 0o755); err != nil {
		return err
	}
	return os.WriteFile(Path(), []byte(builder.String()), 0o600)
}
