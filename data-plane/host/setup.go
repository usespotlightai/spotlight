package host

import (
	"context"
	"errors"
	"fmt"
	"os"
	"slices"
	"strings"

	"usespotlight.ai/data-plane/credentials"
	"usespotlight.ai/data-plane/host/internal/config"
	"usespotlight.ai/data-plane/host/internal/dashboard"
	"usespotlight.ai/data-plane/host/internal/harnesses"
	"usespotlight.ai/data-plane/host/internal/resources"
	"usespotlight.ai/data-plane/host/internal/sandbox/docker"
)

type localSetup struct {
	version string
}

func (s localSetup) api(address string) (*resources.Client, error) {
	token, err := credentials.Stored(os.Getenv, address)
	if err != nil {
		return nil, err
	}
	return resources.New(address, token, s.version)
}

func (s localSetup) Workspaces(ctx context.Context, address string) ([]dashboard.Workspace, error) {
	api, err := s.api(address)
	if err != nil {
		return nil, err
	}
	found, err := api.Workspaces(ctx)
	shown := make([]dashboard.Workspace, 0, len(found))
	for _, each := range found {
		shown = append(shown, dashboard.Workspace{ID: each.ID, Name: each.Name, Slug: each.Slug})
	}
	return shown, err
}

func (s localSetup) HeldKeys(ctx context.Context, address, workspace string) ([]string, error) {
	api, err := s.api(address)
	if err != nil {
		return nil, err
	}
	secrets, err := api.Secrets(ctx, workspace)
	if err != nil {
		return nil, asAdmin(err)
	}
	var held []string
	for _, each := range secrets {
		if _, known := harnesses.KeyNamed(each.Name); known {
			held = append(held, each.Name)
		}
	}
	return held, nil
}

func (s localSetup) SaveKey(ctx context.Context, address, workspace, name, value string) error {
	key, known := harnesses.KeyNamed(name)
	if !known {
		return fmt.Errorf("%s is not a harness key", name)
	}
	api, err := s.api(address)
	if err != nil {
		return err
	}
	secrets, err := api.Secrets(ctx, workspace)
	if err != nil {
		return err
	}
	var held *resources.Secret
	if at := slices.IndexFunc(secrets, func(each resources.Secret) bool { return each.Name == name }); at >= 0 {
		held = &secrets[at]
	}
	binding := resources.Binding{Host: key.Host, Location: "header", Name: key.Header, Prefix: key.Prefix}
	return asAdmin(api.SaveSecret(ctx, workspace, held, name, value, binding))
}

func (s localSetup) MakePool(ctx context.Context, address, workspace, name, token, idempotencyKey string) error {
	api, err := s.api(address)
	if err != nil {
		return err
	}
	err = api.PullPool(ctx, workspace, name, token, idempotencyKey)
	if errors.Is(err, resources.ErrNameTaken) {
		return dashboard.ErrPoolNameTaken
	}
	return asAdmin(err)
}

func (s localSetup) Build(ctx context.Context, ids []string, progress func(string)) (string, error) {
	var picked []harnesses.Harness
	for _, each := range harnesses.All() {
		if slices.Contains(ids, each.ID) {
			picked = append(picked, each)
		}
	}

	file, err := config.Open(config.Path())
	if err != nil {
		return "", err
	}
	engine, err := docker.Connect(file.Values()["DOCKER_HOST"])
	if err != nil {
		return "", fmt.Errorf("no container runtime answers. Start Docker or Podman, then try again: %w", err)
	}

	tag := harnesses.Tag(s.version, picked)
	return tag, harnesses.BuildImage(ctx, engine, config.DefaultImage(s.version), tag, picked, progress)
}

func (s localSetup) SuggestedName() string {
	name, err := os.Hostname()
	if err != nil {
		return "host"
	}
	name, _, _ = strings.Cut(strings.ToLower(name), ".")
	slug := strings.Trim(strings.Join(strings.FieldsFunc(name, func(r rune) bool {
		return (r < 'a' || r > 'z') && (r < '0' || r > '9')
	}), "-"), "-")
	if slug == "" {
		return "host"
	}
	return slug
}

func asAdmin(err error) error {
	if errors.Is(err, resources.ErrNotAdmin) {
		return errors.New("only a workspace admin can keep keys and make pools. Ask an admin to set up this host, or for a pool token for spotlight host init --token")
	}
	return err
}
