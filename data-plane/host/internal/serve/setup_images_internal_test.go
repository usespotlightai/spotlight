package serve

import (
	"context"
	"io"
	"log/slog"
	"slices"
	"testing"
	"time"

	"usespotlight.ai/data-plane/host/internal/sandbox"
	"usespotlight.ai/data-plane/protocol"
)

func TestASetupKeyBelongsToOneWorkspaceLineRunnerImageAndSetup(t *testing.T) {
	setups := map[string]string{"web": "npm ci", "api": "go mod download"}
	key := setupKey("workspace_1", "line_1", "runner@sha256:a", setups)

	for name, other := range map[string]string{
		"another workspace":    setupKey("workspace_2", "line_1", "runner@sha256:a", setups),
		"another line":         setupKey("workspace_1", "line_2", "runner@sha256:a", setups),
		"another runner image": setupKey("workspace_1", "line_1", "runner@sha256:b", setups),
		"another setup":        setupKey("workspace_1", "line_1", "runner@sha256:a", map[string]string{"web": "npm install", "api": "go mod download"}),
		"one checkout fewer":   setupKey("workspace_1", "line_1", "runner@sha256:a", map[string]string{"web": "npm ci"}),
		"one more checkout":    setupKey("workspace_1", "line_1", "runner@sha256:a", map[string]string{"web": "npm ci", "api": "go mod download", "docs": ""}),
	} {
		if other == key {
			t.Errorf("%s has the same key", name)
		}
	}
	if again := setupKey("workspace_1", "line_1", "runner@sha256:a", map[string]string{"api": "go mod download", "web": "npm ci"}); again != key {
		t.Error("the key depends on the order of the checkouts")
	}
	for name, none := range map[string]string{
		"no setup":     setupKey("workspace_1", "line_1", "runner@sha256:a", map[string]string{"docs": ""}),
		"no workspace": setupKey("", "line_1", "runner@sha256:a", setups),
		"no line":      setupKey("workspace_1", "", "runner@sha256:a", setups),
		"no digest":    setupKey("workspace_1", "line_1", "", setups),
	} {
		if none != "" {
			t.Errorf("%s has key %q", name, none)
		}
	}
}

func TestAWarmSandboxAndARunOfTheSameLineHaveOneKey(t *testing.T) {
	warmLine, warm := setupsOf(protocol.ClaimResponse{Warm: &protocol.WarmSandbox{Line: "line_1", Checkouts: []protocol.WarmCheckout{
		{Path: "web", Setup: "npm ci\n"}, {Path: "docs"},
	}}})
	runLine, run := setupsOf(protocol.ClaimResponse{Run: &protocol.Run{Line: "line_1", Spec: protocol.Spec{Checkouts: []protocol.Checkout{
		{Path: "web", Setup: " npm ci", Remote: "https://github.com/acme/web", Branch: "feat/x"}, {Path: "docs", Remote: "https://github.com/acme/docs"},
	}}}})
	if setupKey("w", warmLine, "d", warm) != setupKey("w", runLine, "d", run) {
		t.Errorf("warm %s %v and run %s %v have different keys", warmLine, warm, runLine, run)
	}
}

func TestASetupImageKeepsOnlyWhatSetupPutsInPlace(t *testing.T) {
	kept := []sandbox.Change{
		{Path: "/", Kind: sandbox.Modified}, {Path: "/workspace", Kind: sandbox.Modified},
		{Path: "/workspace/web/node_modules/x/index.js", Kind: sandbox.Added},
		{Path: "/workspace/web/old.js", Kind: sandbox.Deleted},
		{Path: "/home", Kind: sandbox.Modified}, {Path: "/home/agent/.npm/_cacache", Kind: sandbox.Added},
		{Path: "/var", Kind: sandbox.Modified}, {Path: "/var/lib", Kind: sandbox.Modified},
		{Path: "/var/lib/spotlight", Kind: sandbox.Added}, {Path: protocol.SetupRecordPath, Kind: sandbox.Added},
		{Path: "/run", Kind: sandbox.Modified}, {Path: "/run/spotlight", Kind: sandbox.Added},
		{Path: "/etc", Kind: sandbox.Modified}, {Path: "/etc/spotlight/egress", Kind: sandbox.Added},
		{Path: "/tmp", Kind: sandbox.Modified},
	}
	if refused := refusedChange(kept); refused != "" {
		t.Errorf("refused %s", refused)
	}

	for _, change := range []sandbox.Change{
		{Path: "/run/spotlight/assignment.json", Kind: sandbox.Added},
		{Path: "/etc/spotlight/egress/authority.pem", Kind: sandbox.Added},
		{Path: "/tmp/spotlight-mirror-1.gitconfig", Kind: sandbox.Added},
		{Path: "/root/.gitconfig", Kind: sandbox.Added},
		{Path: "/etc/passwd", Kind: sandbox.Modified},
		{Path: "/workspacex", Kind: sandbox.Added},
		{Path: "/var/lib/spotlight/other.json", Kind: sandbox.Added},
		{Path: "/tmp", Kind: sandbox.Deleted},
	} {
		if refused := refusedChange(append(slices.Clone(kept), change)); refused != change.Path {
			t.Errorf("kept %s (refused %q)", change.Path, refused)
		}
	}
}

type imageStore struct {
	sandbox.Engine
	images  []sandbox.Image
	used    map[string]bool
	removed []string
}

func (s *imageStore) Images(context.Context) ([]sandbox.Image, error) {
	return slices.Clone(s.images), nil
}

func (s *imageStore) Inspect(_ context.Context, id string) (sandbox.Image, error) {
	for _, each := range s.images {
		if each.ID == id {
			return each, nil
		}
	}
	return sandbox.Image{}, sandbox.ErrNoImage
}

func (s *imageStore) Used(_ context.Context, id string) (bool, error) { return s.used[id], nil }

func (s *imageStore) Remove(_ context.Context, ref string) error {
	s.removed = append(s.removed, ref)
	s.images = slices.DeleteFunc(s.images, func(each sandbox.Image) bool { return each.ID == ref })
	return nil
}

func setupImageOf(id, key, digest string, built time.Time) sandbox.Image {
	return sandbox.Image{ID: id, Tags: []string{SetupRepository + ":" + id}, Labels: map[string]string{
		LabelSetupKey: key, LabelBaseDigest: digest, LabelBuiltAt: built.UTC().Format(time.RFC3339Nano),
	}}
}

func hostWith(store *imageStore) *Host {
	return &Host{
		engine: store, log: slog.New(slog.NewTextHandler(io.Discard, nil)),
		served:    map[string]*served{"runner:1": {image: "runner:1", digest: "runner@sha256:a"}},
		setupUsed: map[string]time.Time{}, setupBuilds: map[string]bool{}, setupStarts: map[string]int{},
	}
}

func TestASandboxStartsFromTheNewestSetupImageOfItsRunnerImage(t *testing.T) {
	now := time.Now()
	store := &imageStore{images: []sandbox.Image{
		setupImageOf("older", "key", "runner@sha256:a", now.Add(-time.Hour)),
		setupImageOf("newer", "key", "runner@sha256:a", now),
		setupImageOf("other-runner", "key", "runner@sha256:b", now.Add(time.Hour)),
		setupImageOf("other-key", "key-2", "runner@sha256:a", now.Add(time.Hour)),
	}}
	host := hostWith(store)

	found, ok := host.setupImage(context.Background(), "key", "runner@sha256:a", host.log)
	if !ok || found.ID != "newer" {
		t.Errorf("found %q, %v", found.ID, ok)
	}
	if _, ok := host.setupImage(context.Background(), "key", "runner@sha256:c", host.log); ok {
		t.Error("a new runner image found a setup image of an old one")
	}
}

func TestOldSetupImagesAreRemoved(t *testing.T) {
	now := time.Now()
	store := &imageStore{used: map[string]bool{"in-use": true}, images: []sandbox.Image{
		setupImageOf("new", "key", "runner@sha256:a", now),
		setupImageOf("replaced", "key", "runner@sha256:a", now.Add(-time.Hour)),
		setupImageOf("in-use", "key", "runner@sha256:a", now.Add(-2*time.Hour)),
		setupImageOf("old-runner", "key-2", "runner@sha256:old", now),
		setupImageOf("unused", "key-3", "runner@sha256:a", now.Add(-8*24*time.Hour)),
		setupImageOf("used-lately", "key-4", "runner@sha256:a", now.Add(-8*24*time.Hour)),
		{ID: "runner", Digests: []string{"runner@sha256:a"}},
	}}
	host := hostWith(store)
	host.setupUsed["used-lately"] = now.Add(-time.Hour)

	host.removeSetupImages(context.Background(), "key", "new")

	var left []string
	for _, each := range store.images {
		left = append(left, each.ID)
	}
	slices.Sort(left)
	if want := []string{"in-use", "new", "runner", "used-lately"}; !slices.Equal(left, want) {
		t.Errorf("kept %v, want %v", left, want)
	}
}

func TestAHostKeepsOnlyItsMostUsedSetupImages(t *testing.T) {
	now := time.Now()
	store := &imageStore{}
	for i := range setupImagesKept + 2 {
		key := string(rune('a' + i))
		store.images = append(store.images, setupImageOf(key, key, "runner@sha256:a", now.Add(-time.Duration(i)*time.Hour)))
	}
	host := hostWith(store)

	host.removeSetupImages(context.Background(), "", "")

	if len(store.images) != setupImagesKept {
		t.Errorf("kept %d setup images, want %d", len(store.images), setupImagesKept)
	}
	if slices.ContainsFunc(store.images, func(each sandbox.Image) bool { return each.ID == "j" }) {
		t.Error("kept the least used setup image")
	}
}

func TestAVolumeOverWhatASetupImageHoldsStopsTheImage(t *testing.T) {
	for _, volumes := range [][]string{{"/workspace"}, {"/home/agent/"}, {"/var/lib"}, {"/"}, {"/data", "/workspace/web"}} {
		if heldVolume(volumes) == "" {
			t.Errorf("%v is allowed", volumes)
		}
	}
	for _, volumes := range [][]string{nil, {"/data"}, {"/var/cache"}, {"/workspaces"}} {
		if got := heldVolume(volumes); got != "" {
			t.Errorf("%v is refused for %s", volumes, got)
		}
	}
}

func TestOnlyTheRunsAuthoritiesLeaveTheSystemBundle(t *testing.T) {
	base := "-----BEGIN CERTIFICATE-----\nbase\n-----END CERTIFICATE-----\n"
	egress := "-----BEGIN CERTIFICATE-----\negress\n-----END CERTIFICATE-----"
	proxy := "-----BEGIN CERTIFICATE-----\nproxy\n-----END CERTIFICATE-----"
	bundle := []byte(base + egress + "\n" + proxy)

	got := withoutAuthorities(bundle, [][]byte{[]byte(egress), []byte(proxy)})

	if string(got) != base {
		t.Errorf("left %q", got)
	}
}

func TestAnImageNeverCheckedIsNotUsedAndIsRemovedLater(t *testing.T) {
	now := time.Now()
	unchecked := setupImageOf("unchecked", "key", "runner@sha256:a", now)
	unchecked.Tags = nil
	stale := setupImageOf("stale", "key-2", "runner@sha256:a", now.Add(-time.Hour))
	stale.Tags = nil
	store := &imageStore{images: []sandbox.Image{unchecked, stale, setupImageOf("checked", "key", "runner@sha256:a", now.Add(-time.Minute))}}
	host := hostWith(store)

	if found, ok := host.setupImage(context.Background(), "key", "runner@sha256:a", host.log); !ok || found.ID != "checked" {
		t.Errorf("chose %q, %v", found.ID, ok)
	}
	host.removeSetupImages(context.Background(), "", "")
	if !slices.Equal(store.removed, []string{"stale"}) {
		t.Errorf("removed %v, want only the old unchecked image", store.removed)
	}
}

func TestAnImageASandboxIsStartingFromIsNotRemoved(t *testing.T) {
	now := time.Now()
	store := &imageStore{images: []sandbox.Image{
		setupImageOf("new", "key", "runner@sha256:a", now),
		setupImageOf("chosen", "key", "runner@sha256:a", now.Add(-time.Hour)),
	}}
	host := hostWith(store)
	host.setupStarts["chosen"] = 1

	host.removeSetupImages(context.Background(), "key", "new")

	if len(store.removed) > 0 {
		t.Errorf("removed %v while a sandbox starts from it", store.removed)
	}
}
