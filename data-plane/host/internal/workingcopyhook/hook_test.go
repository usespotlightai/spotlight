package workingcopyhook_test

import (
	"context"
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"usespotlight.ai/data-plane/host/internal/workingcopyhook"
	"usespotlight.ai/data-plane/protocol"
)

// standIn records each event and request, and keeps working copies as directories under $HOOK_ROOT.
const standIn = `#!/bin/sh
request=$(cat)
echo "$1 $request" >> "$HOOK_LOG"
case "$1" in
check)
  if [ -f "$HOOK_ROOT/unfit" ]; then
    echo '{"error":"this host has no ublk"}'
    exit 6
  fi
  echo '{}' ;;
open)
  name=$(printf '%s' "$request" | sed 's/.*"name":"\([^"]*\)".*/\1/')
  mkdir -p "$HOOK_ROOT/$name"
  case "$request" in
  *'"from":"spotlight-archive_1"'*) echo '{"dir":"'"$HOOK_ROOT/$name"'","restored":true}' ;;
  *) echo '{"dir":"'"$HOOK_ROOT/$name"'","restored":false}' ;;
  esac ;;
snapshot|close|remove) echo '{}' ;;
*) echo '{"error":"no such event"}'; exit 2 ;;
esac
`

type fixture struct {
	hook *workingcopyhook.Hook
	log  string
	dir  string
}

func setUp(t *testing.T, body string) fixture {
	t.Helper()

	dir := t.TempDir()
	path := filepath.Join(dir, "hook")
	log := filepath.Join(dir, "events.log")
	// The host passes the hook no environment of its own, so the stand-in has its paths written in.
	body = strings.NewReplacer("$HOOK_LOG", log, "$HOOK_ROOT", filepath.Join(dir, "copies")).Replace(body)
	if err := os.WriteFile(path, []byte(body), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.MkdirAll(filepath.Join(dir, "copies"), 0o755); err != nil {
		t.Fatal(err)
	}
	t.Setenv("SPOTLIGHT_POOL_TOKEN", "pool-token")

	return fixture{hook: workingcopyhook.New(path, filepath.Join(dir, "state")), log: log, dir: dir}
}

func (f fixture) events(t *testing.T) []map[string]any {
	t.Helper()

	body, err := os.ReadFile(f.log)
	if err != nil {
		t.Fatal(err)
	}

	var events []map[string]any
	for _, line := range strings.Split(strings.TrimSpace(string(body)), "\n") {
		event, request, _ := strings.Cut(line, " ")
		parsed := map[string]any{}
		if err := json.Unmarshal([]byte(request), &parsed); err != nil {
			t.Fatalf("the hook got %q for %s: %v", request, event, err)
		}
		parsed["event"] = event
		events = append(events, parsed)
	}
	return events
}

func base(name string) *string { return &name }

var store = protocol.WorkingCopyStore{Store: "s3://team-a", Base: base("base-v1")}

func TestOpensTheWorkingCopyFromTheSnapshotToRestore(t *testing.T) {
	f := setUp(t, standIn)

	opened, restored, err := f.hook.Open(context.Background(), store, "runner_1", "spotlight-archive_1")
	if err != nil {
		t.Fatalf("open: %v", err)
	}

	if !restored {
		t.Error("the working copy did not open from the snapshot to restore")
	}
	if opened.Dir() != filepath.Join(f.dir, "copies", "runner_1") {
		t.Errorf("opened %s", opened.Dir())
	}
	if info, err := os.Stat(opened.Sockets()); err != nil || !info.IsDir() {
		t.Errorf("no socket directory at %s", opened.Sockets())
	}
	got := f.events(t)[0]
	want := map[string]any{
		"event": "open", "version": float64(1), "store": "s3://team-a", "base": "base-v1",
		"name": "runner_1", "from": "spotlight-archive_1",
	}
	for key, value := range want {
		if got[key] != value {
			t.Errorf("the hook got %s = %v, want %v", key, got[key], value)
		}
	}
}

func TestOpensFromTheBaseWhenThereIsNoSnapshotToRestore(t *testing.T) {
	f := setUp(t, standIn)

	_, restored, err := f.hook.Open(context.Background(), protocol.WorkingCopyStore{Store: "s3://team-a"}, "runner_1", "")
	if err != nil {
		t.Fatal(err)
	}

	got := f.events(t)[0]
	if restored || got["from"] != nil || got["base"] != nil {
		t.Errorf("restored %v; the hook got %v", restored, got)
	}
}

func TestAsksTheHookForASnapshotAndToCloseTheWorkingCopy(t *testing.T) {
	f := setUp(t, standIn)
	opened, _, err := f.hook.Open(context.Background(), store, "runner_1", "")
	if err != nil {
		t.Fatal(err)
	}

	if err := opened.Snapshot(context.Background(), "spotlight-archive_2"); err != nil {
		t.Fatalf("snapshot: %v", err)
	}
	if err := opened.Close(context.Background()); err != nil {
		t.Fatalf("close: %v", err)
	}

	events := f.events(t)
	if events[1]["event"] != "snapshot" || events[1]["snapshot"] != "spotlight-archive_2" || events[1]["name"] != "runner_1" {
		t.Errorf("then the hook got %v", events[1])
	}
	if events[2]["event"] != "close" || events[2]["name"] != "runner_1" || events[2]["store"] != "s3://team-a" {
		t.Errorf("then the hook got %v", events[2])
	}
	if left := f.hook.Left(); len(left) != 0 {
		t.Errorf("left %q", left)
	}
}

func TestAdoptsAWorkingCopyAnEarlierHostLeftOpen(t *testing.T) {
	f := setUp(t, standIn)
	opened, _, err := f.hook.Open(context.Background(), store, "runner_1", "")
	if err != nil {
		t.Fatal(err)
	}

	again := workingcopyhook.New("/not/run", filepath.Join(f.dir, "state"))
	if left := again.Left(); len(left) != 1 || left[0] != "runner_1" {
		t.Fatalf("left %q", left)
	}
	adopted, ok := again.Adopt("runner_1")

	if !ok || adopted.Dir() != opened.Dir() || adopted.Sockets() != opened.Sockets() {
		t.Errorf("adopted %v", ok)
	}
	if _, ok := again.Adopt("runner_2"); ok {
		t.Error("adopted a working copy no host left")
	}
}

func TestSaysWhyTheHookCannotServeTheStore(t *testing.T) {
	f := setUp(t, standIn)
	if err := os.WriteFile(filepath.Join(f.dir, "copies", "unfit"), nil, 0o644); err != nil {
		t.Fatal(err)
	}

	err := f.hook.Check(context.Background(), store)

	if err == nil || !strings.Contains(err.Error(), "this host has no ublk") {
		t.Errorf("check said %v", err)
	}
}

func TestRefusesAWorkingCopyThatIsNoDirectory(t *testing.T) {
	f := setUp(t, `#!/bin/sh
cat > /dev/null
echo '{"dir":"relative/dir"}'
`)

	_, _, err := f.hook.Open(context.Background(), store, "runner_1", "")

	if err == nil || !strings.Contains(err.Error(), "not an absolute directory") {
		t.Errorf("open said %v", err)
	}
}

func TestPassesNoCredentialOfTheHostToTheHook(t *testing.T) {
	f := setUp(t, `#!/bin/sh
cat > /dev/null
env > "$HOME/env.txt"
echo '{}'
`)
	t.Setenv("HOME", f.dir)

	if err := f.hook.Check(context.Background(), store); err != nil {
		t.Fatal(err)
	}

	body, err := os.ReadFile(filepath.Join(f.dir, "env.txt"))
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(string(body), "pool-token") || !strings.Contains(string(body), "HOME="+f.dir) {
		t.Errorf("the hook saw %s", body)
	}
}

func TestSaysWhatAHookThatFailsPrinted(t *testing.T) {
	f := setUp(t, `#!/bin/sh
cat > /dev/null
echo "the store is unreachable" >&2
exit 4
`)

	err := f.hook.RemoveSnapshot(context.Background(), store, "spotlight-archive_1")

	if err == nil || !strings.Contains(err.Error(), "the store is unreachable") {
		t.Errorf("remove said %v", err)
	}
}
