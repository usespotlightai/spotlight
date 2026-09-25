package archive

import (
	"archive/tar"
	"compress/gzip"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"os"
	"path"
	"strings"
)

var ErrOutside = errors.New("the archive reaches outside the workspace")

func Unpack(from io.Reader, dir string) error {
	root, err := os.OpenRoot(dir)
	if err != nil {
		return fmt.Errorf("open the workspace to restore into: %w", err)
	}
	defer root.Close()

	unzipped, err := gzip.NewReader(from)
	if err != nil {
		return fmt.Errorf("restore the workspace: %w", err)
	}
	defer unzipped.Close()

	archive := tar.NewReader(unzipped)
	restoring := &restoring{root: root, owned: os.Geteuid() == 0}

	for {
		header, err := archive.Next()
		if errors.Is(err, io.EOF) {
			return restoring.settle()
		}
		if err != nil {
			return fmt.Errorf("restore the workspace: %w", err)
		}

		name, err := within(header.Name)
		if err != nil {
			return fmt.Errorf("restore %q: %w", header.Name, err)
		}
		if name == "." {
			continue
		}

		if err := restoring.place(archive, header, name); err != nil {
			return fmt.Errorf("restore %q: %w", header.Name, err)
		}
	}
}

func within(name string) (string, error) {
	cleaned := path.Clean(strings.TrimSuffix(name, "/"))

	if path.IsAbs(cleaned) || cleaned == ".." || strings.HasPrefix(cleaned, "../") {
		return "", ErrOutside
	}

	return cleaned, nil
}

type folder struct {
	name string
	mode fs.FileMode
	uid  int
	gid  int
}

type restoring struct {
	root     *os.Root
	owned    bool
	unpacked int64
	folders  []folder
}

func (r *restoring) place(archive *tar.Reader, header *tar.Header, name string) error {
	mode := fs.FileMode(header.Mode).Perm()

	if parent := path.Dir(name); parent != "." {
		if err := r.root.MkdirAll(parent, 0o700); err != nil {
			return err
		}
	}

	if err := r.makeRoom(name, header.Typeflag == tar.TypeDir); err != nil {
		return err
	}

	switch header.Typeflag {
	case tar.TypeDir:
		if err := r.root.MkdirAll(name, 0o700); err != nil {
			return err
		}
		r.folders = append(r.folders, folder{name: name, mode: mode, uid: header.Uid, gid: header.Gid})
		return nil
	case tar.TypeReg:
		r.unpacked += header.Size
		if header.Size < 0 || r.unpacked > MostUnpackedBytes {
			return ErrTooLarge
		}
		if err := r.write(archive, header, name, mode); err != nil {
			return err
		}
	case tar.TypeSymlink:
		if err := r.root.Symlink(header.Linkname, name); err != nil {
			return err
		}
	default:
		return nil
	}

	if r.owned {
		return r.root.Lchown(name, header.Uid, header.Gid)
	}
	return nil
}

func (r *restoring) write(archive *tar.Reader, header *tar.Header, name string, mode fs.FileMode) error {
	file, err := r.root.OpenFile(name, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, mode)
	if err != nil {
		return err
	}
	_, copyErr := io.CopyN(file, archive, header.Size)
	if closeErr := file.Close(); copyErr == nil {
		copyErr = closeErr
	}
	if copyErr != nil {
		return copyErr
	}
	if err := r.root.Chmod(name, mode); err != nil {
		return err
	}
	return r.root.Chtimes(name, header.ModTime, header.ModTime)
}

func (r *restoring) makeRoom(name string, dir bool) error {
	there, err := r.root.Lstat(name)
	if err != nil {
		return nil
	}
	if dir && there.IsDir() {
		return nil
	}
	return r.root.RemoveAll(name)
}

// Deepest first, so a folder that allows no writing is closed only once everything in it is written.
func (r *restoring) settle() error {
	for i := len(r.folders) - 1; i >= 0; i-- {
		placed := r.folders[i]
		if r.owned {
			if err := r.root.Lchown(placed.name, placed.uid, placed.gid); err != nil {
				return fmt.Errorf("restore %q: %w", placed.name, err)
			}
		}
		if err := r.root.Chmod(placed.name, placed.mode); err != nil {
			return fmt.Errorf("restore %q: %w", placed.name, err)
		}
	}
	return nil
}
