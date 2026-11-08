package session

import (
	"context"
	"errors"
	"fmt"
	"log/slog"

	"usespotlight.ai/data-plane/protocol"
	"usespotlight.ai/data-plane/runner/internal/account"
	"usespotlight.ai/data-plane/runner/internal/prepare"
)

type WarmOptions struct {
	Mirrors   string
	AgentUser *account.User
	ProxyEnv  map[string]string
	Log       *slog.Logger
}

func (s *Sandbox) Warm(ctx context.Context, warm protocol.WarmSandbox, opts WarmOptions) error {
	if s.space == nil {
		return errors.New("the sandbox has no open workspace")
	}

	checkouts := make([]protocol.Checkout, 0, len(warm.Checkouts))
	for _, each := range warm.Checkouts {
		if err := prepare.FromMirror(ctx, opts.Mirrors, s.space.Dir, each); err != nil {
			return err
		}
		checkouts = append(checkouts, protocol.Checkout{Path: each.Path, Setup: each.Setup})
	}

	if opts.AgentUser != nil {
		if err := s.space.ChownAll(opts.AgentUser.UID, opts.AgentUser.GID); err != nil {
			return fmt.Errorf("hand over the warm workspace: %w", err)
		}
	}

	if s.kept == nil {
		s.kept = &kept{}
	}
	s.kept.archives = false
	if s.setUp == nil {
		s.setUp = setUps{}
	}
	setUp := Options{AgentUser: opts.AgentUser, ProxyEnv: opts.ProxyEnv}
	for _, failure := range setUp.setUp(ctx, s.space.Dir, checkouts, s.setUp, &journalWriter{}, opts.Log) {
		opts.Log.Warn("a warm setup failed; the first run sets up again", "path", failure.path, "error", failure.err)
	}

	return nil
}
