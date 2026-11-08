package session

import (
	"context"
	"log/slog"

	"usespotlight.ai/data-plane/protocol"
	"usespotlight.ai/data-plane/runner/internal/prepare"
)

type setUps map[string]string

func (s setUps) unchanged(ctx context.Context, tree string, checkout protocol.Checkout, log *slog.Logger) bool {
	recorded, ok := s[checkout.Path]
	if !ok {
		return false
	}
	delete(s, checkout.Path)

	inputs, err := prepare.SetupInputs(ctx, tree, checkout.Setup)
	if err != nil {
		log.Warn("could not compare the setup inputs; setting up again", "path", checkout.Path, "error", err)
		return false
	}
	if inputs != recorded {
		return false
	}

	s[checkout.Path] = inputs
	return true
}

func (s setUps) record(ctx context.Context, tree string, checkout protocol.Checkout, log *slog.Logger) {
	inputs, err := prepare.SetupInputs(ctx, tree, checkout.Setup)
	if err != nil {
		log.Warn("could not record the setup inputs; the next run sets up again", "path", checkout.Path, "error", err)
		return
	}
	s[checkout.Path] = inputs
}
