package docker

import (
	"bytes"
	"context"
	"encoding/binary"
	"errors"
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
		Args:   []string{"sh", "-c", "cat /run/spotlight/handed.json; stat -c %a /run/spotlight/handed.json;"},
		Labels: map[string]string{"ai.usespotlight.test": "sandbox"},
		Files:  []sandbox.File{{Path: "/run/spotlight/handed.json", Mode: 0o400, Body: []byte("handed\n")}},
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
	if !strings.Contains(out.String(), "handed") || !strings.Contains(out.String(), "400") {
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
		Files: []sandbox.File{{Path: "/etc/spotlight/handed.json", Mode: 0o400, Body: []byte("handed")}},
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

func TestASandboxOnItsOwnNetworkReachesOnlyWhatJoinedIt(t *testing.T) {
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

	way, err := engine.Start(ctx, sandbox.Spec{
		Image:      image,
		Entrypoint: []string{"sh", "-c"},
		Args:       []string{"mkdir -p /srv && echo reached > /srv/index.html && touch /tmp/ready && httpd -f -p 8080 -h /srv"},
		Labels:     labels,
		Joins:      []sandbox.Join{{Network: network, Aliases: []string{"egress"}}},
	})
	if way != "" {
		defer func() { _ = engine.Destroy(context.Background(), way) }()
	}
	if err != nil {
		t.Fatalf("start the way out: %v", err)
	}

	for deadline := time.Now().Add(30 * time.Second); ; {
		if _, err := engine.Read(ctx, way, "/tmp/ready"); err == nil {
			break
		} else if !errors.Is(err, os.ErrNotExist) || time.Now().After(deadline) {
			t.Fatalf("the way out never readied: %v", err)
		}
		time.Sleep(100 * time.Millisecond)
	}
	if said, err := engine.Read(ctx, way, "/srv/index.html"); err != nil || string(said) != "reached\n" {
		t.Errorf("read %q: %v", said, err)
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
