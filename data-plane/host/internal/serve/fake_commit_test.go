package serve_test

import (
	"context"
	"fmt"
	"io"
	"strings"
	"time"

	"usespotlight.ai/data-plane/host/internal/sandbox"
)

type committed struct {
	sandbox string
	commit  sandbox.Commit
	image   string
	at      time.Time
	files   map[string][]byte
}

type intoClaim struct {
	sandbox string
	at      time.Time
}

type endedStream struct{ io.Reader }

func (endedStream) Write(body []byte) (int, error) { return len(body), nil }
func (endedStream) Close() error                   { return nil }

func ended(output string) io.ReadWriteCloser { return endedStream{strings.NewReader(output)} }

func (e *fakeEngine) Changes(_ context.Context, id string) ([]sandbox.Change, error) {
	e.mu.Lock()
	defer e.mu.Unlock()
	if changes, ok := e.changes[id]; ok {
		return changes, nil
	}
	return []sandbox.Change{
		{Path: "/workspace", Kind: sandbox.Modified},
		{Path: "/workspace/web", Kind: sandbox.Added},
		{Path: "/workspace/web/node_modules", Kind: sandbox.Added},
		{Path: "/home/agent/.npm", Kind: sandbox.Added},
		{Path: "/var/lib/spotlight/setups.json", Kind: sandbox.Added},
	}, nil
}

func (e *fakeEngine) Commit(_ context.Context, id string, commit sandbox.Commit) (string, error) {
	e.mu.Lock()
	defer e.mu.Unlock()

	layers := 1
	if from, ok := e.started[id]; ok {
		for _, each := range e.images {
			if each.ID == from.Image {
				layers = each.Layers + 1
			}
		}
	}
	image := fmt.Sprintf("sha256:setup%d", len(e.commits)+1)
	e.images[commit.Repository+":"+commit.Tag] = sandbox.Image{ID: image, Labels: commit.Labels, Layers: layers, Size: 2_000_000}
	files := map[string][]byte{}
	for path, file := range e.put[id] {
		files[path] = file.Body
	}
	e.commits = append(e.commits, committed{sandbox: id, commit: commit, image: image, at: time.Now(), files: files})
	return image, nil
}

func (e *fakeEngine) committedImages() []committed {
	e.mu.Lock()
	defer e.mu.Unlock()
	return append([]committed(nil), e.commits...)
}
