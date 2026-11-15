package serve

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"maps"
	"os"
	"slices"
	"strconv"
	"strings"
	"time"

	"usespotlight.ai/data-plane/host/internal/sandbox"
	"usespotlight.ai/data-plane/protocol"
)

const (
	LabelSetupKey   = "ai.usespotlight.setup-key"
	LabelBaseDigest = "ai.usespotlight.base-digest"
	LabelBuiltAt    = "ai.usespotlight.built-at"

	SetupRepository = "spotlight-setup"

	setupLayersAboveBase = 3
	setupImagesKept      = 8
	setupImageUnused     = 7 * 24 * time.Hour
	setupWait            = 15 * time.Minute
	setupPoll            = time.Second
	setupCommitLongest   = 10 * time.Minute
	setupUnchecked       = 15 * time.Minute
)

var errNotPutBack = errors.New("could not put a runner file back after the setup image")

var (
	setupImageHolds = []string{"/workspace", "/home", protocol.SetupRecordPath}
	setupImageDirs  = []string{"/", "/home", "/var", "/var/lib", "/var/lib/spotlight", "/run", "/run/spotlight",
		"/etc", "/etc/spotlight", "/etc/spotlight/egress", "/tmp", "/usr", "/usr/sbin", "/spotlight", MirrorRoot,
		protocol.SandboxEditorServers}
	// The container runtime puts these in every container it starts, so an image from the runner image holds them too.
	addedByTheRuntime = []string{"/usr/sbin/docker-init",
		"/usr/local", "/usr/local/share", "/usr/local/share/ca-certificates", "/usr/local/share/ca-certificates/orbstack-root.crt",
		"/etc/ssl", "/etc/ssl/certs", "/etc/ssl/certs/orbstack-root.crt", "/etc/ssl/certs/ca-certificates.crt",
		"/etc/ca-certificates", "/etc/ca-certificates/trust-source", "/etc/ca-certificates/trust-source/anchors",
		"/etc/ca-certificates/trust-source/anchors/orbstack-root.crt"}
	setAside      = []string{protocol.SandboxWorkspaceOpen, AuthorityPath, BundlePath}
	systemBundles = []string{"/etc/ssl/certs/ca-certificates.crt", "/etc/pki/tls/certs/ca-bundle.crt", "/etc/ssl/cert.pem"}
	resolvedPaths = `for path in "$@"; do if [ -e "$path" ]; then readlink -f "$path"; fi; done`
)

type setupStart struct {
	key    string
	base   string
	digest string
	image  string
	from   string
	build  bool
}

func setupKey(workspace, line, digest string, setups map[string]string) string {
	if workspace == "" || line == "" || digest == "" || !slices.ContainsFunc(slices.Collect(maps.Values(setups)), func(setup string) bool { return setup != "" }) {
		return ""
	}
	paths := slices.Sorted(maps.Keys(setups))
	hash := sha256.New()
	fmt.Fprintf(hash, "%s\x00%s\x00%s\x00", workspace, line, digest)
	for _, path := range paths {
		fmt.Fprintf(hash, "%s\x00%s\x00", path, setups[path])
	}
	return hex.EncodeToString(hash.Sum(nil))
}

func setupsOf(work protocol.ClaimResponse) (string, map[string]string) {
	line, setups := "", map[string]string{}
	add := func(path, setup string) { setups[path] = strings.TrimSpace(setup) }
	switch {
	case work.Warm != nil:
		line = work.Warm.Line
		for _, each := range work.Warm.Checkouts {
			add(each.Path, each.Setup)
		}
	case work.Run != nil:
		line = work.Run.Line
		for _, each := range work.Run.Spec.Checkouts {
			add(each.Path, each.Setup)
		}
	}
	return line, setups
}

func (h *Host) setupStart(ctx context.Context, assignment protocol.Assignment, ready examined, log *slog.Logger) setupStart {
	line, setups := setupsOf(assignment.Work)
	start := setupStart{base: ready.id, digest: ready.digest, image: ready.id,
		key: setupKey(h.workspace, line, ready.digest, setups)}
	if start.key == "" {
		return start
	}
	start.build = assignment.StartsSandboxOnly() && assignment.Work.Warm != nil

	found, ok := h.setupImage(ctx, start.key, ready.digest, log)
	if !ok {
		return start
	}
	if start.build {
		base, err := h.engine.Inspect(ctx, ready.id)
		if err != nil {
			log.Warn("could not read the runner image's layers, so the warm sandbox starts from it", "error", err)
			return start
		}
		if found.Layers >= base.Layers+setupLayersAboveBase {
			log.Info("the setup image has too many layers, so the warm sandbox starts from the runner image and builds a new one",
				"setupImage", found.ID, "layers", found.Layers)
			return start
		}
	}

	start.image, start.from = found.ID, found.ID
	h.mu.Lock()
	h.setupUsed[found.ID] = time.Now()
	h.setupStarts[found.ID]++
	h.mu.Unlock()
	return start
}

func (h *Host) setupStarted(start setupStart) {
	if start.from == "" {
		return
	}
	h.mu.Lock()
	defer h.mu.Unlock()
	if h.setupStarts[start.from]--; h.setupStarts[start.from] <= 0 {
		delete(h.setupStarts, start.from)
	}
}

func checked(image sandbox.Image) bool {
	return slices.ContainsFunc(image.Tags, func(tag string) bool { return strings.HasPrefix(tag, SetupRepository+":") })
}

func (h *Host) setupImage(ctx context.Context, key, digest string, log *slog.Logger) (sandbox.Image, bool) {
	found, err := h.engine.Images(ctx)
	if err != nil {
		log.Warn("could not list the setup images, so the sandbox starts from the runner image", "error", err)
		return sandbox.Image{}, false
	}

	var newest sandbox.Image
	var newestAt time.Time
	for _, each := range found {
		if each.Labels[LabelSetupKey] != key || each.Labels[LabelBaseDigest] != digest || !checked(each) {
			continue
		}
		if at := builtAt(each); newest.ID == "" || at.After(newestAt) {
			newest, newestAt = each, at
		}
	}
	if newest.ID == "" {
		return sandbox.Image{}, false
	}

	inspected, err := h.engine.Inspect(ctx, newest.ID)
	if err != nil {
		log.Warn("could not read the setup image, so the sandbox starts from the runner image", "setupImage", newest.ID, "error", err)
		return sandbox.Image{}, false
	}
	return inspected, true
}

func builtAt(image sandbox.Image) time.Time {
	at, _ := time.Parse(time.RFC3339Nano, image.Labels[LabelBuiltAt])
	return at
}

func (h *Host) buildSetupImage(ctx context.Context, live liveSandbox, gone <-chan struct{}, log *slog.Logger) error {
	setup := live.setup
	log = log.With("setupKey", setup.key)

	if !h.workspaceOpened(ctx, live.id, gone) {
		if ctx.Err() == nil {
			log.Warn("the warm sandbox did not open its workspace in time, so no setup image is made")
		}
		return nil
	}

	record, err := h.setupRecord(ctx, live.id)
	switch {
	case err != nil:
		log.Warn("could not read the warm sandbox's setups, so no setup image is made", "error", err)
		return nil
	case !record.Complete:
		log.Info("a warm setup failed, so no setup image is made")
		return nil
	case !record.Ran:
		log.Info("the warm sandbox's setup image is up to date", "setupImage", setup.from)
		return nil
	}

	if !h.claimSetupBuild(setup.key) {
		log.Info("another sandbox makes this setup image")
		return nil
	}
	defer h.releaseSetupBuild(setup.key)

	floor := h.now().SetupImageFloor
	free, err := h.freeDisk(ctx, live.id)
	switch {
	case err != nil:
		log.Warn("could not read the free disk, so no setup image is made", "error", err)
		return nil
	case free < floor:
		log.Warn("the disk is below the setup image floor, so no setup image is made",
			"freeBytes", free, "floorBytes", floor)
		return nil
	}

	started := time.Now()
	image, err := h.commitSetup(ctx, live, gone, log)
	if errors.Is(err, errNotPutBack) {
		return err
	}
	if err != nil {
		log.Warn("could not make a setup image; the sandbox serves runs as before", "error", err)
		return nil
	}

	took := time.Since(started)
	added := int64(0)
	from := setup.from
	if from == "" {
		from = setup.base
	}
	made, madeErr := h.engine.Inspect(ctx, image)
	before, beforeErr := h.engine.Inspect(ctx, from)
	if madeErr == nil && beforeErr == nil {
		added = made.Size - before.Size
	}
	log.Info("committed a setup image", "setupImage", image, "from", setup.from, "addedMegabytes", added/1_000_000,
		"took", took, "freeBytes", free)

	h.removeSetupImages(ctx, setup.key, image)
	return nil
}

func (h *Host) workspaceOpened(ctx context.Context, id string, gone <-chan struct{}) bool {
	waiting, cancel := context.WithTimeout(ctx, setupWait)
	defer cancel()
	poll := time.NewTicker(setupPoll)
	defer poll.Stop()

	for {
		if _, err := h.engine.Read(waiting, id, protocol.SandboxWorkspaceOpen); err == nil {
			return true
		}
		select {
		case <-waiting.Done():
			return false
		case <-gone:
			return false
		case <-poll.C:
		}
	}
}

func (h *Host) setupRecord(ctx context.Context, id string) (protocol.SetupRecord, error) {
	body, err := h.engine.Read(ctx, id, protocol.SetupRecordPath)
	if err != nil {
		return protocol.SetupRecord{}, err
	}
	var record protocol.SetupRecord
	if err := json.Unmarshal(body, &record); err != nil {
		return protocol.SetupRecord{}, fmt.Errorf("read %s: %w", protocol.SetupRecordPath, err)
	}
	return record, nil
}

func (h *Host) claimSetupBuild(key string) bool {
	h.mu.Lock()
	defer h.mu.Unlock()
	if h.setupBuilds[key] {
		return false
	}
	h.setupBuilds[key] = true
	return true
}

func (h *Host) releaseSetupBuild(key string) {
	h.mu.Lock()
	defer h.mu.Unlock()
	delete(h.setupBuilds, key)
}

func (h *Host) freeDisk(ctx context.Context, id string) (int64, error) {
	output, err := h.output(ctx, id, []string{"df", "-Pk", "/"})
	if err != nil {
		return 0, err
	}
	lines := strings.Split(strings.TrimSpace(output), "\n")
	if len(lines) < 2 {
		return 0, fmt.Errorf("df answered %q", output)
	}
	fields := strings.Fields(lines[len(lines)-1])
	if len(fields) < 4 {
		return 0, fmt.Errorf("df answered %q", output)
	}
	kilobytes, err := strconv.ParseInt(fields[3], 10, 64)
	if err != nil {
		return 0, fmt.Errorf("df answered %q: %w", output, err)
	}
	return kilobytes * 1024, nil
}

func (h *Host) output(ctx context.Context, id string, command []string) (string, error) {
	var errs strings.Builder
	stream, err := h.engine.Exec(ctx, id, command, &errs)
	if err != nil {
		return "", err
	}
	defer stream.Close()
	body, err := io.ReadAll(stream)
	if err != nil {
		return "", fmt.Errorf("%s: %w: %s", command[0], err, errs.String())
	}
	return string(body), nil
}

func (h *Host) commitSetup(ctx context.Context, live liveSandbox, gone <-chan struct{}, log *slog.Logger) (image string, err error) {
	base, err := h.engine.Inspect(ctx, live.setup.base)
	if err != nil {
		return "", fmt.Errorf("read the runner image: %w", err)
	}
	if volume := heldVolume(base.Volumes); volume != "" {
		return "", fmt.Errorf("the runner image keeps %s in a volume, which a setup image does not hold", volume)
	}

	aside := map[string][]byte{}
	var order []string
	keep := func(path string, body []byte) {
		aside[path] = body
		order = append(order, path)
	}
	defer func() {
		select {
		case <-gone:
			return
		default:
		}
		restoring, cancel := context.WithTimeout(context.WithoutCancel(ctx), cleanupBudget)
		defer cancel()
		for _, path := range order {
			if putErr := h.engine.Put(restoring, live.id, sandbox.File{Path: path, Mode: 0o644, DirMode: 0o755, Body: aside[path]}); putErr != nil {
				err = errors.Join(err, fmt.Errorf("%w: %s: %w", errNotPutBack, path, putErr))
			}
		}
	}()

	for _, path := range setAside {
		body, err := h.engine.Read(ctx, live.id, path)
		switch {
		case errors.Is(err, os.ErrNotExist):
		case err != nil:
			return "", fmt.Errorf("read %s: %w", path, err)
		default:
			keep(path, body)
		}
	}
	if err := h.untrustRunAuthorities(ctx, live, aside[AuthorityPath], keep); err != nil {
		return "", err
	}

	if _, err := h.output(ctx, live.id, append([]string{"rm", "-f", "--"}, setAside...)); err != nil {
		return "", fmt.Errorf("set the runner's files aside: %w", err)
	}
	for _, path := range setAside {
		if _, err := h.engine.Read(ctx, live.id, path); !errors.Is(err, os.ErrNotExist) {
			return "", fmt.Errorf("could not set %s aside: %w", path, err)
		}
	}

	changes, err := h.engine.Changes(ctx, live.id)
	if err != nil {
		return "", err
	}
	if refused := refusedChange(changes); refused != "" {
		return "", fmt.Errorf("the sandbox changed %s, which a setup image does not keep", refused)
	}

	committing, cancel := context.WithTimeout(ctx, setupCommitLongest)
	defer cancel()
	return h.engine.Commit(committing, live.id, sandbox.Commit{
		Repository: SetupRepository,
		Tag:        live.setup.key[:16],
		ConfigFrom: live.setup.base,
		Labels: map[string]string{
			LabelSetupKey:   live.setup.key,
			LabelBaseDigest: live.setup.digest,
			LabelBuiltAt:    time.Now().UTC().Format(time.RFC3339Nano),
		},
	})
}

func (h *Host) dropSetupImage(ctx context.Context, id string, log *slog.Logger) {
	h.mu.Lock()
	starting := h.setupStarts[id] > 0
	h.mu.Unlock()
	if starting {
		return
	}
	image, err := h.engine.Inspect(ctx, id)
	if err == nil {
		err = h.removeImage(ctx, image)
	}
	switch {
	case errors.Is(err, sandbox.ErrInUse):
	case err != nil:
		log.Warn("could not remove the setup image that did not start", "setupImage", id, "error", err)
	default:
		h.mu.Lock()
		delete(h.setupUsed, id)
		h.mu.Unlock()
		log.Info("removed a setup image", "setupImage", id, "setupKey", image.Labels[LabelSetupKey],
			"reason", "a sandbox could not start from it", "megabytes", image.Size/1_000_000)
	}
}

func heldVolume(volumes []string) string {
	for _, volume := range volumes {
		volume = strings.TrimSuffix(volume, "/")
		if volume == "" || slices.ContainsFunc(setupImageHolds, func(root string) bool {
			return volume == root || strings.HasPrefix(volume, root+"/") || strings.HasPrefix(root, volume+"/")
		}) {
			return volume + "/"
		}
	}
	return ""
}

func (h *Host) untrustRunAuthorities(ctx context.Context, live liveSandbox, authority []byte, keep func(string, []byte)) error {
	var authorities [][]byte
	for _, each := range [][]byte{authority, live.sidecar.authorityPEM()} {
		if trimmed := bytes.TrimSpace(each); len(trimmed) > 0 {
			authorities = append(authorities, trimmed)
		}
	}
	if len(authorities) == 0 {
		return nil
	}

	resolved, err := h.output(ctx, live.id, append([]string{"sh", "-c", resolvedPaths, "sh"}, systemBundles...))
	if err != nil {
		return fmt.Errorf("find the system's trusted authorities: %w", err)
	}
	var seen []string
	for _, path := range strings.Fields(resolved) {
		if slices.Contains(seen, path) {
			continue
		}
		seen = append(seen, path)
		body, err := h.engine.Read(ctx, live.id, path)
		if err != nil {
			return fmt.Errorf("read %s: %w", path, err)
		}
		cleaned := withoutAuthorities(body, authorities)
		if bytes.Equal(cleaned, body) {
			continue
		}
		keep(path, body)
		if err := h.engine.Put(ctx, live.id, sandbox.File{Path: path, Mode: 0o644, DirMode: 0o755, Body: cleaned}); err != nil {
			return fmt.Errorf("leave the run's authority out of %s: %w", path, err)
		}
	}
	return nil
}

func withoutAuthorities(bundle []byte, authorities [][]byte) []byte {
	cleaned := bytes.Clone(bundle)
	for _, authority := range authorities {
		cleaned = bytes.ReplaceAll(cleaned, append(bytes.Clone(authority), '\n'), nil)
		cleaned = bytes.ReplaceAll(cleaned, authority, nil)
	}
	return cleaned
}

func refusedChange(changes []sandbox.Change) string {
	for _, change := range changes {
		if change.Kind != sandbox.Deleted && (slices.Contains(setupImageDirs, change.Path) || slices.Contains(addedByTheRuntime, change.Path)) {
			continue
		}
		if !slices.ContainsFunc(setupImageHolds, func(root string) bool {
			return change.Path == root || strings.HasPrefix(change.Path, root+"/")
		}) {
			return change.Path
		}
	}
	return ""
}

func (h *Host) removeSetupImages(ctx context.Context, newKey, newImage string) {
	found, err := h.engine.Images(ctx)
	if err != nil {
		h.log.Warn("could not list the setup images to remove old ones", "error", err)
		return
	}

	h.mu.Lock()
	digests := map[string]bool{}
	for _, each := range h.served {
		if each.digest != "" {
			digests[each.digest] = true
		}
	}
	lastUse := func(image sandbox.Image) time.Time {
		at := builtAt(image)
		if used := h.setupUsed[image.ID]; used.After(at) {
			at = used
		}
		return at
	}
	var setups []sandbox.Image
	uses := map[string]time.Time{}
	starting := map[string]bool{}
	for _, each := range found {
		if each.Labels[LabelSetupKey] != "" {
			setups = append(setups, each)
			uses[each.ID] = lastUse(each)
			starting[each.ID] = h.setupStarts[each.ID] > 0
		}
	}
	h.mu.Unlock()

	slices.SortFunc(setups, func(a, b sandbox.Image) int { return uses[b.ID].Compare(uses[a.ID]) })

	newest := map[string]string{}
	if newKey != "" {
		newest[newKey] = newImage
	}
	for _, each := range setups {
		if key := each.Labels[LabelSetupKey]; newest[key] == "" && checked(each) {
			newest[key] = each.ID
		}
	}

	kept := 0
	for _, each := range setups {
		if starting[each.ID] {
			continue
		}
		reason := ""
		switch key := each.Labels[LabelSetupKey]; {
		case !checked(each) && time.Since(builtAt(each)) < setupUnchecked:
			continue
		case !checked(each):
			reason = "it was never checked"
		case len(digests) > 0 && !digests[each.Labels[LabelBaseDigest]]:
			reason = "its runner image is no longer served"
		case newest[key] != each.ID:
			reason = "a newer setup image replaces it"
		case time.Since(uses[each.ID]) > setupImageUnused:
			reason = "no sandbox used it for a week"
		case kept >= setupImagesKept:
			reason = "the host keeps only its most used setup images"
		default:
			kept++
			continue
		}

		if err := h.removeImage(ctx, each); err != nil {
			if !errors.Is(err, sandbox.ErrInUse) {
				h.log.Warn("could not remove a setup image", "setupImage", each.ID, "error", err)
			}
			continue
		}
		h.mu.Lock()
		delete(h.setupUsed, each.ID)
		h.mu.Unlock()
		h.log.Info("removed a setup image", "setupImage", each.ID, "setupKey", each.Labels[LabelSetupKey],
			"reason", reason, "megabytes", each.Size/1_000_000)
	}
}
