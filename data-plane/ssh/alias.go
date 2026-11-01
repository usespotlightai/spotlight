package ssh

import (
	"fmt"
	"net/url"
	"strings"

	"usespotlight.ai/data-plane/protocol"
)

const domain = ".spotlight"

type Alias struct {
	Kind      string
	ID        string
	Workspace string
}

func ParseAlias(raw string) (Alias, error) {
	host := strings.TrimSuffix(strings.ToLower(strings.TrimSpace(raw)), ".")
	invalid := fmt.Errorf("%q is not a Spotlight sandbox. Use task-<id>.<workspace>.spotlight or chat-<id>.<workspace>.spotlight", raw)

	named, found := strings.CutSuffix(host, domain)
	if !found {
		return Alias{}, invalid
	}

	key, workspace, found := strings.Cut(named, ".")
	if !found || workspace == "" || strings.Contains(workspace, ".") {
		return Alias{}, invalid
	}

	kind, id, found := strings.Cut(key, "-")
	if !found || id == "" || (kind != "task" && kind != "chat") {
		return Alias{}, invalid
	}

	return Alias{Kind: kind, ID: id, Workspace: workspace}, nil
}

func (a Alias) String() string {
	return a.Kind + "-" + a.ID + "." + a.Workspace + domain
}

func (a Alias) connection() map[string]string {
	return map[string]string{a.Kind: a.ID, "workspace": a.Workspace}
}

func connectionsURL(address string) (string, error) {
	target, err := url.Parse(address)
	if err != nil {
		return "", err
	}

	return target.JoinPath(connectionsPath).String(), nil
}

func socketURL(address string, connection protocol.EditorConnection) (string, error) {
	target, err := url.Parse(address)
	if err != nil {
		return "", err
	}

	switch target.Scheme {
	case "https":
		target.Scheme = "wss"
	case "http":
		target.Scheme = "ws"
	}

	target = target.JoinPath(connectPath)
	query := url.Values{}
	query.Set("sandbox", connection.SandboxID)
	query.Set("holder", connection.Holder)
	target.RawQuery = query.Encode()

	return target.String(), nil
}
