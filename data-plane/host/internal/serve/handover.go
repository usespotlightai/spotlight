package serve

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"maps"
	"time"

	"usespotlight.ai/data-plane/host/internal/sandbox"
	"usespotlight.ai/data-plane/protocol"
)

func (h *Host) handOver(why string) {
	h.mu.Lock()
	if !h.updated {
		h.updated = true
		close(h.handover)
	}
	stop := h.stopClaiming
	running := len(h.running)
	h.mu.Unlock()

	h.log.Info(why+"; it restarts now, and the restarted host takes over its running sandboxes", "running", running)
	if stop != nil {
		stop()
	}
}

type taken struct {
	live     liveSandbox
	draining <-chan struct{}
}

type leftBehind struct {
	taken []taken
	other []string
}

// takeOver must run before the first heartbeat. If not, Spotlight counts the sandboxes as lost.
func (h *Host) takeOver(ctx context.Context) leftBehind {
	containers, err := h.engine.Labelled(ctx, LabelHost, h.opts.HostID)
	if err != nil {
		h.log.Warn("could not look for sandboxes left behind", "error", err)
		return leftBehind{}
	}

	networks, err := h.engine.Networks(ctx, LabelHost, h.opts.HostID)
	if err != nil {
		h.log.Warn("could not look for the networks of sandboxes left behind", "error", err)
	}

	egresses := map[string]sandbox.Container{}
	for _, each := range containers {
		if name := each.Labels[LabelEgress]; name != "" && each.Running {
			egresses[name] = each
		}
	}

	kept := map[string]bool{}
	var left leftBehind
	for _, each := range containers {
		if each.Labels[LabelImage] == "" || !each.Running {
			continue
		}

		live, err := h.adopted(ctx, each, egresses, networks)
		if err != nil {
			h.log.Warn("could not take over a sandbox left behind, so it is destroyed", "sandbox", each.ID, "error", err)
			continue
		}

		kept[live.id], kept[live.sidecar.container] = true, true
		h.holdNetwork(live.sidecar.networkName)
		h.slots.occupy()
		draining := h.hold(live.sandboxID)
		h.placed(live.sandboxID, live.id)
		if live.runnerID != "" {
			h.track(live.id, live.runnerID)
		}
		left.taken = append(left.taken, taken{live: live, draining: draining})
		h.log.Info("took over a running sandbox", "sandbox", live.id, "sandboxId", live.sandboxID, "runner", live.runnerID)
	}

	for _, each := range containers {
		if !kept[each.ID] {
			left.other = append(left.other, each.ID)
		}
	}

	return left
}

func (h *Host) adopted(
	ctx context.Context, container sandbox.Container, egresses map[string]sandbox.Container, networks []sandbox.Network,
) (liveSandbox, error) {
	labels := container.Labels
	name := nameOf(protocol.Assignment{RunnerID: labels[LabelRunner], SandboxID: labels[LabelSandbox]})

	egress, ok := egresses[name]
	if !ok {
		return liveSandbox{}, errors.New("its egress is not running")
	}

	body, err := h.engine.Read(ctx, egress.ID, protocol.EgressConfigPath)
	if err != nil {
		return liveSandbox{}, fmt.Errorf("read its egress settings: %w", err)
	}
	var config protocol.EgressConfig
	if err := json.Unmarshal(body, &config); err != nil {
		return liveSandbox{}, fmt.Errorf("read its egress settings: %w", err)
	}

	authority, err := h.engine.Read(ctx, egress.ID, protocol.EgressAuthority)
	if err != nil {
		return liveSandbox{}, fmt.Errorf("read its egress authority: %w", err)
	}

	networkName, network := "spotlight-"+name, ""
	for _, each := range networks {
		if each.Name == networkName {
			network = each.ID
		}
	}
	if network == "" {
		return liveSandbox{}, fmt.Errorf("its network %s is gone", networkName)
	}

	sidecarLabels := maps.Clone(egress.Labels)
	delete(sidecarLabels, LabelEgress)

	return liveSandbox{
		id:        container.ID,
		sandboxID: labels[LabelSandbox],
		runnerID:  egress.Labels[LabelRunner],
		image:     labels[LabelImage],
		digest:    labels[LabelDigest],
		started:   container.Created,
		sidecar: &egressSidecar{
			host:         h,
			name:         name,
			labels:       sidecarLabels,
			keys:         config.HarnessKeys,
			wait:         egressWaitOr(h.opts.EgressWait),
			sandboxHosts: config.SandboxHosts,
			networkName:  networkName,
			network:      network,
			container:    egress.ID,
			credential:   config.Credential,
			authority:    authority,
		},
	}, nil
}

func (h *Host) reap(ctx context.Context, left leftBehind) {
	for _, id := range left.other {
		if err := h.engine.Destroy(ctx, id); err != nil {
			h.log.Warn("could not destroy a sandbox left behind", "sandbox", id, "error", err)
			continue
		}
		h.log.Info("destroyed a sandbox left behind", "sandbox", id)
	}

	h.sweepNetworks(ctx)
}

func (h *Host) superviseTaken(claiming, serving context.Context, taken []taken) {
	since := time.Now()
	for _, each := range taken {
		log := h.log.With("runner", each.live.runnerID, "sandbox", each.live.id)
		if each.live.sandboxID != "" {
			log = log.With("sandboxId", each.live.sandboxID)
		}

		h.sandboxes.Go(func() {
			defer h.slots.give()
			if kept := h.supervise(serving, claiming, each.live, each.draining, since, log); !kept {
				each.live.sidecar.close()
				h.release(each.live.sandboxID)
			}
		})
	}
}
