package serve

import (
	"context"
	"crypto/rand"
	"encoding/json"
	"errors"
	"fmt"
	"slices"
	"strings"
	"sync"

	"usespotlight.ai/data-plane/host/internal/images"
	"usespotlight.ai/data-plane/host/internal/sandbox"
	"usespotlight.ai/data-plane/protocol"
)

const notAllowed = "The host's SPOTLIGHT_RUNNER_IMAGE doesn't allow this image."

type served struct {
	image     string
	isDefault bool
	stop      context.CancelFunc

	examining sync.Mutex

	id                string
	judged            string
	digest            string
	release           string
	harnesses         []protocol.HarnessReport
	unavailableReason string
}

type examined struct {
	image             string
	isDefault         bool
	id                string
	digest            string
	release           string
	harnesses         []protocol.HarnessReport
	unavailableReason string
}

func (e examined) hasHarness(harness string) bool {
	return slices.ContainsFunc(e.harnesses, func(each protocol.HarnessReport) bool { return each.ID == harness })
}

func (h *Host) refresh(ctx, claiming, serving context.Context, stop func(error)) error {
	required, err := h.pool.Requirements(ctx)
	if err != nil {
		return err
	}

	h.follow(ctx, required.Host.Release)
	if h.wasUpdated() {
		return nil
	}

	wanted := h.now().Images.Wanted(required.Images)

	h.mu.Lock()
	h.required = required
	h.disallowed = h.now().Images.Disallowed(required.Images)
	var gone []*served
	for image, each := range h.served {
		if !slices.ContainsFunc(wanted, func(w images.Wanted) bool { return w.Image == image }) {
			gone = append(gone, each)
			delete(h.served, image)
		}
	}
	judging := judgedUnder(required)
	var fresh, stale []*served
	for _, want := range wanted {
		if each, ok := h.served[want.Image]; ok {
			if each.unavailableReason != "" || each.judged != judging {
				stale = append(stale, each)
			}
			continue
		}
		each := &served{image: want.Image, isDefault: want.IsDefault}
		h.served[want.Image] = each
		fresh = append(fresh, each)
	}
	h.mu.Unlock()

	for _, each := range gone {
		h.log.Info("no line names the image any more, so the host stops serving it", "image", each.image)
		if each.stop != nil {
			each.stop()
		}
	}

	for _, each := range append(fresh, stale...) {
		if claiming.Err() != nil {
			break
		}

		if _, err := h.examine(ctx, each); err != nil {
			h.log.Warn("could not get the runner image", "image", each.image, "error", err)
		}

		if _, err := h.sendHeartbeat(ctx); err != nil {
			h.log.Warn("could not report what it serves", "error", err)
		}

		if slices.Contains(fresh, each) {
			h.serve(claiming, serving, each, stop)
		}
	}

	if len(fresh)+len(stale) == 0 {
		if _, err := h.sendHeartbeat(ctx); err != nil {
			h.log.Warn("could not report what it serves", "error", err)
		}
	}

	return nil
}

func (h *Host) serve(claiming, serving context.Context, each *served, stop func(error)) {
	looping, cancel := context.WithCancel(claiming)
	h.mu.Lock()
	each.stop = cancel
	h.mu.Unlock()

	h.loops.Go(func() {
		if err := h.claim(looping, serving, each.image); err != nil {
			stop(err)
		}
	})
}

func judgedUnder(required protocol.HostRequirements) string {
	harnesses, _ := json.Marshal(required.Harnesses)
	return required.Runner.Minimum + "\x00" + string(harnesses)
}

func (h *Host) examine(ctx context.Context, each *served) (examined, error) {
	each.examining.Lock()
	defer each.examining.Unlock()

	pulled, err := h.pulled(ctx, each.image)
	if err != nil {
		h.mu.Lock()
		defer h.mu.Unlock()
		each.id, each.digest, each.release, each.harnesses = "", "", "", nil
		each.unavailableReason = "Image can't be pulled. Error: " + err.Error()
		return examinedOf(each), err
	}

	h.mu.Lock()
	judging := judgedUnder(h.required)
	unchanged := each.id == pulled.ID && each.unavailableReason == "" && each.judged == judging
	candidates := h.required.Harnesses
	minimum := h.required.Runner.Minimum
	h.mu.Unlock()

	if unchanged {
		return h.snapshot(each), nil
	}

	report, err := h.found(ctx, pulled.ID, candidates)

	h.mu.Lock()
	defer h.mu.Unlock()

	each.id = pulled.ID
	each.judged = judging
	each.digest = pinned(each.image, pulled)
	if err != nil {
		each.unavailableReason = "Image can't be inspected. Error: " + err.Error()
		each.harnesses, each.release = nil, ""
		h.log.Warn("could not look inside the runner image", "image", each.image, "error", err)
		return examinedOf(each), nil
	}

	each.release = report.Release
	each.harnesses = report.Harnesses
	each.unavailableReason = images.RunnerTooOld(report.Release, minimum)
	if each.unavailableReason != "" {
		h.log.Warn("cannot use the runner image", "image", each.image, "reason", each.unavailableReason)
	} else {
		h.log.Info("serving the runner image", "image", each.image, "digest", each.digest,
			"release", each.release, "harnesses", each.harnesses)
	}
	if each.unavailableReason == "" && len(candidates) > 0 && len(each.harnesses) == 0 {
		h.log.Warn("the runner image holds no harness, so it runs checks but no agent run; install a harness in an image built from it",
			"image", each.image, "examples", images.HarnessExamples)
	}

	return examinedOf(each), nil
}

func (h *Host) snapshot(each *served) examined {
	h.mu.Lock()
	defer h.mu.Unlock()
	return examinedOf(each)
}

func examinedOf(each *served) examined {
	return examined{
		image:             each.image,
		isDefault:         each.isDefault,
		id:                each.id,
		digest:            each.digest,
		release:           each.release,
		harnesses:         slices.Clone(each.harnesses),
		unavailableReason: each.unavailableReason,
	}
}

func (h *Host) servedAs(image string) (examined, bool) {
	h.mu.Lock()
	defer h.mu.Unlock()

	each, ok := h.served[image]
	if !ok {
		return examined{}, false
	}
	return examinedOf(each), true
}

func (h *Host) pulled(ctx context.Context, image string) (sandbox.Image, error) {
	cached, err := h.engine.Inspect(ctx, image)
	have := err == nil
	if err != nil && !errors.Is(err, sandbox.ErrNoImage) {
		return sandbox.Image{}, err
	}
	if have && (strings.Contains(image, "@") || len(cached.Digests) == 0) {
		return cached, nil
	}

	auth, err := h.opts.Registry.For(image)
	if err != nil {
		return sandbox.Image{}, err
	}

	if err := h.engine.Pull(ctx, image, auth); err != nil {
		if have {
			h.log.Warn("could not pull the runner image, so it runs the copy it has", "image", image, "error", err)
			return cached, nil
		}
		return sandbox.Image{}, err
	}

	return h.engine.Inspect(ctx, image)
}

func (h *Host) found(ctx context.Context, image string, candidates []protocol.HarnessProbe) (protocol.Registration, error) {
	encoded, err := json.Marshal(candidates)
	if err != nil {
		return protocol.Registration{}, err
	}

	ctx, cancel := context.WithTimeout(ctx, probeLongest)
	defer cancel()

	env, harnessKeys := standInsFor(h.now().SandboxEnv)
	sidecar, err := h.egressSidecar(ctx, "probe-"+strings.ToLower(rand.Text()[:12]), map[string]string{LabelHost: h.opts.HostID}, "", harnessKeys,
		probeEgressWait)
	defer sidecar.close()
	if err != nil {
		return protocol.Registration{}, fmt.Errorf("start the probe's egress: %w", err)
	}

	id, err := h.engine.Start(ctx, sandbox.Spec{
		Image:   image,
		Args:    []string{"harnesses", string(encoded)},
		Env:     append(env, sidecar.env()...),
		Labels:  map[string]string{LabelHost: h.opts.HostID},
		Files:   sidecar.files(),
		Network: sidecar.network,
	})
	defer h.destroy(id)
	if err != nil {
		return protocol.Registration{}, err
	}

	code, err := h.engine.Wait(ctx, id)
	if err != nil {
		return protocol.Registration{}, err
	}
	if code != 0 {
		return protocol.Registration{}, fmt.Errorf("the runner image answered with exit %d", code)
	}

	var output lines
	if err := h.engine.Follow(ctx, id, &output); err != nil {
		return protocol.Registration{}, err
	}

	var reported protocol.Registration
	if err := json.Unmarshal([]byte(output.last()), &reported); err != nil {
		return protocol.Registration{}, fmt.Errorf("read what the runner image has: %w", err)
	}

	return reported, nil
}

func (h *Host) reportedImages() []protocol.HostImage {
	h.mu.Lock()
	defer h.mu.Unlock()

	reported := make([]protocol.HostImage, 0, len(h.served)+len(h.disallowed))
	for _, each := range h.served {
		if each.id == "" && each.unavailableReason == "" {
			continue
		}
		reported = append(reported, protocol.HostImage{
			Image:             each.image,
			Digest:            each.digest,
			IsDefault:         each.isDefault,
			Release:           each.release,
			Harnesses:         slices.Clone(each.harnesses),
			UnavailableReason: each.unavailableReason,
		})
	}
	for _, image := range h.disallowed {
		reported = append(reported, protocol.HostImage{Image: image, UnavailableReason: notAllowed})
	}

	slices.SortFunc(reported, func(a, b protocol.HostImage) int {
		if a.IsDefault != b.IsDefault {
			if a.IsDefault {
				return -1
			}
			return 1
		}
		return strings.Compare(a.Image, b.Image)
	})

	return reported
}

func pinned(image string, pulled sandbox.Image) string {
	name := repository(image)
	for _, digest := range pulled.Digests {
		if repository(digest) == name {
			return digest
		}
	}
	return name + "@" + pulled.ID
}

func repository(image string) string {
	name, _, _ := strings.Cut(image, "@")
	if slash, colon := strings.LastIndex(name, "/"), strings.LastIndex(name, ":"); colon > slash {
		name = name[:colon]
	}
	name = strings.TrimPrefix(name, "docker.io/")
	return strings.TrimPrefix(name, "library/")
}
