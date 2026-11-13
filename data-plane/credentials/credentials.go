package credentials

import (
	"encoding/json"
	"errors"
	"fmt"
	"net"
	"net/url"
	"os"
	"path/filepath"
	"slices"
	"strings"
)

const (
	DirVar         = "SPOTLIGHT_CONFIG_DIR"
	URLVar         = "SPOTLIGHT_URL"
	DefaultAddress = "https://app.usespotlight.ai"
	xdgVar         = "XDG_CONFIG_HOME"
	fileName       = "credentials.json"
)

type Login struct {
	Token string `json:"token"`
	User  string `json:"user"`
}

type File struct {
	Path   string
	fields map[string]json.RawMessage
	logins map[string]json.RawMessage
}

func Path(env func(string) string) (string, error) {
	if dir := env(DirVar); dir != "" {
		return filepath.Join(dir, fileName), nil
	}
	if dir := env(xdgVar); dir != "" {
		return filepath.Join(dir, "spotlight", fileName), nil
	}

	home := env("HOME")
	if home == "" {
		return "", fmt.Errorf("HOME is not set. Set %s to keep logins", DirVar)
	}

	return filepath.Join(home, ".config", "spotlight", fileName), nil
}

// SeveralLogins is the error of Choose when no address is given and there are logins for more than one.
type SeveralLogins struct {
	Addresses []string
}

func (e SeveralLogins) Error() string {
	return fmt.Sprintf("there are logins for %s. Say which one with --url, or set %s", strings.Join(e.Addresses, ", "), URLVar)
}

// WithScheme gives an address without a scheme https://.
func WithScheme(raw string) string {
	raw = strings.TrimSpace(raw)
	if raw == "" || strings.Contains(raw, "://") {
		return raw
	}
	return "https://" + raw
}

// Command is the command with --url for the address, which it leaves out for the default address.
func Command(command, address string) string {
	if address == DefaultAddress {
		return command
	}
	return command + " --url " + address
}

func Address(raw string) (string, error) {
	parsed, err := url.Parse(WithScheme(raw))
	if err != nil || parsed.Hostname() == "" || (parsed.Scheme != "https" && parsed.Scheme != "http") {
		return "", fmt.Errorf("%q is not a Spotlight address. Use a URL such as https://app.usespotlight.ai", raw)
	}

	host, port := strings.ToLower(parsed.Hostname()), parsed.Port()
	if parsed.Scheme == "http" && !local(host) {
		return "", fmt.Errorf("%s does not use https. Only a local address may use http", raw)
	}
	if (parsed.Scheme == "https" && port == "443") || (parsed.Scheme == "http" && port == "80") {
		port = ""
	}

	switch {
	case port != "":
		host = net.JoinHostPort(host, port)
	case strings.Contains(host, ":"):
		host = "[" + host + "]"
	}

	return parsed.Scheme + "://" + host, nil
}

func local(host string) bool {
	switch host {
	case "localhost", "127.0.0.1", "::1":
		return true
	}

	return strings.HasSuffix(host, ".localhost") || strings.HasSuffix(host, ".test")
}

func Load(path string) (*File, error) {
	f := &File{Path: path, fields: map[string]json.RawMessage{}, logins: map[string]json.RawMessage{}}

	raw, err := os.ReadFile(path)
	if errors.Is(err, os.ErrNotExist) {
		return f, nil
	}
	if err != nil {
		return nil, err
	}

	if err := json.Unmarshal(raw, &f.fields); err != nil {
		return nil, fmt.Errorf("%s is not valid JSON: %w", path, err)
	}
	if f.fields == nil {
		f.fields = map[string]json.RawMessage{}
	}
	if logins, found := f.fields["logins"]; found {
		if err := json.Unmarshal(logins, &f.logins); err != nil {
			return nil, fmt.Errorf("the logins in %s are not an object: %w", path, err)
		}
		if f.logins == nil {
			f.logins = map[string]json.RawMessage{}
		}
	}

	return f, nil
}

func Stored(env func(string) string, address string) (string, error) {
	key, err := Address(address)
	if err != nil {
		return "", err
	}

	path, err := Path(env)
	if err != nil {
		return "", nil
	}

	file, err := Load(path)
	if err != nil {
		return "", err
	}

	login, _ := file.Login(key)
	return login.Token, nil
}

func Choose(env func(string) string, given string) (string, error) {
	for _, raw := range []string{given, env(URLVar)} {
		if raw != "" {
			return Address(raw)
		}
	}

	file, err := Saved(env)
	if err != nil {
		return "", err
	}

	switch addresses := file.Addresses(); len(addresses) {
	case 0:
		return DefaultAddress, nil
	case 1:
		return addresses[0], nil
	default:
		return "", SeveralLogins{Addresses: addresses}
	}
}

// Saved is the credentials file of this computer. Without a home folder, it is empty.
func Saved(env func(string) string) (*File, error) {
	path, err := Path(env)
	if err != nil {
		return &File{}, nil
	}
	return Load(path)
}

func (f *File) Addresses() []string {
	var addresses []string
	for address := range f.logins {
		if _, found := f.Login(address); found {
			addresses = append(addresses, address)
		}
	}
	slices.Sort(addresses)

	return addresses
}

func (f *File) Login(address string) (Login, bool) {
	var login Login
	raw, found := f.logins[address]
	if !found || json.Unmarshal(raw, &login) != nil || login.Token == "" {
		return Login{}, false
	}

	return login, true
}

func (f *File) Put(address string, login Login) error {
	entry := map[string]json.RawMessage{}
	if raw, found := f.logins[address]; found {
		if json.Unmarshal(raw, &entry) != nil || entry == nil {
			entry = map[string]json.RawMessage{}
		}
	}

	token, err := json.Marshal(login.Token)
	if err != nil {
		return err
	}
	user, err := json.Marshal(login.User)
	if err != nil {
		return err
	}
	entry["token"], entry["user"] = token, user

	raw, err := json.Marshal(entry)
	if err != nil {
		return err
	}
	f.logins[address] = raw

	return nil
}

func (f *File) Remove(address string) bool {
	_, found := f.logins[address]
	delete(f.logins, address)

	return found
}

func (f *File) Save() error {
	logins, err := json.Marshal(f.logins)
	if err != nil {
		return err
	}
	f.fields["logins"] = logins

	body, err := json.MarshalIndent(f.fields, "", "  ")
	if err != nil {
		return err
	}

	dir := filepath.Dir(f.Path)
	if err := os.MkdirAll(dir, 0o700); err != nil {
		return err
	}

	temp, err := os.CreateTemp(dir, ".credentials-*.json")
	if err != nil {
		return err
	}
	defer os.Remove(temp.Name())

	_, written := temp.Write(append(body, '\n'))
	if err := errors.Join(written, temp.Chmod(0o600), temp.Sync(), temp.Close()); err != nil {
		return fmt.Errorf("write %s: %w", f.Path, err)
	}

	return os.Rename(temp.Name(), f.Path)
}
