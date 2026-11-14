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
	ErrInUse   = errors.New("the image is in use")
)

type Build struct {
	Tag        string
	Dockerfile []byte
	Args       map[string]string
}

type Image struct {
	ID      string
	Tags    []string
	Digests []string
	Size    int64
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
	Limits     Limits
}

type Limits struct {
	Memory      int64
	OOMScoreAdj int
}

type Join struct {
	Network string
	Aliases []string
}

type Mount struct {
	Source   string
	Target   string
	ReadOnly bool
	Volume   bool
}

type File struct {
	Path    string
	Mode    int64
	DirMode int64
	Body    []byte
}

type Container struct {
	ID      string
	Labels  map[string]string
	Running bool
	Created time.Time
}

type Network struct {
	ID   string
	Name string
}

type Engine interface {
	Describe(ctx context.Context) (string, error)
	Inspect(ctx context.Context, image string) (Image, error)
	Pull(ctx context.Context, image, auth string) error
	Images(ctx context.Context) ([]Image, error)
	Remove(ctx context.Context, image string) error
	Used(ctx context.Context, image string) (bool, error)
	Start(ctx context.Context, spec Spec) (string, error)
	Put(ctx context.Context, id string, file File) error
	Signal(ctx context.Context, id, signal string) error
	Follow(ctx context.Context, id string, since time.Time, out io.Writer) error
	Wait(ctx context.Context, id string) (int, error)
	Stop(ctx context.Context, id string, grace time.Duration) error
	Destroy(ctx context.Context, id string) error
	Labelled(ctx context.Context, key, value string) ([]Container, error)
	Read(ctx context.Context, id, path string) ([]byte, error)
	Exec(ctx context.Context, id string, command []string, errs io.Writer) (io.ReadWriteCloser, error)
	Network(ctx context.Context, name string, labels map[string]string) (string, error)
	Unnetwork(ctx context.Context, id string) error
	Networks(ctx context.Context, key, value string) ([]Network, error)
	Attached(ctx context.Context, network string) ([]string, error)
}
