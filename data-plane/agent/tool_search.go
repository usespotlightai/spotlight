package agent

import (
	"flag"
	"fmt"
	"io"
	"sort"
	"strings"
	"unicode"
	"unicode/utf8"

	"usespotlight.ai/data-plane/protocol"
)

const (
	shortestWord  = 2
	foundAtMost   = 10
	shownAtMost   = 160
	coveringBonus = 1.25
)

const (
	exactMatch   = 10
	phraseMatch  = 8
	prefixMatch  = 6
	stemMatch    = 4
	partialMatch = 2
	textMatch    = 1
)

type searched struct {
	text   string
	tokens []string
	weight float64
}

type found struct {
	tool  protocol.ToolManifest
	score float64
	words int
}

func tokens(text string) []string {
	var split []string
	var word []rune

	flush := func() {
		if len(word) > 0 {
			split = append(split, strings.ToLower(string(word)))
			word = word[:0]
		}
	}

	runes := []rune(text)
	for at, each := range runes {
		if !unicode.IsLetter(each) && !unicode.IsDigit(each) {
			flush()
			continue
		}
		if at > 0 && unicode.IsUpper(each) {
			before := runes[at-1]
			after := at+1 < len(runes) && unicode.IsLower(runes[at+1])
			if unicode.IsLower(before) || unicode.IsDigit(before) || (unicode.IsUpper(before) && after) {
				flush()
			}
		}
		word = append(word, each)
	}
	flush()

	return split
}

func fieldsOf(tool protocol.ToolManifest) []searched {
	return []searched{
		{strings.ToLower(tool.Name), tokens(tool.Name), 3},
		{strings.ToLower(tool.Integration), tokens(tool.Integration), 2},
		{strings.ToLower(tool.Description), tokens(tool.Description), 1},
	}
}

func matching(word string, field searched) float64 {
	best := 0
	for _, token := range field.tokens {
		switch {
		case token == word:
			best = max(best, exactMatch)
		case strings.HasPrefix(token, word):
			best = max(best, prefixMatch)
		case len(token) >= 3 && strings.HasPrefix(word, token):
			best = max(best, stemMatch)
		case strings.Contains(token, word):
			best = max(best, partialMatch)
		}
	}
	if best == 0 && strings.Contains(field.text, word) {
		best = textMatch
	}

	return float64(best) * field.weight
}

func scored(tool protocol.ToolManifest, words []string) float64 {
	fields := fieldsOf(tool)
	total, covered := 0.0, 0

	for _, word := range words {
		matched := 0.0
		for _, field := range fields {
			matched += matching(word, field)
		}
		if matched > 0 {
			covered++
		}
		total += matched
	}

	if phrase := strings.Join(words, " "); len(words) > 1 {
		for _, field := range fields {
			if strings.Contains(" "+strings.Join(field.tokens, " ")+" ", " "+phrase+" ") {
				total += phraseMatch * field.weight
			}
		}
	}

	if total > 0 && covered == len(words) {
		total *= coveringBonus
	}

	return total
}

func search(tools []protocol.ToolManifest, query string, limit int) []protocol.ToolManifest {
	var words []string
	for _, word := range tokens(query) {
		if utf8.RuneCountInString(word) >= shortestWord {
			words = append(words, word)
		}
	}
	if len(words) == 0 {
		return nil
	}

	var hits []found
	for _, tool := range tools {
		if score := scored(tool, words); score > 0 {
			hits = append(hits, found{tool, score, len(tokens(tool.Name))})
		}
	}

	sort.SliceStable(hits, func(i, j int) bool {
		if hits[i].score != hits[j].score {
			return hits[i].score > hits[j].score
		}
		if hits[i].words != hits[j].words {
			return hits[i].words < hits[j].words
		}
		return hits[i].tool.Name < hits[j].tool.Name
	})

	ranked := make([]protocol.ToolManifest, 0, min(limit, len(hits)))
	for _, hit := range hits[:min(limit, len(hits))] {
		ranked = append(ranked, hit.tool)
	}

	return ranked
}

func firstLine(description string) string {
	line, _, _ := strings.Cut(strings.TrimSpace(description), "\n")
	if runes := []rune(line); len(runes) > shownAtMost {
		return strings.TrimSpace(string(runes[:shownAtMost-1])) + "…"
	}

	return line
}

const searchUsage = `usage: spotlight tools search "<words>" [--limit <n>]`

func searchTools(args []string, out io.Writer) error {
	flags := flag.NewFlagSet("tools search", flag.ContinueOnError)
	flags.SetOutput(io.Discard)
	limit := flags.Int("limit", foundAtMost, "how many tools to show at most")

	var words []string
	for {
		if err := flags.Parse(args); err != nil {
			return fmt.Errorf("%v\n%s", err, searchUsage)
		}
		if flags.NArg() == 0 {
			break
		}
		words = append(words, flags.Arg(0))
		args = flags.Args()[1:]
	}

	query := strings.TrimSpace(strings.Join(words, " "))
	if query == "" {
		return fmt.Errorf("say what the tool does\n%s", searchUsage)
	}
	if *limit < 1 {
		return fmt.Errorf("--limit is how many tools to show, at least 1\n%s", searchUsage)
	}

	tools, err := manifest()
	if err != nil {
		return err
	}

	ranked := search(tools, query, *limit)
	if len(ranked) == 0 {
		fmt.Fprintf(out, "No tool this run was given matches %q. Try other words, or run spotlight tools.\n", query)
		return nil
	}

	for at, tool := range ranked {
		if at > 0 {
			fmt.Fprintln(out)
		}
		fmt.Fprintf(out, "%s\n  %s\n", signature(tool), firstLine(tool.Description))
		if tool.Approval != nil {
			fmt.Fprintln(out, "  Needs a person's approval.")
		}
	}

	fmt.Fprintf(out, "\nRead one with: spotlight tools describe %s\n", ranked[0].Name)

	return nil
}
