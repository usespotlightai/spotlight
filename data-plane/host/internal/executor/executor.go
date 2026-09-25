package executor

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

type Sandbox struct {
	Name       string
	Image      string
	Args       []string
	Env        []string
	Labels     map[string]string
	Mounts     []Mount
	Files      []File
	Network    string
	ExtraHosts []string
}

type Mount struct {
	Source   string
	Target   string
	ReadOnly bool
}

type File struct {
	Path string
	Mode int64
	Body []byte
}

type Executor interface {
	Describe(ctx context.Context) (string, error)
	Inspect(ctx context.Context, image string) (Image, error)
	Pull(ctx context.Context, image, auth string) error
	Start(ctx context.Context, sandbox Sandbox) (string, error)
	Follow(ctx context.Context, id string, out io.Writer) error
	Wait(ctx context.Context, id string) (int, error)
	Stop(ctx context.Context, id string, grace time.Duration) error
	Destroy(ctx context.Context, id string) error
	Labelled(ctx context.Context, key, value string) ([]string, error)
}
