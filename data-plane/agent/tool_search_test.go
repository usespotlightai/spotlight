package agent

import (
	"bytes"
	"fmt"
	"slices"
	"strings"
	"testing"

	"usespotlight.ai/data-plane/protocol"
)

func tool(name, description string) protocol.ToolManifest {
	return protocol.ToolManifest{Name: name, Description: description}
}

func names(tools []protocol.ToolManifest) []string {
	found := make([]string, 0, len(tools))
	for _, each := range tools {
		found = append(found, each.Name)
	}

	return found
}

func TestSplitsNamesIntoWords(t *testing.T) {
	for text, want := range map[string][]string{
		"linear.issueCreate":     {"linear", "issue", "create"},
		"github/pulls:list_open": {"github", "pulls", "list", "open"},
		"HTTPServer-v2":          {"http", "server", "v2"},
		"petstore.pet-add":       {"petstore", "pet", "add"},
	} {
		if got := tokens(text); !slices.Equal(got, want) {
			t.Errorf("tokens(%q) = %v, want %v", text, got, want)
		}
	}
}

func TestRanksAnExactWordOverAPrefixOverAPartOfOne(t *testing.T) {
	tools := []protocol.ToolManifest{
		tool("linear.reissue", "Sends it again."),
		tool("linear.issues", "Lists them."),
		tool("linear.issue", "Reads one."),
	}

	if got := names(search(tools, "issue", 10)); !slices.Equal(got, []string{"linear.issue", "linear.issues", "linear.reissue"}) {
		t.Errorf("ranked %v", got)
	}
}

func TestFindsAWordInsideACamelCasedName(t *testing.T) {
	tools := []protocol.ToolManifest{
		tool("linear.teamList", "Lists the teams."),
		tool("linear.issueCreate", "Makes one."),
	}

	if got := names(search(tools, "create", 10)); !slices.Equal(got, []string{"linear.issueCreate"}) {
		t.Errorf("ranked %v", got)
	}
}

func TestRanksAToolMatchingEveryWordFirst(t *testing.T) {
	one := tool("acme.one", "Archive an issue.")
	both := tool("acme.two", "Archive or restore an issue.")

	if scored(both, []string{"archive", "restore"}) <= scored(one, []string{"archive", "restore"}) {
		t.Errorf("scored a tool matching both words no higher than one matching one")
	}

	plain := scored(tool("x.y", "archive restore"), []string{"archive", "restore"})
	unbonused := float64(2 * exactMatch)
	if plain <= unbonused+phraseMatch {
		t.Errorf("scored %v, want the bonus for covering every word on top of %v", plain, unbonused+phraseMatch)
	}
}

func TestWeighsTheNameOverTheIntegrationOverTheDescription(t *testing.T) {
	byName := tool("acme.invoice", "Reads one.")
	byIntegration := protocol.ToolManifest{Name: "acme.read", Description: "Reads one.", Integration: "Invoice"}
	byDescription := tool("acme.fetch", "Reads an invoice.")

	got := names(search([]protocol.ToolManifest{byDescription, byIntegration, byName}, "invoice", 10))
	if !slices.Equal(got, []string{"acme.invoice", "acme.read", "acme.fetch"}) {
		t.Errorf("ranked %v", got)
	}
}

func TestFindsTheToolAmongTwoHundred(t *testing.T) {
	var tools []protocol.ToolManifest
	for at := range 195 {
		tools = append(tools, protocol.ToolManifest{
			Name:        fmt.Sprintf("petstore.pet-thing-%d", at),
			Description: "Create or update a pet in the store.",
			Integration: "Petstore",
		})
	}
	for _, each := range []protocol.ToolManifest{
		{Name: "linear.issue-label-create", Description: "Create an issue label.", Integration: "Linear"},
		{Name: "linear.issue-update", Description: "Update an issue.", Integration: "Linear"},
		{Name: "linear.comment-create", Description: "Create a comment on an issue.", Integration: "Linear"},
		{Name: "github.issueCommentCreate", Description: "Create a comment on an issue.", Integration: "GitHub"},
		{Name: "linear.issue-create", Description: "Create an issue.", Integration: "Linear"},
	} {
		tools = append(tools, each)
	}

	ranked := search(tools, "create issue", 10)
	if len(ranked) == 0 || ranked[0].Name != "linear.issue-create" {
		t.Fatalf("ranked %v, want linear.issue-create first", names(ranked))
	}
	if len(ranked) != 10 {
		t.Errorf("found %d, want the ten best", len(ranked))
	}
}

func TestSearchesTheRunsTools(t *testing.T) {
	server := inARun(t)
	server.Tools([]string{"linear.comment", "linear.search", "linear.issue-create"}, nil)
	server.Manifest([]protocol.ToolManifest{
		commenting,
		searching,
		{Name: "linear.issue-create", Description: "Create an issue.\nIt lands in triage.", Approval: &protocol.ToolApproval{Because: "It is public."}},
	})
	out := new(bytes.Buffer)

	if err := run([]string{"tools", "search", "create", "--limit", "1", "issue"}, strings.NewReader(""), out); err != nil {
		t.Fatalf("run: %v", err)
	}

	said := out.String()
	for _, want := range []string{
		"spotlight linear issue-create",
		"  Create an issue.\n",
		"  Needs a person's approval.",
		"Read one with: spotlight tools describe linear.issue-create",
	} {
		if !strings.Contains(said, want) {
			t.Errorf("said %q, want it to say %q", said, want)
		}
	}
	if strings.Contains(said, "linear comment") || strings.Contains(said, "It lands in triage") {
		t.Errorf("said %q, want one tool and the first line of what it does", said)
	}
}

func TestSaysWhenNoToolMatches(t *testing.T) {
	withTools(t, `{}`)
	out := new(bytes.Buffer)

	if err := run([]string{"tools", "search", "deploy"}, strings.NewReader(""), out); err != nil {
		t.Fatalf("run: %v", err)
	}
	if !strings.Contains(out.String(), `No tool this run was given matches "deploy"`) {
		t.Errorf("said %q", out.String())
	}
}

func TestAsksWhatToSearchFor(t *testing.T) {
	withTools(t, `{}`)

	err := run([]string{"tools", "search", "--limit", "3"}, strings.NewReader(""), new(bytes.Buffer))
	if err == nil || !strings.Contains(err.Error(), "say what the tool does") {
		t.Fatalf("err = %v", err)
	}
}

func TestIgnoresWordsOfOneLetter(t *testing.T) {
	tools := []protocol.ToolManifest{
		tool("linear.issue-create", "Create an issue."),
		tool("acme.a", "Does a thing."),
	}

	if got := names(search(tools, "create a issue", 10)); !slices.Equal(got, []string{"linear.issue-create"}) {
		t.Errorf("ranked %v, want the one-letter word ignored", got)
	}
	if got := search(tools, "a", 10); len(got) != 0 {
		t.Errorf("ranked %v for a search of one letter", names(got))
	}
}
