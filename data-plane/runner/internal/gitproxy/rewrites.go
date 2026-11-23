package gitproxy

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
)

const (
	FastForwardsHeader = "Spotlight-Fast-Forwards"
	mostCommandBytes   = 1 << 20
)

var command = regexp.MustCompile(`^([0-9a-f]{40}|[0-9a-f]{64}) ([0-9a-f]{40}|[0-9a-f]{64}) (\S+)$`)

type update struct {
	from string
	to   string
	ref  string
}

func readCommands(body io.Reader) ([]update, []byte, error) {
	var read bytes.Buffer
	var updates []update

	for {
		size := make([]byte, 4)
		if _, err := io.ReadFull(body, size); err != nil {
			return nil, read.Bytes(), fmt.Errorf("read a push command: %w", err)
		}
		read.Write(size)

		length, err := strconv.ParseUint(string(size), 16, 16)
		if err != nil {
			return nil, read.Bytes(), fmt.Errorf("read a push command: %q is not a length", size)
		}
		if length == 0 {
			return updates, read.Bytes(), nil
		}
		if length < 4 || read.Len()+int(length) > mostCommandBytes {
			return nil, read.Bytes(), fmt.Errorf("read a push command: a length of %d is out of range", length)
		}

		line := make([]byte, length-4)
		if _, err := io.ReadFull(body, line); err != nil {
			return nil, read.Bytes(), fmt.Errorf("read a push command: %w", err)
		}
		read.Write(line)

		text, _, _ := strings.Cut(string(line), "\x00")
		if strings.HasPrefix(text, "shallow ") {
			continue
		}
		matched := command.FindStringSubmatch(strings.TrimRight(text, "\n"))
		if matched == nil {
			return nil, read.Bytes(), fmt.Errorf("read a push command: %q is not one", text)
		}
		updates = append(updates, update{from: matched[1], to: matched[2], ref: matched[3]})
	}
}

func fastForwards(ctx context.Context, repository string, updates []update) []string {
	var verified []string
	for _, each := range updates {
		if isNoObject(each.from) || isNoObject(each.to) {
			continue
		}
		if contains(ctx, repository, each.from, each.to) {
			verified = append(verified, url.QueryEscape(each.ref))
		}
	}
	return verified
}

func contains(ctx context.Context, repository, ancestor, descendant string) bool {
	check := exec.CommandContext(ctx, "git",
		"-c", "safe.directory=*", "-c", "core.commitGraph=false", "-c", "core.fsmonitor=false", "-c", "protocol.allow=never",
		"--no-replace-objects", "-C", repository,
		"merge-base", "--is-ancestor", ancestor, descendant,
	)
	check.Env = append(os.Environ(), "GIT_NO_REPLACE_OBJECTS=1", "GIT_GRAFT_FILE="+os.DevNull, "GIT_NO_LAZY_FETCH=1", "GIT_PROTOCOL_FROM_USER=0")
	return check.Run() == nil
}

func isNoObject(id string) bool {
	return strings.Trim(id, "0") == ""
}

func checkoutOf(workspace, path, prefix string) (string, bool) {
	relative := strings.TrimSuffix(strings.TrimPrefix(path, prefix), "/"+receivePack)
	relative = strings.TrimSuffix(relative, ".git")
	cleaned := filepath.Clean(filepath.FromSlash(relative))
	if workspace == "" || !filepath.IsLocal(cleaned) {
		return "", false
	}
	return filepath.Join(workspace, cleaned), true
}
