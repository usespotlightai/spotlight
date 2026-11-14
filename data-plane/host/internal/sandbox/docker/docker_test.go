package docker

import (
	"bytes"
	"context"
	"encoding/binary"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"slices"
	"strconv"
	"strings"
	"sync"
	"testing"
	"time"

	"usespotlight.ai/data-plane/host/internal/sandbox"
)

type lockedBuffer struct {
	mu     sync.Mutex
	buffer bytes.Buffer
}

func (b *lockedBuffer) Write(p []byte) (int, error) {
	b.mu.Lock()
	defer b.mu.Unlock()
	return b.buffer.Write(p)
}

func (b *lockedBuffer) String() string {
	b.mu.Lock()
	defer b.mu.Unlock()
	return b.buffer.String()
}

func framed(stream byte, text string) []byte {
	header := make([]byte, 8)
	header[0] = stream
	binary.BigEndian.PutUint32(header[4:], uint32(len(text)))
	return append(header, text...)
}

func TestDemultiplexJoinsBothStreams(t *testing.T) {
	in := bytes.NewReader(append(framed(1, "out\n"), framed(2, "err\n")...))
	var out bytes.Buffer

	if err := demultiplex(in, &out); err != nil {
		t.Fatalf("demultiplex: %v", err)
	}
	if out.String() != "out\nerr\n" {
		t.Errorf("got %q", out.String())
	}
}

func TestReferenceSplitsATagFromARegistryWithAPort(t *testing.T) {
	for image, want := range map[string][2]string{
		"ghcr.io/usespotlightai/spotlight-runner:v1.2.0": {"ghcr.io/usespotlightai/spotlight-runner", "v1.2.0"},
		"localhost:5000/runner":                          {"localhost:5000/runner", "latest"},
		"runner@sha256:abc":                              {"runner@sha256:abc", ""},
	} {
		name, tag := reference(image)
		if name != want[0] || tag != want[1] {
			t.Errorf("%s: got %s %s", image, name, tag)
		}
	}
}

// recording answers as an engine would, and passes on the body of each create.
func recording(t *testing.T) (*Engine, <-chan []byte) {
	t.Helper()

	bodies := make(chan []byte, 8)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch {
		case r.URL.Path == "/info":
			w.Write([]byte(`{"MemTotal":25000000000}`))
		case strings.HasPrefix(r.URL.Path, "/containers/create"):
			body, err := io.ReadAll(r.Body)
			if err != nil {
				t.Error(err)
			}
			bodies <- body
			w.WriteHeader(http.StatusCreated)
			w.Write([]byte(`{"Id":"c1"}`))
		default:
			w.WriteHeader(http.StatusNoContent)
		}
	}))
	t.Cleanup(server.Close)

	engine, err := Connect("tcp://" + strings.TrimPrefix(server.URL, "http://"))
	if err != nil {
		t.Fatal(err)
	}
	return engine, bodies
}

func TestASandboxWithLimitsHasNoSwapAboveItsMemoryAndItsOOMScore(t *testing.T) {
	engine, bodies := recording(t)

	limits := sandbox.Limits{Memory: 6 << 30, OOMScoreAdj: 500}
	if _, err := engine.Start(context.Background(), sandbox.Spec{Image: "runner", Limits: limits}); err != nil {
		t.Fatal(err)
	}
	var limited created
	if err := json.Unmarshal(<-bodies, &limited); err != nil {
		t.Fatal(err)
	}
	if got := limited.HostConfig; got.Memory != 6<<30 || got.MemorySwap != 6<<30 || got.OomScoreAdj != 500 {
		t.Errorf("host config %+v", got)
	}

	if _, err := engine.Start(context.Background(), sandbox.Spec{Image: "egress"}); err != nil {
		t.Fatal(err)
	}
	var unlimited struct{ HostConfig map[string]json.RawMessage }
	if err := json.Unmarshal(<-bodies, &unlimited); err != nil {
		t.Fatal(err)
	}
	for _, key := range []string{"Memory", "MemorySwap", "OomScoreAdj"} {
		if value, set := unlimited.HostConfig[key]; set {
			t.Errorf("a container without limits sets %s to %s", key, value)
		}
	}
}

func TestReadsTheMemoryOfTheRuntime(t *testing.T) {
	engine, _ := recording(t)

	if total, err := engine.Memory(context.Background()); err != nil || total != 25000000000 {
		t.Errorf("memory %d, %v", total, err)
	}
}

func TestASandboxRunsWithItsFilesAndIsGoneAfterwards(t *testing.T) {
	engine, err := Connect("")
	if err != nil {
		t.Skip("no container runtime: ", err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
	defer cancel()

	if _, err := engine.Describe(ctx); err != nil {
		t.Skip("container runtime unreachable: ", err)
	}

	const image = "busybox:1.36"
	if err := engine.Pull(ctx, image, ""); err != nil {
		t.Skip("cannot pull a test image: ", err)
	}
	pulled, err := engine.Inspect(ctx, image)
	if err != nil || pulled.ID == "" || len(pulled.Digests) == 0 {
		t.Fatalf("inspect %+v: %v", pulled, err)
	}
	if _, err := engine.Inspect(ctx, "spotlight-no-such-image:never"); !errors.Is(err, sandbox.ErrNoImage) {
		t.Errorf("a missing image answered %v", err)
	}

	id, err := engine.Start(ctx, sandbox.Spec{
		Image:  image,
		Args:   []string{"sh", "-c", "cat /run/spotlight/assignment.json; stat -c %a /run/spotlight/assignment.json;"},
		Labels: map[string]string{"ai.usespotlight.test": "sandbox"},
		Files:  []sandbox.File{{Path: "/run/spotlight/assignment.json", Mode: 0o400, Body: []byte("assignment\n")}},
	})
	if id != "" {
		defer func() { _ = engine.Destroy(context.Background(), id) }()
	}
	if err != nil {
		t.Fatalf("start: %v", err)
	}

	code, err := engine.Wait(ctx, id)
	if err != nil || code != 0 {
		t.Fatalf("exit %d: %v", code, err)
	}

	var out bytes.Buffer
	if err := engine.Follow(ctx, id, time.Time{}, &out); err != nil {
		t.Fatalf("follow: %v", err)
	}
	if !strings.Contains(out.String(), "assignment") || !strings.Contains(out.String(), "400") {
		t.Errorf("said %q", out.String())
	}

	labelled, err := engine.Labelled(ctx, "ai.usespotlight.test", "sandbox")
	if err != nil || len(labelled) == 0 {
		t.Fatalf("labelled %v: %v", labelled, err)
	}
	if found := labelled[0]; found.ID != id || found.Running || found.Labels["ai.usespotlight.test"] != "sandbox" || found.Created.IsZero() {
		t.Errorf("listed %+v", found)
	}

	if err := engine.Destroy(ctx, id); err != nil {
		t.Fatalf("destroy: %v", err)
	}
	if err := engine.Destroy(ctx, id); err != nil {
		t.Errorf("destroying twice failed: %v", err)
	}

	left, _ := engine.Labelled(ctx, "ai.usespotlight.test", "sandbox")
	for _, each := range left {
		if each.ID == id {
			t.Errorf("sandbox %s is still there", id)
		}
	}
}

func TestAnImageASandboxUsesIsNotRemovedAndOneNothingUsesIs(t *testing.T) {
	engine, err := Connect("")
	if err != nil {
		t.Skip("no container runtime: ", err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
	defer cancel()

	if _, err := engine.Describe(ctx); err != nil {
		t.Skip("container runtime unreachable: ", err)
	}

	const image = "busybox:1.35"
	if err := engine.Pull(ctx, image, ""); err != nil {
		t.Skip("cannot pull a test image: ", err)
	}
	pulled, err := engine.Inspect(ctx, image)
	if err != nil {
		t.Fatalf("inspect: %v", err)
	}

	listed, err := engine.Images(ctx)
	if err != nil {
		t.Fatalf("images: %v", err)
	}
	i := slices.IndexFunc(listed, func(each sandbox.Image) bool { return each.ID == pulled.ID })
	if i < 0 || !slices.Contains(listed[i].Tags, image) || len(listed[i].Digests) == 0 || listed[i].Size == 0 {
		t.Fatalf("listed %+v, not the pulled image with its tag, digest and size", listed)
	}

	id, err := engine.Start(ctx, sandbox.Spec{Image: pulled.ID, Args: []string{"true"}})
	if id != "" {
		defer func() { _ = engine.Destroy(context.Background(), id) }()
	}
	if err != nil {
		t.Fatalf("start: %v", err)
	}
	const second = "spotlight-test-image:second"
	if _, err := engine.call(ctx, http.MethodPost, "/images/"+pulled.ID+"/tag?repo=spotlight-test-image&tag=second", nil, nil); err != nil {
		t.Fatalf("tag: %v", err)
	}
	if used, err := engine.Used(ctx, pulled.ID); err != nil || !used {
		t.Fatalf("an image a sandbox uses answered used %v: %v", used, err)
	}
	if err := engine.Remove(ctx, pulled.ID); !errors.Is(err, sandbox.ErrInUse) {
		t.Fatalf("removing an image a sandbox uses answered %v", err)
	}

	if err := engine.Destroy(ctx, id); err != nil {
		t.Fatalf("destroy: %v", err)
	}
	if used, err := engine.Used(ctx, pulled.ID); err != nil || used {
		t.Fatalf("an image no sandbox uses answered used %v: %v", used, err)
	}
	for _, tag := range []string{second, image} {
		if err := engine.Remove(ctx, tag); err != nil {
			t.Fatalf("remove %s: %v", tag, err)
		}
	}
	if err := engine.Remove(ctx, pulled.ID); err != nil {
		t.Errorf("removing a removed image answered %v", err)
	}
	if _, err := engine.Inspect(ctx, image); !errors.Is(err, sandbox.ErrNoImage) {
		t.Errorf("the image is still there: %v", err)
	}
}

func TestLayingAFileLeavesItsParentsAsTheImageHasThem(t *testing.T) {
	engine, err := Connect("")
	if err != nil {
		t.Skip("no container runtime: ", err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
	defer cancel()

	const image = "busybox:1.36"
	if _, err := engine.Describe(ctx); err != nil || engine.Pull(ctx, image, "") != nil {
		t.Skip("no usable container runtime")
	}

	id, err := engine.Start(ctx, sandbox.Spec{
		Image: image,
		Args:  []string{"stat", "-c", "%a", "/etc"},
		Files: []sandbox.File{{Path: "/etc/spotlight/assignment.json", Mode: 0o400, Body: []byte("assignment")}},
	})
	if id != "" {
		defer func() { _ = engine.Destroy(context.Background(), id) }()
	}
	if err != nil {
		t.Fatalf("start: %v", err)
	}

	if code, err := engine.Wait(ctx, id); err != nil || code != 0 {
		t.Fatalf("exit %d: %v", code, err)
	}

	var out bytes.Buffer
	if err := engine.Follow(ctx, id, time.Time{}, &out); err != nil {
		t.Fatalf("follow: %v", err)
	}
	if strings.TrimSpace(out.String()) != "755" {
		t.Errorf("/etc is %q after laying a file under it", out.String())
	}
}

func TestASandboxOnItsOwnNetworkConnectsOnlyToWhatJoinedIt(t *testing.T) {
	engine, err := Connect("")
	if err != nil {
		t.Skip("no container runtime: ", err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
	defer cancel()

	const image = "busybox:1.36"
	if _, err := engine.Describe(ctx); err != nil || engine.Pull(ctx, image, "") != nil {
		t.Skip("no usable container runtime")
	}

	labels := map[string]string{"ai.usespotlight.test": "network"}
	network, err := engine.Network(ctx, "spotlight-test-"+strconv.FormatInt(time.Now().UnixNano(), 36), labels)
	if err != nil {
		t.Fatalf("network: %v", err)
	}
	defer func() { _ = engine.Unnetwork(context.Background(), network) }()

	sidecar, err := engine.Start(ctx, sandbox.Spec{
		Image:      image,
		Entrypoint: []string{"sh", "-c"},
		Args:       []string{"mkdir -p /srv && echo reached > /srv/index.html && touch /tmp/ready && httpd -f -p 8080 -h /srv"},
		Labels:     labels,
		Joins:      []sandbox.Join{{Network: network, Aliases: []string{"egress"}}},
	})
	if sidecar != "" {
		defer func() { _ = engine.Destroy(context.Background(), sidecar) }()
	}
	if err != nil {
		t.Fatalf("start the egress sidecar: %v", err)
	}

	for deadline := time.Now().Add(30 * time.Second); ; {
		if _, err := engine.Read(ctx, sidecar, "/tmp/ready"); err == nil {
			break
		} else if !errors.Is(err, os.ErrNotExist) || time.Now().After(deadline) {
			t.Fatalf("the egress sidecar did not become ready: %v", err)
		}
		time.Sleep(100 * time.Millisecond)
	}
	if content, err := engine.Read(ctx, sidecar, "/srv/index.html"); err != nil || string(content) != "reached\n" {
		t.Errorf("read %q: %v", content, err)
	}

	id, err := engine.Start(ctx, sandbox.Spec{
		Image: image,
		Args: []string{"sh", "-c",
			"wget -q -O- http://egress:8080/; (wget -q -T 3 -O- http://1.1.1.1/ >/dev/null 2>&1 && echo escaped) || echo contained; stat -c %a /etc/trusted"},
		Labels:  labels,
		Network: network,
		Files:   []sandbox.File{{Path: "/etc/trusted/authority.pem", Mode: 0o644, DirMode: 0o755, Body: []byte("pem")}},
	})
	if id != "" {
		defer func() { _ = engine.Destroy(context.Background(), id) }()
	}
	if err != nil {
		t.Fatalf("start: %v", err)
	}
	if code, err := engine.Wait(ctx, id); err != nil || code != 0 {
		t.Fatalf("exit %d: %v", code, err)
	}

	var out bytes.Buffer
	if err := engine.Follow(ctx, id, time.Time{}, &out); err != nil {
		t.Fatalf("follow: %v", err)
	}
	if got := strings.Fields(out.String()); !slices.Equal(got, []string{"reached", "contained", "755"}) {
		t.Errorf("said %q", out.String())
	}

	networks, err := engine.Networks(ctx, "ai.usespotlight.test", "network")
	if err != nil || !slices.ContainsFunc(networks, func(each sandbox.Network) bool { return each.ID == network }) {
		t.Errorf("networks %v: %v", networks, err)
	}
	if attached, err := engine.Attached(ctx, network); err != nil || !slices.Contains(attached, id) || !slices.Contains(attached, sidecar) {
		t.Errorf("attached %v: %v", attached, err)
	}
	if _, err := engine.Read(ctx, id, "/no/such/file"); !errors.Is(err, os.ErrNotExist) {
		t.Errorf("reading a missing file answered %v", err)
	}
}

func TestARunningSandboxTakesAFileAndASignal(t *testing.T) {
	engine, err := Connect("")
	if err != nil {
		t.Skip("no container runtime: ", err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
	defer cancel()

	const image = "busybox:1.36"
	if _, err := engine.Describe(ctx); err != nil || engine.Pull(ctx, image, "") != nil {
		t.Skip("no usable container runtime")
	}

	id, err := engine.Start(ctx, sandbox.Spec{
		Image: image,
		Args:  []string{"sh", "-c", "trap 'cat /run/spotlight/assignment.json; exit 0' USR1; while true; do sleep 0.1; done"},
	})
	if id != "" {
		defer func() { _ = engine.Destroy(context.Background(), id) }()
	}
	if err != nil {
		t.Fatalf("start: %v", err)
	}

	if err := engine.Put(ctx, id, sandbox.File{Path: "/run/spotlight/assignment.json", Mode: 0o400, Body: []byte("next run\n")}); err != nil {
		t.Fatalf("put: %v", err)
	}
	if err := engine.Signal(ctx, id, "SIGUSR1"); err != nil {
		t.Fatalf("signal: %v", err)
	}

	code, err := engine.Wait(ctx, id)
	if err != nil || code != 0 {
		t.Fatalf("exit %d: %v", code, err)
	}

	var out bytes.Buffer
	if err := engine.Follow(ctx, id, time.Time{}, &out); err != nil {
		t.Fatalf("follow: %v", err)
	}
	if !strings.Contains(out.String(), "next run") {
		t.Errorf("said %q", out.String())
	}
}

func TestDemultiplexKeepsStderrApart(t *testing.T) {
	in := bytes.NewReader(append(append(framed(1, "out\n"), framed(2, "err\n")...), framed(1, "more\n")...))
	var out, errs bytes.Buffer

	if err := demultiplexStreams(in, &out, &errs); err != nil {
		t.Fatalf("demultiplex: %v", err)
	}
	if out.String() != "out\nmore\n" || errs.String() != "err\n" {
		t.Errorf("got %q and %q", out.String(), errs.String())
	}
}

func TestExecGivesAStreamToACommandInTheSandboxWithAVolumeMounted(t *testing.T) {
	engine, err := Connect("")
	if err != nil {
		t.Skip("no container runtime: ", err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
	defer cancel()

	const image = "busybox:1.36"
	if _, err := engine.Describe(ctx); err != nil || engine.Pull(ctx, image, "") != nil {
		t.Skip("no usable container runtime")
	}

	volume := "spotlight-test-" + strconv.FormatInt(time.Now().UnixNano(), 36)
	id, err := engine.Start(ctx, sandbox.Spec{
		Image:  image,
		Args:   []string{"sleep", "120"},
		Mounts: []sandbox.Mount{{Source: volume, Target: "/cache", Volume: true}},
	})
	if id != "" {
		defer func() {
			_ = engine.Destroy(context.Background(), id)
			_, _ = engine.call(context.Background(), "DELETE", "/volumes/"+volume, nil, nil)
		}()
	}
	if err != nil {
		t.Fatalf("start: %v", err)
	}

	var errs lockedBuffer
	stream, err := engine.Exec(ctx, id, []string{"sh", "-c", "echo started >&2; tee /cache/kept"}, &errs)
	if err != nil {
		t.Fatalf("exec: %v", err)
	}
	if _, err := stream.Write([]byte("over ssh\n")); err != nil {
		t.Fatal(err)
	}
	echoed := make([]byte, len("over ssh\n"))
	if _, err := io.ReadFull(stream, echoed); err != nil || string(echoed) != "over ssh\n" {
		t.Fatalf("read %q: %v", echoed, err)
	}
	for deadline := time.Now().Add(5 * time.Second); !strings.Contains(errs.String(), "started"); time.Sleep(10 * time.Millisecond) {
		if time.Now().After(deadline) {
			t.Fatalf("stderr %q", errs.String())
		}
	}
	if err := stream.Close(); err != nil {
		t.Errorf("close: %v", err)
	}

	kept, err := engine.Read(ctx, id, "/cache/kept")
	if err != nil || string(kept) != "over ssh\n" {
		t.Errorf("the volume kept %q: %v", kept, err)
	}
	if _, err := engine.Exec(ctx, "spotlight-no-such-sandbox", []string{"true"}, nil); !errors.Is(err, sandbox.ErrGone) {
		t.Errorf("exec in a missing sandbox answered %v", err)
	}
}

func TestABuildTagsAnImageFromADockerfileAndItsArguments(t *testing.T) {
	engine, err := Connect("")
	if err != nil {
		t.Skip("no container runtime: ", err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
	defer cancel()

	if _, err := engine.Describe(ctx); err != nil {
		t.Skip("container runtime unreachable: ", err)
	}
	if err := engine.Pull(ctx, "busybox:1.35", ""); err != nil {
		t.Skip("cannot pull a test image: ", err)
	}

	const tag = "spotlight-build-test:latest"
	t.Cleanup(func() { _ = engine.Remove(context.Background(), tag) })

	var steps []string
	err = engine.Build(ctx, sandbox.Build{
		Tag:        tag,
		Dockerfile: []byte("ARG BASE\nFROM ${BASE}\nRUN echo built > /built\n"),
		Args:       map[string]string{"BASE": "busybox:1.35"},
	}, func(line string) { steps = append(steps, line) })
	if err != nil {
		t.Fatalf("build: %v", err)
	}
	if _, err := engine.Inspect(ctx, tag); err != nil || len(steps) == 0 {
		t.Errorf("inspect after %d steps: %v", len(steps), err)
	}

	err = engine.Build(ctx, sandbox.Build{Tag: tag, Dockerfile: []byte("FROM busybox:1.35\nRUN exit 3\n")}, nil)
	if err == nil {
		t.Error("a failing step built")
	}
}
