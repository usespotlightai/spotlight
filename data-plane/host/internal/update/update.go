package update

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"runtime"
	"strings"
	"time"
)

const (
	DefaultReleases = "https://github.com/usespotlightai/spotlight/releases/download"
	Canary          = "canary"

	binaryLargest   = 512 << 20
	checksumLongest = 4 << 10
	downloadLongest = 10 * time.Minute
	versionLongest  = 10 * time.Second
)

var releaseShape = regexp.MustCompile(`^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$`)

type Binary struct {
	Path     string
	Releases string
	Platform string
	Client   *http.Client

	running os.FileInfo
}

func Running(releases string) (*Binary, error) {
	path, err := os.Executable()
	if err != nil {
		return nil, err
	}
	if path, err = filepath.EvalSymlinks(path); err != nil {
		return nil, err
	}

	return At(path, releases)
}

func At(path, releases string) (*Binary, error) {
	running, err := os.Stat(path)
	if err != nil {
		return nil, err
	}

	return &Binary{
		Path:     path,
		Releases: strings.TrimSuffix(releases, "/"),
		Platform: runtime.GOOS + "-" + runtime.GOARCH,
		Client:   &http.Client{Timeout: downloadLongest},
		running:  running,
	}, nil
}

func (b *Binary) Replaced() bool {
	now, err := os.Stat(b.Path)
	return err == nil && !os.SameFile(now, b.running)
}

func (b *Binary) To(ctx context.Context, release string) error {
	if !releaseShape.MatchString(release) {
		return fmt.Errorf("%q is not a release name", release)
	}

	url := b.Releases + "/" + release + "/spotlight-" + b.Platform

	sum, err := b.fetch(ctx, url+".sha256", checksumLongest)
	if err != nil {
		return fmt.Errorf("download the checksum: %w", err)
	}
	want := strings.TrimSpace(strings.SplitN(string(sum), " ", 2)[0])

	next, err := os.CreateTemp(filepath.Dir(b.Path), ".spotlight-"+release+"-*")
	if err != nil {
		return fmt.Errorf("write next to %s: %w", b.Path, err)
	}
	defer os.Remove(next.Name())
	defer next.Close()

	got, err := b.download(ctx, url, next)
	if err != nil {
		return fmt.Errorf("download %s: %w", url, err)
	}
	if got != want {
		return fmt.Errorf("%s failed its checksum: expected %s, got %s", url, want, got)
	}
	if err := next.Close(); err != nil {
		return err
	}

	mode := os.FileMode(0o755)
	if current, err := os.Stat(b.Path); err == nil {
		mode = current.Mode().Perm() | 0o111
	}
	if err := os.Chmod(next.Name(), mode); err != nil {
		return err
	}

	if err := reports(ctx, next.Name(), release); err != nil {
		return err
	}

	if err := os.Rename(next.Name(), b.Path); err != nil {
		return fmt.Errorf("replace %s: %w", b.Path, err)
	}

	return nil
}

func (b *Binary) fetch(ctx context.Context, url string, largest int64) ([]byte, error) {
	var out bytes.Buffer
	if _, err := b.get(ctx, url, &out, largest); err != nil {
		return nil, err
	}
	return out.Bytes(), nil
}

func (b *Binary) download(ctx context.Context, url string, to io.Writer) (string, error) {
	hash := sha256.New()
	if _, err := b.get(ctx, url, io.MultiWriter(to, hash), binaryLargest); err != nil {
		return "", err
	}
	return hex.EncodeToString(hash.Sum(nil)), nil
}

func (b *Binary) get(ctx context.Context, url string, to io.Writer, largest int64) (int64, error) {
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return 0, err
	}

	response, err := b.Client.Do(request)
	if err != nil {
		return 0, err
	}
	defer response.Body.Close()

	if response.StatusCode != http.StatusOK {
		return 0, fmt.Errorf("%s answered %s", url, response.Status)
	}

	n, err := io.Copy(to, io.LimitReader(response.Body, largest+1))
	if err != nil {
		return n, err
	}
	if n > largest {
		return n, fmt.Errorf("%s is larger than %d bytes", url, largest)
	}
	return n, nil
}

func reports(ctx context.Context, binary, release string) error {
	ctx, cancel := context.WithTimeout(ctx, versionLongest)
	defer cancel()

	out, err := exec.CommandContext(ctx, binary, "version").Output()
	if err != nil {
		return fmt.Errorf("the downloaded binary does not run on this machine: %w", err)
	}

	if got := strings.TrimSpace(string(out)); got != release && release != Canary {
		return fmt.Errorf("the downloaded binary reports release %q, not %q", got, release)
	}
	return nil
}
