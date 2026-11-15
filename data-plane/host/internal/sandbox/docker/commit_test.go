package docker

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"slices"
	"strings"
	"sync"
	"testing"

	"usespotlight.ai/data-plane/host/internal/sandbox"
)

type commitDaemon struct {
	mu        sync.Mutex
	images    map[string]map[string]any
	committed map[string]any
	removed   []string
	tagged    []string
	leaks     bool
}

// merging answers /commit as the engine does: env and labels the given config lacks come from the container.
func merging(t *testing.T, leaks bool) (*Engine, *commitDaemon) {
	t.Helper()

	daemon := &commitDaemon{leaks: leaks, images: map[string]map[string]any{
		"base": {
			"Env":        []any{"PATH=/usr/bin:/bin", "HOME=/root"},
			"Entrypoint": []any{"spotlight", "runner"},
			"Labels":     map[string]any{"org.opencontainers.image.source": "https://example.com/runner"},
		},
	}}
	running := map[string]any{"Config": map[string]any{
		"Env":    []string{"PATH=/usr/bin:/bin", "HOME=/root", "HTTP_PROXY=http://sandbox:secret@egress:3128", "SPOTLIGHT_MIRRORS=/spotlight/mirrors"},
		"Labels": map[string]string{"org.opencontainers.image.source": "https://example.com/runner", "ai.usespotlight.runner": "runner-1", "ai.usespotlight.host": "host-1"},
	}}

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		daemon.mu.Lock()
		defer daemon.mu.Unlock()

		switch {
		case r.Method == http.MethodGet && strings.HasPrefix(r.URL.Path, "/images/") && strings.HasSuffix(r.URL.Path, "/json"):
			name := strings.TrimSuffix(strings.TrimPrefix(r.URL.Path, "/images/"), "/json")
			config, ok := daemon.images[name]
			if !ok {
				w.WriteHeader(http.StatusNotFound)
				return
			}
			json.NewEncoder(w).Encode(map[string]any{"Id": name, "Config": config, "RootFS": map[string]any{"Layers": []string{"a", "b"}}})
		case r.Method == http.MethodGet && r.URL.Path == "/containers/sandbox-1/json":
			json.NewEncoder(w).Encode(running)
		case r.Method == http.MethodPost && r.URL.Path == "/commit":
			var given map[string]any
			json.NewDecoder(r.Body).Decode(&given)
			daemon.committed = given

			env := configEnv(given)
			for _, entry := range running["Config"].(map[string]any)["Env"].([]string) {
				if daemon.leaks || !slices.ContainsFunc(env, func(each string) bool { return envKey(each) == envKey(entry) }) {
					env = append(env, entry)
				}
			}
			labels := configLabels(given)
			for key, value := range running["Config"].(map[string]any)["Labels"].(map[string]string) {
				if _, ok := labels[key]; !ok {
					labels[key] = value
				}
			}
			merged := map[string]any{"Env": toAny(env), "Labels": labelsAny(labels), "Entrypoint": given["Entrypoint"]}
			daemon.images["sha256:committed"] = merged
			w.WriteHeader(http.StatusCreated)
			w.Write([]byte(`{"Id":"sha256:committed"}`))
		case r.Method == http.MethodPost && strings.HasPrefix(r.URL.Path, "/images/") && strings.HasSuffix(r.URL.Path, "/tag"):
			daemon.tagged = append(daemon.tagged, strings.TrimSuffix(strings.TrimPrefix(r.URL.Path, "/images/"), "/tag")+" "+
				r.URL.Query().Get("repo")+":"+r.URL.Query().Get("tag"))
			w.WriteHeader(http.StatusCreated)
		case r.Method == http.MethodDelete && strings.HasPrefix(r.URL.Path, "/images/"):
			daemon.removed = append(daemon.removed, strings.TrimPrefix(r.URL.Path, "/images/"))
			w.WriteHeader(http.StatusOK)
			w.Write([]byte(`[]`))
		default:
			t.Errorf("unexpected %s %s", r.Method, r.URL.Path)
			w.WriteHeader(http.StatusNotFound)
		}
	}))
	t.Cleanup(server.Close)

	engine, err := Connect("tcp://" + strings.TrimPrefix(server.URL, "http://"))
	if err != nil {
		t.Fatal(err)
	}
	return engine, daemon
}

func toAny(env []string) []any {
	out := make([]any, 0, len(env))
	for _, each := range env {
		out = append(out, each)
	}
	return out
}

func labelsAny(labels map[string]string) map[string]any {
	out := map[string]any{}
	for key, value := range labels {
		out[key] = value
	}
	return out
}

func TestCommitKeepsNoValueTheSandboxWasStartedWith(t *testing.T) {
	engine, daemon := merging(t, false)

	id, err := engine.Commit(context.Background(), "sandbox-1", sandbox.Commit{
		Repository: "spotlight-setup", Tag: "abc", ConfigFrom: "base", Labels: map[string]string{"ai.usespotlight.setup-key": "abc"},
	})
	if err != nil {
		t.Fatalf("commit: %v", err)
	}
	if id != "sha256:committed" {
		t.Errorf("committed %q", id)
	}

	committed := daemon.images["sha256:committed"]
	env := configEnv(committed)
	for _, entry := range env {
		if strings.Contains(entry, "secret") || strings.Contains(entry, "/spotlight/mirrors") {
			t.Errorf("the image keeps %q", entry)
		}
	}
	if !slices.Contains(env, "HTTP_PROXY=") || !slices.Contains(env, "PATH=/usr/bin:/bin") {
		t.Errorf("env %v", env)
	}

	labels := configLabels(committed)
	if labels["ai.usespotlight.runner"] != "" || labels["ai.usespotlight.host"] != "" {
		t.Errorf("the image keeps the sandbox's labels: %v", labels)
	}
	if labels["ai.usespotlight.setup-key"] != "abc" || labels["org.opencontainers.image.source"] == "" {
		t.Errorf("labels %v", labels)
	}
	if got := daemon.committed["Entrypoint"]; got == nil {
		t.Error("the commit did not keep the base entrypoint")
	}
	if !slices.Equal(daemon.tagged, []string{"sha256:committed spotlight-setup:abc"}) {
		t.Errorf("tagged %v, want the checked image tagged once", daemon.tagged)
	}
}

func TestCommitRemovesAnImageThatStillHoldsAValue(t *testing.T) {
	engine, daemon := merging(t, true)

	_, err := engine.Commit(context.Background(), "sandbox-1", sandbox.Commit{
		Repository: "spotlight-setup", Tag: "abc", ConfigFrom: "base",
	})
	if err == nil {
		t.Fatal("committed an image that holds the proxy credential")
	}
	if !slices.Contains(daemon.removed, "sha256:committed") {
		t.Errorf("did not remove the image: %v", daemon.removed)
	}
	if len(daemon.tagged) > 0 {
		t.Errorf("tagged an image that failed its check: %v", daemon.tagged)
	}
}

func TestChangesListsWhatTheSandboxChanged(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/containers/sandbox-1/changes" {
			w.WriteHeader(http.StatusNotFound)
			return
		}
		w.Write([]byte(`[{"Path":"/workspace","Kind":0},{"Path":"/workspace/web","Kind":1},{"Path":"/tmp/x","Kind":2}]`))
	}))
	t.Cleanup(server.Close)
	engine, err := Connect("tcp://" + strings.TrimPrefix(server.URL, "http://"))
	if err != nil {
		t.Fatal(err)
	}

	changes, err := engine.Changes(context.Background(), "sandbox-1")
	if err != nil {
		t.Fatal(err)
	}
	want := []sandbox.Change{{Path: "/workspace", Kind: sandbox.Modified}, {Path: "/workspace/web", Kind: sandbox.Added}, {Path: "/tmp/x", Kind: sandbox.Deleted}}
	if !slices.Equal(changes, want) {
		t.Errorf("got %v", changes)
	}
}
