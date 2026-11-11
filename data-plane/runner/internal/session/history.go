package session

import (
	"context"
	"encoding/json"
	"fmt"

	"usespotlight.ai/data-plane/protocol"
)

type historian interface {
	History(ctx context.Context, runID string, request protocol.HistoryRequest) (json.RawMessage, error)
	SearchView(ctx context.Context, runID string) (json.RawMessage, error)
}

func history(
	ctx context.Context, from historian, run protocol.Run, request protocol.HistoryRequest,
) (json.RawMessage, error) {
	read, err := from.History(ctx, run.ID, request)
	if err != nil || !searches(run) {
		return read, err
	}

	view, err := from.SearchView(ctx, run.ID)
	if err != nil {
		return nil, err
	}

	return withSearchView(read, view)
}

func withSearchView(history, view json.RawMessage) (json.RawMessage, error) {
	var fields map[string]json.RawMessage
	if err := json.Unmarshal(history, &fields); err != nil {
		return nil, fmt.Errorf("read the history: %w", err)
	}

	var seen struct {
		Configs    []json.RawMessage `json:"configs"`
		Candidates json.RawMessage   `json:"candidates"`
		SeedBlock  json.RawMessage   `json:"seedBlock"`
	}
	if err := json.Unmarshal(view, &seen); err != nil {
		return nil, fmt.Errorf("read the search view: %w", err)
	}

	if fields == nil {
		fields = map[string]json.RawMessage{}
	}
	if len(seen.Configs) > 0 {
		configs, err := withConfigs(fields["configs"], seen.Configs)
		if err != nil {
			return nil, err
		}
		fields["configs"] = configs
	}
	if seen.Candidates != nil {
		fields["candidates"] = seen.Candidates
	}
	if seen.SeedBlock != nil {
		fields["seedBlock"] = seen.SeedBlock
	}

	return json.Marshal(fields)
}

func withConfigs(listed json.RawMessage, more []json.RawMessage) (json.RawMessage, error) {
	var configs []json.RawMessage
	if len(listed) > 0 && string(listed) != "null" {
		if err := json.Unmarshal(listed, &configs); err != nil {
			return nil, fmt.Errorf("read the history configs: %w", err)
		}
	}

	named := map[string]bool{}
	for _, config := range configs {
		fingerprint, err := fingerprintOf(config)
		if err != nil {
			return nil, err
		}
		named[fingerprint] = true
	}
	for _, config := range more {
		fingerprint, err := fingerprintOf(config)
		if err != nil {
			return nil, err
		}
		if !named[fingerprint] {
			named[fingerprint] = true
			configs = append(configs, config)
		}
	}

	return json.Marshal(configs)
}

func fingerprintOf(config json.RawMessage) (string, error) {
	var named struct {
		Fingerprint string `json:"fingerprint"`
	}
	if err := json.Unmarshal(config, &named); err != nil {
		return "", fmt.Errorf("read a history config: %w", err)
	}

	return named.Fingerprint, nil
}
