package session

import (
	"context"
	"encoding/json"
	"fmt"
	"path/filepath"
	"slices"
	"strconv"
	"strings"
	"sync"
	"time"

	"usespotlight.ai/data-plane/protocol"
)

const memorySpanName = "spotlight.memory"

const maxDeliveredAtOnce = 5

const maxUnrecorded = 45

const deliveryRecordTimeout = 3 * time.Second

type pathMemory struct {
	handle   string
	headline string
	text     string
	paths    []string
}

type delivery struct {
	path     string
	memories []pathMemory
}

type pathMemories struct {
	roots     []string
	dir       string
	checkouts []protocol.Checkout
	memories  []pathMemory
	delivered func(ctx context.Context, handles, paths []string) error

	mu         sync.Mutex
	shown      map[string]bool
	queued     []string
	isQueued   map[string]bool
	unrecorded []string
}

func newPathMemories(
	dir string,
	checkouts []protocol.Checkout,
	files []protocol.MemoryFile,
	delivered func(ctx context.Context, handles, paths []string) error,
) *pathMemories {
	roots := []string{filepath.Clean(dir)}
	if resolved, err := filepath.EvalSymlinks(dir); err == nil && resolved != roots[0] {
		roots = append(roots, resolved)
	}

	index := &pathMemories{
		roots:     roots,
		dir:       dir,
		checkouts: checkouts,
		delivered: delivered,
		shown:     map[string]bool{},
		isQueued:  map[string]bool{},
	}

	for _, file := range files {
		if file.Briefed || file.Elsewhere || file.Handle == "" || file.Repository == nil || len(file.Paths) == 0 {
			continue
		}
		if slices.ContainsFunc(index.memories, func(each pathMemory) bool { return each.handle == file.Handle }) {
			continue
		}

		folder, found := checkoutFolderOf(checkouts, *file.Repository)
		if !found {
			continue
		}

		headline, text := memoryTextOf(file)
		memory := pathMemory{handle: file.Handle, headline: headline, text: text}
		for _, each := range file.Paths {
			memory.paths = append(memory.paths, folder+"/"+strings.Trim(filepath.ToSlash(each), "/"))
		}
		index.memories = append(index.memories, memory)
	}

	return index
}

func checkoutFolderOf(checkouts []protocol.Checkout, repository protocol.MemoryFileRepository) (string, bool) {
	named := strings.ToLower(repository.Owner + "/" + repository.Name)

	for _, checkout := range checkouts {
		folder := filepath.ToSlash(filepath.Clean(checkout.Path))
		if !strings.EqualFold(filepath.Base(folder), repository.Name) {
			continue
		}
		remote := strings.TrimSuffix(strings.ToLower(checkout.Remote), ".git")
		if remote == "" || strings.HasSuffix(remote, "/"+named) || strings.HasSuffix(remote, ":"+named) {
			return folder, true
		}
	}

	return "", false
}

func memoryTextOf(file protocol.MemoryFile) (string, string) {
	heading, rest, _ := strings.Cut(file.Body, "\n")
	headline := strings.TrimSpace(strings.TrimPrefix(heading, "#"))
	if _, kind, found := strings.Cut(headline, " · "); found {
		headline = kind
	}

	text, _, _ := strings.Cut(strings.TrimSpace(rest), "\n\n- Applies to:")

	return headline, strings.Join(strings.Fields(text), " ")
}

func (p *pathMemories) empty() bool {
	return p == nil || len(p.memories) == 0
}

func (p *pathMemories) saw(event protocol.Event) {
	if p.empty() || event.Type != protocol.EventToolChanged {
		return
	}

	var changed protocol.ToolChanged
	if json.Unmarshal(event.Data, &changed) != nil {
		return
	}

	used := make([]string, 0, len(changed.Locations)+len(changed.Files)+1)
	for _, location := range changed.Locations {
		used = append(used, location.Path)
	}
	for _, file := range changed.Files {
		used = append(used, file.Path, file.OldPath)
	}
	used = append(used, inputPaths(changed.Input)...)

	p.mu.Lock()
	defer p.mu.Unlock()
	for _, each := range used {
		if each != "" && p.awaitsShowing(each) {
			p.enqueue(each)
		}
	}
}

func (p *pathMemories) awaitsShowing(raw string) bool {
	relative, found := p.relative(raw)
	if !found {
		return false
	}

	return slices.ContainsFunc(p.memories, func(memory pathMemory) bool {
		return !p.shown[memory.handle] && memory.about(relative)
	})
}

func (p *pathMemories) enqueue(raw string) {
	if p.isQueued[raw] {
		return
	}
	p.isQueued[raw] = true
	p.queued = append(p.queued, raw)
}

func inputPaths(input json.RawMessage) []string {
	var named map[string]json.RawMessage
	if json.Unmarshal(input, &named) != nil {
		return nil
	}

	found := []string{}
	for _, key := range []string{"file_path", "path", "notebook_path"} {
		var value string
		if json.Unmarshal(named[key], &value) == nil && value != "" {
			found = append(found, value)
		}
	}

	return found
}

func (p *pathMemories) touched(ctx context.Context, used []string) string {
	if p.empty() {
		return ""
	}

	return p.deliver(ctx, used)
}

func (p *pathMemories) pending(ctx context.Context) string {
	if p.empty() {
		return ""
	}

	p.mu.Lock()
	queued := p.queued
	p.queued = nil
	p.isQueued = map[string]bool{}
	p.mu.Unlock()

	return p.deliver(ctx, queued)
}

func (p *pathMemories) deliver(ctx context.Context, used []string) string {
	p.mu.Lock()
	deliveries := []delivery{}
	handles, paths, left := []string{}, []string{}, []string{}
	for _, raw := range used {
		relative, found := p.relative(raw)
		if !found {
			continue
		}

		matched := []pathMemory{}
		for _, memory := range p.memories {
			if p.shown[memory.handle] || !memory.about(relative) {
				continue
			}
			if len(handles) >= maxDeliveredAtOnce {
				if !slices.Contains(left, raw) {
					left = append(left, raw)
				}
				continue
			}
			p.shown[memory.handle] = true
			matched = append(matched, memory)
			handles = append(handles, memory.handle)
		}

		if len(matched) > 0 {
			deliveries = append(deliveries, delivery{path: relative, memories: matched})
			paths = append(paths, relative)
		}
	}
	for _, each := range left {
		p.enqueue(each)
	}
	recording := append(p.unrecorded, handles...)
	p.unrecorded = nil
	p.mu.Unlock()

	if len(recording) > 0 && p.delivered != nil {
		recordingCtx, cancel := context.WithTimeout(context.WithoutCancel(ctx), deliveryRecordTimeout)
		err := p.delivered(recordingCtx, recording, paths)
		cancel()
		if err != nil {
			p.mu.Lock()
			p.unrecorded = append(recording, p.unrecorded...)
			if len(p.unrecorded) > maxUnrecorded {
				p.unrecorded = p.unrecorded[len(p.unrecorded)-maxUnrecorded:]
			}
			p.mu.Unlock()
		}
	}

	if len(handles) == 0 {
		return ""
	}

	return deliveredNote(deliveries)
}

func (p *pathMemories) relative(raw string) (string, bool) {
	if !filepath.IsAbs(raw) {
		raw = filepath.Join(p.dir, raw)
	}

	return checkedOutPath(p.roots, p.checkouts, raw)
}

func (m pathMemory) about(relative string) bool {
	return slices.ContainsFunc(m.paths, func(each string) bool {
		return relative == each || strings.HasPrefix(relative, each+"/")
	})
}

func deliveredNote(deliveries []delivery) string {
	parts := make([]string, 0, len(deliveries))
	for _, each := range deliveries {
		lines := []string{fmt.Sprintf("The team remembers this about `%s`, which you just used:", each.path)}
		for _, memory := range each.memories {
			lines = append(lines, fmt.Sprintf("- **%s** · %s: %s", memory.handle, memory.headline, memory.text))
		}
		parts = append(parts, strings.Join(lines, "\n"))
	}

	return strings.Join(parts, "\n\n")
}

func deliveredSpan(handles, paths []string, from, to time.Time, err error) json.RawMessage {
	span := recallSpan{
		TraceID: randomHex(16),
		SpanID:  randomHex(8),
		Name:    memorySpanName,
		Start:   strconv.FormatInt(from.UnixNano(), 10),
		End:     strconv.FormatInt(to.UnixNano(), 10),
		Attributes: []spanAttribute{
			{Key: "spotlight.memory.handles", Value: spanValue{StringValue: strings.Join(handles, ",")}},
			{Key: "spotlight.memory.paths", Value: spanValue{StringValue: strings.Join(paths, ",")}},
		},
	}
	if err != nil {
		span.Status = &spanStatus{Code: spanFailed, Message: err.Error()}
	}

	written, _ := json.Marshal(span)
	return written
}
