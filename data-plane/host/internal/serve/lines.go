package serve

import (
	"bytes"
	"log/slog"
	"strings"
	"sync"
)

type lines struct {
	buffer bytes.Buffer
}

func (l *lines) Write(p []byte) (int, error) { return l.buffer.Write(p) }

func (l *lines) last() string {
	said := strings.Split(strings.TrimSpace(l.buffer.String()), "\n")
	return said[len(said)-1]
}

type echo struct {
	log *slog.Logger

	mu      sync.Mutex
	pending []byte
}

func (e *echo) Write(p []byte) (int, error) {
	e.mu.Lock()
	defer e.mu.Unlock()

	e.pending = append(e.pending, p...)
	for {
		end := bytes.IndexByte(e.pending, '\n')
		if end < 0 {
			return len(p), nil
		}

		if line := strings.TrimSpace(string(e.pending[:end])); line != "" {
			e.log.Info("sandbox", "said", line)
		}
		e.pending = e.pending[end+1:]
	}
}
