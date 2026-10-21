package replay

import (
	"fmt"
	"net/url"
	"strings"
)

type station struct {
	address   string
	team      string
	line      string
	key       string
	workspace string
	teamID    string
	lineID    string
}

type listed[T any] struct {
	Items []T `json:"items"`
}

type workspaceRead struct {
	ID   string `json:"id"`
	Slug string `json:"slug"`
}

type lineRead struct {
	ID         string `json:"id"`
	TeamID     string `json:"teamId"`
	Definition struct {
		Stations []struct {
			Key string `json:"key"`
		} `json:"stations"`
	} `json:"definition"`
}

type teamRead struct {
	ID string `json:"id"`
}

func (c *cli) workspaceID() (string, error) {
	var workspaces listed[workspaceRead]
	if err := c.api.get("/api/resources/workspaces", &workspaces); err != nil {
		return "", fmt.Errorf("find the workspace: %w", err)
	}

	slugs := make([]string, 0, len(workspaces.Items))
	for _, each := range workspaces.Items {
		if c.workspace != "" && each.Slug == c.workspace {
			return each.ID, nil
		}
		slugs = append(slugs, each.Slug)
	}

	switch {
	case c.workspace != "":
		return "", fmt.Errorf("you are not a member of workspace %s. You belong to: %s", c.workspace, strings.Join(slugs, ", "))
	case len(workspaces.Items) == 1:
		return workspaces.Items[0].ID, nil
	case len(workspaces.Items) == 0:
		return "", fmt.Errorf("the credential sees no workspace")
	default:
		return "", fmt.Errorf("you belong to %d workspaces: %s. Choose one with --workspace or %s", len(slugs), strings.Join(slugs, ", "), workspaceVar)
	}
}

func (c *cli) station(address string) (*station, error) {
	parts := strings.Split(address, "/")
	if len(parts) != 3 || parts[0] == "" || parts[1] == "" || parts[2] == "" {
		return nil, fmt.Errorf("--station is a team, line and station key, as in core/delivery/build, not %q", address)
	}

	workspace, err := c.workspaceID()
	if err != nil {
		return nil, err
	}

	var line lineRead
	if err := c.api.get(
		"/api/resources/workspaces/"+url.PathEscape(workspace)+"/lines/import?address="+url.QueryEscape(parts[0]+"/"+parts[1]),
		&line,
	); err != nil {
		return nil, fmt.Errorf("find line %s/%s: %w", parts[0], parts[1], err)
	}

	keys := make([]string, 0, len(line.Definition.Stations))
	found := false
	for _, each := range line.Definition.Stations {
		keys = append(keys, each.Key)
		found = found || each.Key == parts[2]
	}
	if !found {
		return nil, fmt.Errorf("line %s/%s has no station %s; it has %s", parts[0], parts[1], parts[2], strings.Join(keys, ", "))
	}

	return &station{
		address:   address,
		team:      parts[0],
		line:      parts[1],
		key:       parts[2],
		workspace: workspace,
		teamID:    line.TeamID,
		lineID:    line.ID,
	}, nil
}

func (c *cli) teamID(key string) (string, error) {
	if key == "" {
		return "", fmt.Errorf("--team names the team the replay is of, by its key")
	}

	workspace, err := c.workspaceID()
	if err != nil {
		return "", err
	}

	var team teamRead
	if err := c.api.get(
		"/api/resources/workspaces/"+url.PathEscape(workspace)+"/teams/import?address="+url.QueryEscape(key),
		&team,
	); err != nil {
		return "", fmt.Errorf("find team %s: %w", key, err)
	}

	return team.ID, nil
}

func (s *station) candidates() string {
	return "/api/resources/workspaces/" + url.PathEscape(s.workspace) + "/replay-candidates?station=" + url.QueryEscape(s.address)
}

func (s *station) proposals() string {
	return "/api/resources/lines/" + url.PathEscape(s.lineID) + "/stations/" + url.PathEscape(s.key) + "/replay-candidates"
}

func (s *station) sets() string {
	return teamPath(s.teamID) + "/replay-sets?line=" + url.QueryEscape(s.lineID) + "&station=" + url.QueryEscape(s.key)
}

func teamPath(teamID string) string {
	return "/api/teams/" + url.PathEscape(teamID)
}
