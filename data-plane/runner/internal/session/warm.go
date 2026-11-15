package session

import (
	"context"
	"errors"
	"fmt"
	"io/fs"
	"log/slog"
	"os"
	"path/filepath"

	"usespotlight.ai/data-plane/protocol"
	"usespotlight.ai/data-plane/runner/internal/account"
	"usespotlight.ai/data-plane/runner/internal/prepare"
)

type WarmOptions struct {
	Mirrors     string
	AgentUser   *account.User
	ProxyEnv    map[string]string
	Log         *slog.Logger
	SetupRecord string
}

func (s *Sandbox) Warm(ctx context.Context, warm protocol.WarmSandbox, opts WarmOptions) error {
	if s.space == nil {
		return errors.New("the sandbox has no open workspace")
	}

	fromImage := false
	if opts.SetupRecord != "" {
		_, err := os.Stat(opts.SetupRecord)
		fromImage = err == nil
		if err := os.Remove(opts.SetupRecord); err != nil && !errors.Is(err, fs.ErrNotExist) {
			return fmt.Errorf("clear the setups of the sandbox's image: %w", err)
		}
	}

	trusted := s.pristine.clone()
	checkouts := make([]protocol.Checkout, 0, len(warm.Checkouts))
	for _, each := range warm.Checkouts {
		if _, err := os.Stat(filepath.Join(s.space.Dir, each.Path, ".git")); err != nil {
			delete(trusted, each.Path)
		}
		if err := prepare.FromMirror(ctx, opts.Mirrors, s.space.Dir, each, fromImage); err != nil {
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
		s.setUp = trusted
	}
	if s.setUp == nil {
		s.setUp = setUps{}
	}
	setUp := Options{AgentUser: opts.AgentUser, ProxyEnv: opts.ProxyEnv}
	failures, ran := setUp.setUp(ctx, s.space.Dir, checkouts, s.setUp, &journalWriter{}, opts.Log)
	for _, failure := range failures {
		opts.Log.Warn("a warm setup failed; the first run sets up again", "path", failure.path, "error", failure.err)
	}

	complete := len(failures) == 0
	for _, each := range checkouts {
		if _, ok := s.setUp[each.Path]; each.Setup != "" && !ok {
			complete = false
		}
	}
	s.pristine, s.pristineRead = nil, true
	if complete {
		s.pristine = s.setUp.clone()
	}
	if err := writeSetupRecord(opts.SetupRecord, s.setUp.clone(), complete, ran > 0); err != nil {
		opts.Log.Warn("could not record the warm setups; a sandbox from this one's image sets up again", "error", err)
	}

	return nil
}
