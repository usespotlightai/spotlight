package archive

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"

	"usespotlight.ai/data-plane/protocol"
)

const transferTimeout = 30 * time.Minute

func storage(transport http.RoundTripper) *http.Client {
	return &http.Client{Timeout: transferTimeout, Transport: transport}
}

func Upload(ctx context.Context, transport http.RoundTripper, grant protocol.ArchiveGrant, packed *Packed) error {
	file, err := os.Open(packed.Path)
	if err != nil {
		return err
	}
	defer file.Close()

	request, err := http.NewRequestWithContext(ctx, http.MethodPut, grant.URL, file)
	if err != nil {
		return fmt.Errorf("upload the workspace: %w", err)
	}
	request.ContentLength = packed.Size
	for name, value := range grant.Headers {
		request.Header.Set(name, value)
	}

	response, err := storage(transport).Do(request)
	if err != nil {
		return fmt.Errorf("upload the workspace: %w", err)
	}
	defer response.Body.Close()

	if response.StatusCode >= 300 {
		return fmt.Errorf("upload the workspace: storage answered %s: %s", response.Status, detail(response))
	}

	return nil
}

type Fetched struct {
	file *os.File
}

func (f *Fetched) UnpackInto(dir string) error {
	return Unpack(f.file, dir)
}

func (f *Fetched) Remove() error {
	if f == nil {
		return nil
	}
	f.file.Close()
	return os.Remove(f.file.Name())
}

func Fetch(ctx context.Context, transport http.RoundTripper, stored protocol.StoredArchive, scratch string) (*Fetched, error) {
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, stored.URL, nil)
	if err != nil {
		return nil, fmt.Errorf("fetch the workspace: %w", err)
	}

	response, err := storage(transport).Do(request)
	if err != nil {
		return nil, fmt.Errorf("fetch the workspace: %w", err)
	}
	defer response.Body.Close()

	if response.StatusCode >= 300 {
		return nil, fmt.Errorf("fetch the workspace: storage answered %s: %s", response.Status, detail(response))
	}

	file, err := os.CreateTemp(scratch, "workspace-*.tar.gz")
	if err != nil {
		return nil, fmt.Errorf("make room to fetch the workspace: %w", err)
	}

	sum := sha256.New()
	copied, err := io.Copy(io.MultiWriter(file, sum), io.LimitReader(response.Body, stored.Size+1))
	if err == nil && (copied != stored.Size || hex.EncodeToString(sum.Sum(nil)) != stored.SHA256) {
		err = fmt.Errorf("the workspace fetched is not the one stored: %d bytes, expected %d", copied, stored.Size)
	}
	if err == nil {
		_, err = file.Seek(0, io.SeekStart)
	}
	if err != nil {
		file.Close()
		os.Remove(file.Name())
		return nil, fmt.Errorf("fetch the workspace: %w", err)
	}

	return &Fetched{file: file}, nil
}

func detail(response *http.Response) string {
	body, _ := io.ReadAll(io.LimitReader(response.Body, 512))
	return strings.TrimSpace(string(body))
}
