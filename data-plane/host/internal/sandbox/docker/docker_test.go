package docker

import (
	"bytes"
	"context"
	"encoding/binary"
	"errors"
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
