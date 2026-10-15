package archive

import (
	"archive/tar"
	"compress/gzip"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"hash"
	"io"
	"io/fs"
	"os"
	"path/filepath"
	"syscall"
)

const (
	MostBytes         int64 = 2 << 30
	MostUnpackedBytes int64 = 8 << 30
)

var ErrTooLarge = fmt.Errorf(
	"the workspace is larger than %d bytes packed, or %d unpacked", MostBytes, MostUnpackedBytes,
)

const skipped = fs.ModeSocket | fs.ModeDevice | fs.ModeCharDevice | fs.ModeNamedPipe | fs.ModeIrregular

type Packed struct {
	Path   string
	Size   int64
	SHA256 string
}

func (p *Packed) Remove() error {
	if p == nil {
		return nil
	}
	return os.Remove(p.Path)
}

func Pack(dir, scratch string, leaveOut []string) (*Packed, error) {
	file, err := os.CreateTemp(scratch, "workspace-*.tar.gz")
	if err != nil {
		return nil, fmt.Errorf("make room to pack the workspace: %w", err)
	}

	packed := &Packed{Path: file.Name()}
	counted := &counter{into: file, sum: sha256.New()}

	err = write(dir, counted, leftOut(leaveOut))
	if closeErr := file.Close(); err == nil {
		err = closeErr
	}
	if err != nil {
		_ = packed.Remove()
		return nil, err
	}

	packed.Size = counted.bytes
	packed.SHA256 = hex.EncodeToString(counted.sum.Sum(nil))

	return packed, nil
}

func leftOut(names []string) map[string]bool {
	left := make(map[string]bool, len(names))
	for _, each := range names {
		left[filepath.ToSlash(filepath.Clean(each))] = true
	}
	return left
}

func write(dir string, into io.Writer, leaveOut map[string]bool) error {
	root, err := os.OpenRoot(dir)
	if err != nil {
		return fmt.Errorf("open the workspace to pack: %w", err)
	}
	defer root.Close()

	zipped, err := gzip.NewWriterLevel(into, gzip.BestSpeed)
	if err != nil {
		return err
	}
	archive := &packing{into: tar.NewWriter(zipped), root: root}

	walked := filepath.WalkDir(dir, func(path string, entry fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if path == dir {
			return nil
		}

		name, err := filepath.Rel(dir, path)
		if err != nil {
			return err
		}
		if leaveOut[filepath.ToSlash(name)] {
			if entry.IsDir() {
				return filepath.SkipDir
			}
			return nil
		}

		info, err := entry.Info()
		if err != nil {
			return err
		}
		if info.Mode()&skipped != 0 {
			return nil
		}

		return archive.add(filepath.ToSlash(name), info)
	})
	if walked != nil {
		return fmt.Errorf("pack the workspace: %w", walked)
	}

	if err := archive.into.Close(); err != nil {
		return fmt.Errorf("pack the workspace: %w", err)
	}
	if err := zipped.Close(); err != nil {
		return fmt.Errorf("pack the workspace: %w", err)
	}

	return nil
}

type packing struct {
	into     *tar.Writer
	root     *os.Root
	unpacked int64
}

func (p *packing) add(name string, seen fs.FileInfo) error {
	switch {
	case seen.IsDir():
		return p.header(name+"/", seen, "")
	case seen.Mode()&fs.ModeSymlink != 0:
		link, err := p.root.Readlink(name)
		if err != nil {
			return err
		}
		return p.header(name, seen, link)
	case seen.Mode().IsRegular():
		return p.file(name)
	default:
		return nil
	}
}

// file opens the name through the root and checks the open file, so it does not follow a link that replaced the file after the walk.
func (p *packing) file(name string) error {
	file, err := p.root.OpenFile(name, os.O_RDONLY|syscall.O_NONBLOCK, 0)
	if err != nil {
		return err
	}
	defer file.Close()

	info, err := file.Stat()
	if err != nil {
		return err
	}
	if !info.Mode().IsRegular() {
		return nil
	}

	p.unpacked += info.Size()
	if p.unpacked > MostUnpackedBytes {
		return ErrTooLarge
	}

	if err := p.header(name, info, ""); err != nil {
		return err
	}

	_, err = io.CopyN(p.into, file, info.Size())
	return err
}

func (p *packing) header(name string, info fs.FileInfo, link string) error {
	header, err := tar.FileInfoHeader(info, link)
	if err != nil {
		return err
	}
	header.Name = name
	header.Uname, header.Gname = "", ""
	header.Format = tar.FormatPAX

	return p.into.WriteHeader(header)
}

type counter struct {
	into  io.Writer
	sum   hash.Hash
	bytes int64
}

func (c *counter) Write(p []byte) (int, error) {
	if c.bytes+int64(len(p)) > MostBytes {
		return 0, ErrTooLarge
	}

	n, err := c.into.Write(p)
	c.bytes += int64(n)
	c.sum.Write(p[:n])

	if err == nil && n < len(p) {
		err = io.ErrShortWrite
	}
	return n, err
}
