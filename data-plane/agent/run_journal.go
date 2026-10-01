package agent

import (
	"fmt"
	"strconv"
	"strings"

	"usespotlight.ai/data-plane/agent/internal/unidiff"
	"usespotlight.ai/data-plane/protocol"
)

func journalMarkdown(run protocol.HistoryRun) string {
	var out strings.Builder

	fmt.Fprintf(&out, "# %s\n\n", oneLine(run.Title))
	fmt.Fprintf(&out, "- task: %s\n", run.TaskID)
	fmt.Fprintf(&out, "- run: %s\n", run.RunID)
	fmt.Fprintf(&out, "- state: %s\n", run.State)
	fmt.Fprintf(&out, "- attempt: %d\n", run.Attempt)
	fmt.Fprintf(&out, "- harness: %s\n", run.Harness)
	fmt.Fprintf(&out, "- config: %s\n", shown(run.Fingerprint))
	fmt.Fprintf(&out, "- started: %s\n", shown(run.StartedAt))
	fmt.Fprintf(&out, "- ended: %s\n", shown(run.EndedAt))
	fmt.Fprintf(&out, "- ms: %d\n", run.Trace.Ms)
	fmt.Fprintf(&out, "- nodes: %d\n", run.Trace.Rows)
	fmt.Fprintf(&out, "- faults: %d\n", run.Trace.Faults)
	if run.Outcome != nil {
		fmt.Fprintf(&out, "- ending: %s\n", ending(run.Outcome))
	}

	for i, node := range run.Trace.Roots {
		writeNode(&out, node, strconv.Itoa(i+1), 0)
	}

	return out.String()
}

func writeNode(out *strings.Builder, node protocol.TraceNode, number string, depth int) {
	fmt.Fprintf(out, "\n%s %s %s\n\n", strings.Repeat("#", min(depth+2, 6)), number, oneLine(node.Name))

	facts := []string{
		"kind: " + node.Kind,
		"tone: " + node.Tone,
		"ms: " + strconv.Itoa(node.Ms),
		"id: " + node.ID,
	}
	if node.StartedAt != "" {
		facts = append(facts, "started: "+node.StartedAt)
	}
	if node.Cost != nil {
		facts = append(facts, "cost: "+money(*node.Cost, node.Currency))
	}
	out.WriteString(strings.Join(facts, " · ") + "\n")

	if step := node.Step; step != nil {
		writeStep(out, step)
	}
	if span := node.Span; span != nil {
		writeSpan(out, span)
	}

	for i, child := range node.Children {
		writeNode(out, child, number+"."+strconv.Itoa(i+1), depth+1)
	}
}

func writeStep(out *strings.Builder, step *protocol.TraceStep) {
	out.WriteString("\n- step: " + step.Kind + "\n")
	if step.Tool != nil {
		out.WriteString("- tool: " + *step.Tool + "\n")
	}
	if step.Status != nil {
		out.WriteString("- status: " + *step.Status + "\n")
	}
	fmt.Fprintf(out, "- step ms: %d\n", step.Ms)

	if step.Text != "" {
		writeBlock(out, "Text", "", step.Text)
	}
	if step.Detail != nil {
		writeBlock(out, "Detail", "", *step.Detail)
	}
	if len(step.Locations) > 0 {
		out.WriteString("\nLocations:\n\n")
		for _, location := range step.Locations {
			if location.Line != nil {
				fmt.Fprintf(out, "- %s:%d\n", location.Path, *location.Line)
			} else {
				fmt.Fprintf(out, "- %s\n", location.Path)
			}
		}
	}
	if step.Given != nil {
		writeBlock(out, "Given", "", *step.Given)
	}
	if step.Returned != nil {
		writeBlock(out, "Returned", "", *step.Returned)
	}
	if change := step.Change; change != nil {
		path := shown(change.Path)
		diff := unidiff.File(path, change.Before, change.After)
		if change.Path == nil {
			diff = unidiff.Diff("before", "after", change.Before, change.After)
		}
		if diff == "" {
			out.WriteString("\nChange: " + path + " (no difference)\n")
		} else {
			writeBlock(out, "Change: "+path, "diff", diff)
		}
	}
}

func writeSpan(out *strings.Builder, span *protocol.TraceSpan) {
	fmt.Fprintf(out, "\n- span: %s\n- span id: %s\n", span.Name, span.ID)
	if span.ParentID != nil {
		fmt.Fprintf(out, "- parent span: %s\n", *span.ParentID)
	}
	fmt.Fprintf(out, "- span ms: %d\n- failed: %t\n", span.Ms, span.Failed)

	for _, attribute := range span.Attributes {
		if strings.Contains(attribute.Value, "\n") || strings.Contains(attribute.Value, "`") {
			writeBlock(out, "Attribute "+attribute.Name, "", attribute.Value)
			continue
		}
		fmt.Fprintf(out, "- %s: %s\n", attribute.Name, attribute.Value)
	}
}

func writeBlock(out *strings.Builder, label, language, body string) {
	fence := fenceFor(body)
	fmt.Fprintf(out, "\n%s:\n\n%s%s\n%s", label, fence, language, body)
	if !strings.HasSuffix(body, "\n") {
		out.WriteString("\n")
	}
	out.WriteString(fence + "\n")
}

func fenceFor(body string) string {
	longest, run := 0, 0
	for _, r := range body {
		if r == '`' {
			run++
			longest = max(longest, run)
			continue
		}
		run = 0
	}

	return strings.Repeat("`", max(3, longest+1))
}

func oneLine(text string) string {
	return strings.Join(strings.Fields(text), " ")
}

func money(amount float64, currency *string) string {
	shown := strconv.FormatFloat(amount, 'f', -1, 64)
	if currency != nil && *currency != "" {
		return shown + " " + *currency
	}

	return shown
}

func ending(outcome *protocol.RunOutcome) string {
	if outcome.Failure != nil && *outcome.Failure != "" {
		return outcome.Ending + " (" + *outcome.Failure + ")"
	}

	return outcome.Ending
}
