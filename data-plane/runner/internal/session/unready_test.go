package session

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"testing"

	"usespotlight.ai/data-plane/protocol"
)

func TestTheAgentHearsWhichSetupsFailedAndIsAskedToReportThem(t *testing.T) {
	var output strings.Builder
	for line := range 30 {
		fmt.Fprintf(&output, "line %d\n", line)
	}
	output.WriteString("npm error code ENOSPC\n")

	talk := &conversation{
		run: protocol.Run{Spec: protocol.Spec{Briefing: "Fix the login page."}},
		unready: []setupFailure{
			{path: "spotlight", command: "npm ci", err: errors.New("exit status 228"), output: output.String()},
			{path: "docs", command: "npm ci", err: errors.New("did not finish within 15m0s")},
		},
	}

	got := talk.opening(context.Background())

	for _, want := range []string{
		"- spotlight: `npm ci` failed: exit status 228",
		"  npm error code ENOSPC",
		"- docs: `npm ci` failed: did not finish within 15m0s",
		"In your handover, say that setup failed",
	} {
		if !strings.Contains(got, want) {
			t.Errorf("the opening does not say %q:\n%s", want, got)
		}
	}
	if strings.Contains(got, "line 10\n") || !strings.Contains(got, "line 11\n") {
		t.Errorf("the opening does not keep only the last %d lines of output:\n%s", unreadyOutputLines, got)
	}
	if !strings.HasSuffix(got, "\n\nFix the login page.") {
		t.Errorf("the briefing does not follow the note:\n%s", got)
	}
}

func TestTheOpeningIsTheBriefingWhenEverySetupWorked(t *testing.T) {
	talk := &conversation{run: protocol.Run{Spec: protocol.Spec{Briefing: "Fix the login page."}}}

	if got := talk.opening(context.Background()); got != "Fix the login page." {
		t.Errorf("the opening is %q", got)
	}
}
