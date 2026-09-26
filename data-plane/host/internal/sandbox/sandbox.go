package sandbox

import (
	"context"
	"errors"
	"io"
	"time"
)

var (
	ErrGone    = errors.New("no such sandbox")
	ErrNoImage = errors.New("no such image")
)

type Image struct {
	ID      string
	Digests []string
}

type Spec struct {
	Name       string
	Image      string
	Entrypoint []string
	Args       []string
	Env        []string
	Labels     map[string]string
	Mounts     []Mount
	Files      []File
	Network    string
	Joins      []Join
	ExtraHosts []string
}

type Join struct {
	Network string
	Aliases []string
}

type Mount struct {
	Source   string
	Target   string
	ReadOnly bool
}

type File struct {
	Path    string
	Mode    int64
	DirMode int64
	Body    []byte
}

type Engine interface {
	Describe(ctx context.Context) (string, error)
	Inspect(ctx context.Context, image string) (Image, error)
	Pull(ctx context.Context, image, auth string) error
	Start(ctx context.Context, spec Spec) (string, error)
	Follow(ctx context.Context, id string, out io.Writer) error
	Wait(ctx context.Context, id string) (int, error)
	Stop(ctx context.Context, id string, grace time.Duration) error
	Destroy(ctx context.Context, id string) error
	Labelled(ctx context.Context, key, value string) ([]string, error)
	Read(ctx context.Context, id, path string) ([]byte, error)
	Network(ctx context.Context, name string, labels map[string]string) (string, error)
	Unnetwork(ctx context.Context, id string) error
	Networks(ctx context.Context, key, value string) ([]string, error)
}
