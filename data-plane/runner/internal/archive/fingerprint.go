package archive

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
)

func Fingerprint(dir string, leaveOut []string) (string, error) {
	sum := sha256.New()
	left := leftOut(leaveOut)

	err := filepath.WalkDir(dir, func(path string, entry fs.DirEntry, err error) error {
		if err != nil {
			return err
		}

		name, err := filepath.Rel(dir, path)
		if err != nil {
			return err
		}
		if left[filepath.ToSlash(name)] {
			if entry.IsDir() {
				return filepath.SkipDir
			}
			return nil
		}

		info, err := entry.Info()
		if err != nil {
			return err
		}

		link := ""
		if info.Mode()&fs.ModeSymlink != 0 {
			if link, err = os.Readlink(path); err != nil {
				return err
			}
		}

		size := info.Size()
		if info.IsDir() {
			size = 0
		}

		_, err = fmt.Fprintf(sum, "%s\x00%o\x00%d\x00%d\x00%s\n",
			filepath.ToSlash(name), info.Mode(), size, info.ModTime().UnixNano(), link)
		return err
	})
	if err != nil {
		return "", fmt.Errorf("take the workspace's fingerprint: %w", err)
	}

	return hex.EncodeToString(sum.Sum(nil)), nil
}
