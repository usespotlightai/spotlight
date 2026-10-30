package editorservers

import (
	"crypto/rand"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"os"
	"path"
	"syscall"
)

// Share only release binaries. Pid files, logs and sockets belong to one sandbox.
var homes = map[string][]string{
	".vscode-server": {"code-*", "cli/servers/*/server", "bin/*"},
	".cursor-server": {"cursor-*", "cli/servers/*/server", "bin/*"},
}

type Owner struct {
	UID int
	GID int
}

// The agent controls both folders. Do all file operations through an os.Root, so that a symbolic link cannot lead outside them.
func Share(cache, home string, owner *Owner) error {
	if info, err := os.Stat(cache); err != nil || !info.IsDir() {
		return nil
	}

	cached, err := os.OpenRoot(cache)
	if err != nil {
		return err
	}
	defer cached.Close()

	own, err := os.OpenRoot(home)
	if err != nil {
		return err
	}
	defer own.Close()

	var problems []error
	for folder, releases := range homes {
		from, err := opened(cached, folder, nil)
		if err != nil {
			problems = append(problems, err)
			continue
		}
		to, err := opened(own, folder, owner)
		if err != nil {
			from.Close()
			problems = append(problems, err)
			continue
		}

		for _, pattern := range releases {
			problems = append(problems,
				copyMissing(from, to, pattern, owner),
				copyMissing(to, from, pattern, nil),
			)
		}
		from.Close()
		to.Close()
	}

	return errors.Join(problems...)
}

func opened(root *os.Root, folder string, owner *Owner) (*os.Root, error) {
	if err := makeDir(root, folder, 0o755, owner); err != nil {
		return nil, fmt.Errorf("open editor servers %s: %w", folder, err)
	}
	return root.OpenRoot(folder)
}

func makeDir(root *os.Root, name string, perm fs.FileMode, owner *Owner) error {
	err := root.Mkdir(name, perm)
	switch {
	case errors.Is(err, fs.ErrExist):
		return nil
	case err != nil:
		return err
	case owner != nil:
		return root.Lchown(name, owner.UID, owner.GID)
	}
	return nil
}

func copyMissing(from, to *os.Root, pattern string, owner *Owner) error {
	found, err := fs.Glob(from.FS(), pattern)
	if err != nil {
		return err
	}

	var problems []error
	for _, release := range found {
		if _, err := to.Lstat(release); err == nil {
			continue
		}
		if err := place(from, to, release, owner); err != nil {
			problems = append(problems, fmt.Errorf("copy editor server %s: %w", release, err))
		}
	}

	return errors.Join(problems...)
}

// Copy next to the target and rename, so that a sandbox never sees half a release.
func place(from, to *os.Root, release string, owner *Owner) error {
	parent := path.Dir(release)
	if err := makeParents(to, parent, owner); err != nil {
		return err
	}

	staged := path.Join(parent, ".staged-"+rand.Text())
	if err := to.Mkdir(staged, 0o700); err != nil {
		return err
	}
	defer to.RemoveAll(staged)

	copied := path.Join(staged, path.Base(release))
	if err := copyTree(from, to, release, copied, owner); err != nil {
		return err
	}

	if err := to.Rename(copied, release); err != nil {
		if _, exists := to.Lstat(release); exists == nil {
			return nil
		}
		return err
	}

	return nil
}

func makeParents(root *os.Root, dir string, owner *Owner) error {
	if dir == "." {
		return nil
	}
	if err := makeParents(root, path.Dir(dir), owner); err != nil {
		return err
	}
	return makeDir(root, dir, 0o755, owner)
}

func copyTree(from, to *os.Root, source, target string, owner *Owner) error {
	return fs.WalkDir(from.FS(), source, func(name string, entry fs.DirEntry, err error) error {
		if err != nil {
			return err
		}

		relative := name[len(source):]
		destination := target + relative

		info, err := entry.Info()
		if err != nil {
			return err
		}

		switch {
		case entry.IsDir():
			err = to.Mkdir(destination, info.Mode().Perm())
		case info.Mode()&fs.ModeSymlink != 0:
			var link string
			if link, err = from.Readlink(name); err == nil {
				err = to.Symlink(link, destination)
			}
		case info.Mode().IsRegular():
			err = copyFile(from, to, name, destination, info.Mode().Perm())
		default:
			return nil
		}
		if err != nil {
			return err
		}

		if owner != nil {
			return to.Lchown(destination, owner.UID, owner.GID)
		}
		return nil
	})
}

func copyFile(from, to *os.Root, source, target string, mode fs.FileMode) error {
	in, err := from.OpenFile(source, os.O_RDONLY|syscall.O_NONBLOCK, 0)
	if err != nil {
		return err
	}
	defer in.Close()

	if info, err := in.Stat(); err != nil || !info.Mode().IsRegular() {
		return errors.Join(err, fmt.Errorf("%s is not a regular file", source))
	}

	out, err := to.OpenFile(target, os.O_WRONLY|os.O_CREATE|os.O_EXCL, mode)
	if err != nil {
		return err
	}
	if _, err := io.Copy(out, in); err != nil {
		out.Close()
		return err
	}
	return out.Close()
}
