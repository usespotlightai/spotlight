package session

import (
	"context"
	"encoding/json"
	"errors"
	"io/fs"
	"log/slog"
	"maps"
	"os"
	"path/filepath"
	"slices"

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

func (s setUps) clone() setUps {
	if s == nil {
		return nil
	}
	return maps.Clone(s)
}

func (s setUps) paths() []string {
	return slices.Sorted(maps.Keys(s))
}

// readSetupRecord answers nil when there is no record, so the sandbox sets up as if it were new.
func readSetupRecord(file string, log *slog.Logger) setUps {
	if file == "" {
		return nil
	}
	body, err := os.ReadFile(file)
	if errors.Is(err, fs.ErrNotExist) {
		return nil
	}
	if err != nil {
		log.Warn("could not read the setups this sandbox's image ran; setting up again", "error", err)
		return nil
	}
	var record protocol.SetupRecord
	if err := json.Unmarshal(body, &record); err != nil || !record.Complete || len(record.Checkouts) == 0 {
		return nil
	}
	return setUps(record.Checkouts)
}

func writeSetupRecord(file string, done setUps, complete, ran bool) error {
	if file == "" {
		return nil
	}
	body, err := json.Marshal(protocol.SetupRecord{Checkouts: done, Complete: complete, Ran: ran})
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(file), 0o755); err != nil {
		return err
	}
	written := file + ".writing"
	if err := os.WriteFile(written, body, 0o644); err != nil {
		return err
	}
	return os.Rename(written, file)
}
