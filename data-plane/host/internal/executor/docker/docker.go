package docker

import (
	"archive/tar"
	"bufio"
	"bytes"
	"context"
	"encoding/binary"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"os"
	"path"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"usespotlight.ai/data-plane/host/internal/executor"
)

type Engine struct {
	http *http.Client
	base string
}

var _ executor.Executor = (*Engine)(nil)

func Connect(dockerHost string) (*Engine, error) {
	if dockerHost == "" {
		dockerHost = found()
	}
	if dockerHost == "" {
		return nil, errors.New("no container runtime found: start Docker, Podman, OrbStack or Colima, or set DOCKER_HOST")
	}

	endpoint, err := url.Parse(dockerHost)
	if err != nil {
		return nil, fmt.Errorf("DOCKER_HOST %q is not an address: %w", dockerHost, err)
	}

	switch endpoint.Scheme {
	case "unix":
		socket := endpoint.Path
		return &Engine{
			base: "http://engine",
			http: &http.Client{Transport: &http.Transport{
				DialContext: func(ctx context.Context, _, _ string) (net.Conn, error) {
					return (&net.Dialer{}).DialContext(ctx, "unix", socket)
				},
			}},
		}, nil
	case "tcp", "http":
		return &Engine{base: "http://" + endpoint.Host, http: &http.Client{}}, nil
	default:
		return nil, fmt.Errorf("DOCKER_HOST %q: only unix:// and tcp:// engines are supported", dockerHost)
	}
}

func found() string {
	home, _ := os.UserHomeDir()
	candidates := []string{
		"/var/run/docker.sock",
		filepath.Join(home, ".docker/run/docker.sock"),
		filepath.Join(home, ".orbstack/run/docker.sock"),
		filepath.Join(home, ".colima/default/docker.sock"),
		filepath.Join(home, ".colima/docker.sock"),
		"/run/podman/podman.sock",
	}
	if runtime := os.Getenv("XDG_RUNTIME_DIR"); runtime != "" {
		candidates = append(candidates, filepath.Join(runtime, "podman/podman.sock"))
	}

	for _, socket := range candidates {
		if info, err := os.Stat(socket); err == nil && info.Mode()&os.ModeSocket != 0 {
			return "unix://" + socket
		}
	}

	return ""
}

func (e *Engine) Describe(ctx context.Context) (string, error) {
	var version struct {
		Version  string
		Os       string
		Arch     string
		Platform struct{ Name string }
	}
	if _, err := e.call(ctx, http.MethodGet, "/version", nil, &version); err != nil {
		return "", fmt.Errorf("reach the container runtime: %w", err)
	}

	name := version.Platform.Name
	if name == "" {
		name = "container engine"
	}

	return fmt.Sprintf("%s %s (%s/%s)", name, version.Version, version.Os, version.Arch), nil
}

func (e *Engine) Ensure(ctx context.Context, image string) error {
	status, err := e.call(ctx, http.MethodGet, "/images/"+image+"/json", nil, nil)
	if err == nil {
		return nil
	}
	if status != http.StatusNotFound {
		return fmt.Errorf("look for image %s: %w", image, err)
	}

	name, tag := reference(image)
	query := url.Values{"fromImage": {name}}
	if tag != "" {
		query.Set("tag", tag)
	}

	response, err := e.send(ctx, http.MethodPost, "/images/create?"+query.Encode(), nil, "")
	if err != nil {
		return fmt.Errorf("pull image %s: %w", image, err)
	}
	defer response.Body.Close()

	if response.StatusCode >= 300 {
		return fmt.Errorf("pull image %s: %w", image, failure(response))
	}

	decoder := json.NewDecoder(response.Body)
	for {
		var progress struct {
			Error string `json:"error"`
		}
		if err := decoder.Decode(&progress); errors.Is(err, io.EOF) {
			return nil
		} else if err != nil {
			return fmt.Errorf("pull image %s: %w", image, err)
		}
		if progress.Error != "" {
			return fmt.Errorf("pull image %s: %s", image, progress.Error)
		}
	}
}

func reference(image string) (string, string) {
	if strings.Contains(image, "@") {
		return image, ""
	}

	slash := strings.LastIndex(image, "/")
	if colon := strings.LastIndex(image, ":"); colon > slash {
		return image[:colon], image[colon+1:]
	}

	return image, "latest"
}

type mount struct {
	Type     string
	Source   string
	Target   string
	ReadOnly bool
}

type hostConfig struct {
	Init        bool
	Mounts      []mount  `json:",omitempty"`
	NetworkMode string   `json:",omitempty"`
	ExtraHosts  []string `json:",omitempty"`
}

type created struct {
	Image      string
	Cmd        []string `json:",omitempty"`
	Env        []string
	Labels     map[string]string
	HostConfig hostConfig
}

func (e *Engine) Start(ctx context.Context, sandbox executor.Sandbox) (string, error) {
	config := created{
		Image:  sandbox.Image,
		Cmd:    sandbox.Args,
		Env:    sandbox.Env,
		Labels: sandbox.Labels,
		HostConfig: hostConfig{
			Init:        true,
			NetworkMode: sandbox.Network,
			ExtraHosts:  sandbox.ExtraHosts,
		},
	}
	for _, each := range sandbox.Mounts {
		config.HostConfig.Mounts = append(config.HostConfig.Mounts, mount{
			Type: "bind", Source: each.Source, Target: each.Target, ReadOnly: each.ReadOnly,
		})
	}

	var answer struct{ Id string }
	query := url.Values{}
	if sandbox.Name != "" {
		query.Set("name", sandbox.Name)
	}
	if _, err := e.call(ctx, http.MethodPost, "/containers/create?"+query.Encode(), config, &answer); err != nil {
		return "", fmt.Errorf("create a sandbox: %w", err)
	}

	if err := e.lay(ctx, answer.Id, sandbox.Files); err != nil {
		return answer.Id, err
	}

	if _, err := e.call(ctx, http.MethodPost, "/containers/"+answer.Id+"/start", nil, nil); err != nil {
		return answer.Id, fmt.Errorf("start a sandbox: %w", err)
	}

	return answer.Id, nil
}

func (e *Engine) lay(ctx context.Context, id string, files []executor.File) error {
	for _, file := range files {
		if err := e.layOne(ctx, id, file); err != nil {
			return err
		}
	}

	return nil
}

// Extracted beside its own directory, so the image's existing parents keep their modes.
func (e *Engine) layOne(ctx context.Context, id string, file executor.File) error {
	name := path.Clean("/" + file.Path)
	dir := path.Dir(name)
	if dir == "/" {
		return fmt.Errorf("hand a sandbox its files: %s needs a directory of its own", file.Path)
	}

	status, err := e.extract(ctx, id, path.Dir(dir), []string{path.Base(dir)}, name, file)
	if status == http.StatusNotFound {
		parents := strings.Split(strings.TrimPrefix(dir, "/"), "/")
		_, err = e.extract(ctx, id, "/", parents, name, file)
	}

	return err
}

func (e *Engine) extract(
	ctx context.Context, id, at string, dirs []string, name string, file executor.File,
) (int, error) {
	var archive bytes.Buffer
	writer := tar.NewWriter(&archive)

	made := ""
	for at, dir := range dirs {
		made = path.Join(made, dir)
		mode := int64(0o755)
		if at == len(dirs)-1 {
			mode = 0o700
		}
		if err := writer.WriteHeader(&tar.Header{Typeflag: tar.TypeDir, Name: made + "/", Mode: mode}); err != nil {
			return 0, err
		}
	}
	if err := writer.WriteHeader(&tar.Header{
		Typeflag: tar.TypeReg, Name: path.Join(made, path.Base(name)), Mode: file.Mode, Size: int64(len(file.Body)),
	}); err != nil {
		return 0, err
	}
	if _, err := writer.Write(file.Body); err != nil {
		return 0, err
	}
	if err := writer.Close(); err != nil {
		return 0, err
	}

	query := url.Values{"path": {at}}
	response, err := e.send(ctx, http.MethodPut, "/containers/"+id+"/archive?"+query.Encode(), &archive, "application/x-tar")
	if err != nil {
		return 0, fmt.Errorf("hand a sandbox its files: %w", err)
	}
	defer response.Body.Close()

	if response.StatusCode >= 300 {
		return response.StatusCode, fmt.Errorf("hand a sandbox its files: %w", failure(response))
	}

	return response.StatusCode, nil
}

func (e *Engine) Follow(ctx context.Context, id string, out io.Writer) error {
	query := url.Values{"follow": {"1"}, "stdout": {"1"}, "stderr": {"1"}}

	response, err := e.send(ctx, http.MethodGet, "/containers/"+id+"/logs?"+query.Encode(), nil, "")
	if err != nil {
		return err
	}
	defer response.Body.Close()

	if response.StatusCode >= 300 {
		return failure(response)
	}

	return demultiplex(response.Body, out)
}

func demultiplex(in io.Reader, out io.Writer) error {
	reader := bufio.NewReader(in)
	header := make([]byte, 8)

	for {
		if _, err := io.ReadFull(reader, header); err != nil {
			if errors.Is(err, io.EOF) || errors.Is(err, io.ErrUnexpectedEOF) {
				return nil
			}
			return err
		}

		size := int64(binary.BigEndian.Uint32(header[4:]))
		if _, err := io.CopyN(out, reader, size); err != nil {
			return err
		}
	}
}

func (e *Engine) Wait(ctx context.Context, id string) (int, error) {
	var answer struct {
		StatusCode int
		Error      *struct{ Message string }
	}

	status, err := e.call(ctx, http.MethodPost, "/containers/"+id+"/wait?condition=not-running", nil, &answer)
	if status == http.StatusNotFound {
		return -1, fmt.Errorf("wait for a sandbox: %w: %w", executor.ErrGone, err)
	}
	if err != nil {
		return -1, fmt.Errorf("wait for a sandbox: %w", err)
	}
	if answer.Error != nil && answer.Error.Message != "" && answer.StatusCode == 0 {
		return -1, fmt.Errorf("wait for a sandbox: %w: %s", executor.ErrGone, answer.Error.Message)
	}

	return answer.StatusCode, nil
}

func (e *Engine) Stop(ctx context.Context, id string, grace time.Duration) error {
	seconds := strconv.Itoa(int(grace.Seconds()))
	status, err := e.call(ctx, http.MethodPost, "/containers/"+id+"/stop?t="+seconds, nil, nil)
	if err != nil && status != http.StatusNotModified && status != http.StatusNotFound {
		return fmt.Errorf("stop a sandbox: %w", err)
	}

	return nil
}

func (e *Engine) Destroy(ctx context.Context, id string) error {
	status, err := e.call(ctx, http.MethodDelete, "/containers/"+id+"?force=1&v=1", nil, nil)
	if err != nil && status != http.StatusNotFound {
		return fmt.Errorf("destroy a sandbox: %w", err)
	}

	return nil
}

func (e *Engine) Labelled(ctx context.Context, key, value string) ([]string, error) {
	filters, _ := json.Marshal(map[string][]string{"label": {key + "=" + value}})
	query := url.Values{"all": {"1"}, "filters": {string(filters)}}

	var listed []struct{ Id string }
	if _, err := e.call(ctx, http.MethodGet, "/containers/json?"+query.Encode(), nil, &listed); err != nil {
		return nil, fmt.Errorf("list sandboxes: %w", err)
	}

	ids := make([]string, 0, len(listed))
	for _, each := range listed {
		ids = append(ids, each.Id)
	}

	return ids, nil
}

func (e *Engine) call(ctx context.Context, method, path string, in, out any) (int, error) {
	var body io.Reader
	if in != nil {
		encoded, err := json.Marshal(in)
		if err != nil {
			return 0, err
		}
		body = bytes.NewReader(encoded)
	}

	response, err := e.send(ctx, method, path, body, "application/json")
	if err != nil {
		return 0, err
	}
	defer response.Body.Close()

	if response.StatusCode >= 300 {
		return response.StatusCode, failure(response)
	}

	if out != nil && response.StatusCode != http.StatusNoContent {
		if err := json.NewDecoder(response.Body).Decode(out); err != nil {
			return response.StatusCode, fmt.Errorf("%s %s: %w", method, path, err)
		}
	}

	return response.StatusCode, nil
}

func (e *Engine) send(ctx context.Context, method, path string, body io.Reader, contentType string) (*http.Response, error) {
	request, err := http.NewRequestWithContext(ctx, method, e.base+path, body)
	if err != nil {
		return nil, err
	}
	if body != nil && contentType != "" {
		request.Header.Set("Content-Type", contentType)
	}

	return e.http.Do(request)
}

func failure(response *http.Response) error {
	var said struct{ Message string }
	raw, _ := io.ReadAll(io.LimitReader(response.Body, 4096))
	if json.Unmarshal(raw, &said) == nil && said.Message != "" {
		return fmt.Errorf("%s: %s", response.Status, said.Message)
	}

	return fmt.Errorf("%s: %s", response.Status, strings.TrimSpace(string(raw)))
}
