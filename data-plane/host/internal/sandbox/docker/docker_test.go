package docker

import (
	"bytes"
	"context"
	"encoding/binary"
	"errors"
	"io"
	"os"
	"slices"
	"strconv"
	"strings"
	"testing"
	"time"

	"usespotlight.ai/data-plane/host/internal/sandbox"
)

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
	if err := engine.Follow(ctx, id, &out); err != nil {
		t.Fatalf("follow: %v", err)
	}
	if !strings.Contains(out.String(), "assignment") || !strings.Contains(out.String(), "400") {
		t.Errorf("said %q", out.String())
	}

	labelled, err := engine.Labelled(ctx, "ai.usespotlight.test", "sandbox")
	if err != nil || len(labelled) == 0 {
		t.Fatalf("labelled %v: %v", labelled, err)
	}

	if err := engine.Destroy(ctx, id); err != nil {
		t.Fatalf("destroy: %v", err)
	}
	if err := engine.Destroy(ctx, id); err != nil {
		t.Errorf("destroying twice failed: %v", err)
	}

	left, _ := engine.Labelled(ctx, "ai.usespotlight.test", "sandbox")
	for _, each := range left {
		if each == id {
			t.Errorf("sandbox %s is still there", id)
		}
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
	if err := engine.Follow(ctx, id, &out); err != nil {
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
	if err := engine.Follow(ctx, id, &out); err != nil {
		t.Fatalf("follow: %v", err)
	}
	if got := strings.Fields(out.String()); !slices.Equal(got, []string{"reached", "contained", "755"}) {
		t.Errorf("said %q", out.String())
	}

	networks, err := engine.Networks(ctx, "ai.usespotlight.test", "network")
	if err != nil || !slices.Contains(networks, network) {
		t.Errorf("networks %v: %v", networks, err)
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
	if err := engine.Follow(ctx, id, &out); err != nil {
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

	var errs bytes.Buffer
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
	if err := stream.Close(); err != nil {
		t.Errorf("close: %v", err)
	}

	kept, err := engine.Read(ctx, id, "/cache/kept")
	if err != nil || string(kept) != "over ssh\n" {
		t.Errorf("the volume kept %q: %v", kept, err)
	}
	if !strings.Contains(errs.String(), "started") {
		t.Errorf("stderr %q", errs.String())
	}

	if _, err := engine.Exec(ctx, "spotlight-no-such-sandbox", []string{"true"}, nil); !errors.Is(err, sandbox.ErrGone) {
		t.Errorf("exec in a missing sandbox answered %v", err)
	}
}
