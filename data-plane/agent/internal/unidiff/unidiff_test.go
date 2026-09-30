package unidiff_test

import (
	"math/rand/v2"
	"strconv"
	"strings"
	"testing"
	"time"

	"usespotlight.ai/data-plane/agent/internal/unidiff"
)

func TestFile(t *testing.T) {
	for _, tc := range []struct {
		name          string
		before, after string
		want          string
	}{
		{
			name:   "unchanged file has no diff",
			before: "a\nb\n", after: "a\nb\n",
			want: "",
		},
		{
			name:   "one changed line keeps three lines of context",
			before: "1\n2\n3\n4\n5\n6\n7\n8\n9\n", after: "1\n2\n3\n4\nfive\n6\n7\n8\n9\n",
			want: "--- a/f.go\n+++ b/f.go\n@@ -2,7 +2,7 @@\n 2\n 3\n 4\n-5\n+five\n 6\n 7\n 8\n",
		},
		{
			name:   "created file comes from dev null",
			before: "", after: "package main\n",
			want: "--- /dev/null\n+++ b/f.go\n@@ -0,0 +1 @@\n+package main\n",
		},
		{
			name:   "deleted file goes to dev null",
			before: "x\ny\n", after: "",
			want: "--- a/f.go\n+++ /dev/null\n@@ -1,2 +0,0 @@\n-x\n-y\n",
		},
		{
			name:   "missing final newline is marked",
			before: "a\nb", after: "a\nb\n",
			want: "--- a/f.go\n+++ b/f.go\n@@ -1,2 +1,2 @@\n a\n-b\n\\ No newline at end of file\n+b\n",
		},
		{
			name:   "distant changes make separate hunks",
			before: numbered(1, 20), after: strings.Replace(strings.Replace(numbered(1, 20), "2\n", "two\n", 1), "19\n", "nineteen\n", 1),
			want: "--- a/f.go\n+++ b/f.go\n" +
				"@@ -1,5 +1,5 @@\n 1\n-2\n+two\n 3\n 4\n 5\n" +
				"@@ -16,5 +16,5 @@\n 16\n 17\n 18\n-19\n+nineteen\n 20\n",
		},
		{
			name:   "close changes share a hunk",
			before: numbered(1, 12), after: strings.Replace(strings.Replace(numbered(1, 12), "3\n", "three\n", 1), "9\n", "nine\n", 1),
			want: "--- a/f.go\n+++ b/f.go\n@@ -1,12 +1,12 @@\n 1\n 2\n-3\n+three\n 4\n 5\n 6\n 7\n 8\n-9\n+nine\n 10\n 11\n 12\n",
		},
		{
			name:   "insertion at the start",
			before: "b\nc\n", after: "a\nb\nc\n",
			want: "--- a/f.go\n+++ b/f.go\n@@ -1,2 +1,3 @@\n+a\n b\n c\n",
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			if got := unidiff.File("f.go", tc.before, tc.after); got != tc.want {
				t.Errorf("got\n%s\nwant\n%s", got, tc.want)
			}
		})
	}
}

func TestHunksRebuildTheAfterTextFromTheBefore(t *testing.T) {
	random := rand.New(rand.NewPCG(7, 11))
	words := []string{"a\n", "b\n", "c\n", "d\n", "e\n", "}\n", "\n"}

	for round := range 500 {
		before := randomText(random, words, random.IntN(40))
		after := mutate(random, before, words)

		hunks := unidiff.Hunks(before, after)
		if rebuilt := apply(t, before, hunks); rebuilt != after {
			t.Fatalf("round %d: rebuilt\n%q\nwant\n%q\nfrom\n%s", round, rebuilt, after, hunks)
		}
	}
}

func TestLargeFilesDiffQuickly(t *testing.T) {
	before := numbered(1, 5000)
	after := strings.Replace(before, "2500\n", "changed\n", 1) + "tail\n"
	after = strings.Replace(after, "10\n", "", 1)

	began := time.Now()
	hunks := unidiff.Hunks(before, after)
	if took := time.Since(began); took > 2*time.Second {
		t.Fatalf("took %s", took)
	}
	if strings.Count(hunks, "@@ -") != 3 {
		t.Errorf("want three hunks, got\n%s", hunks)
	}
}

func TestWholesaleRewriteStillRebuilds(t *testing.T) {
	before := numbered(1, 3000)
	after := numbered(3001, 6000)

	if rebuilt := apply(t, before, unidiff.Hunks(before, after)); rebuilt != after {
		t.Fatal("rebuilt text differs")
	}
}

func numbered(from, to int) string {
	var out strings.Builder
	for n := from; n <= to; n++ {
		out.WriteString(strconv.Itoa(n) + "\n")
	}
	return out.String()
}

func randomText(random *rand.Rand, words []string, count int) string {
	var out strings.Builder
	for range count {
		out.WriteString(words[random.IntN(len(words))])
	}
	text := out.String()
	if text != "" && random.IntN(4) == 0 {
		text = strings.TrimSuffix(text, "\n")
	}
	return text
}

func mutate(random *rand.Rand, text string, words []string) string {
	split := strings.SplitAfter(text, "\n")
	var out []string
	for _, line := range split {
		switch random.IntN(6) {
		case 0:
		case 1:
			out = append(out, words[random.IntN(len(words))], line)
		case 2:
			out = append(out, words[random.IntN(len(words))])
		default:
			out = append(out, line)
		}
	}
	mutated := strings.Join(out, "")
	if random.IntN(5) == 0 {
		mutated = strings.TrimSuffix(mutated, "\n")
	}
	return mutated
}

func apply(t *testing.T, before, hunks string) string {
	t.Helper()

	source := strings.SplitAfter(before, "\n")
	if source[len(source)-1] == "" {
		source = source[:len(source)-1]
	}

	var out []string
	at := 0
	patch := strings.SplitAfter(hunks, "\n")
	for i := 0; i < len(patch); i++ {
		line := patch[i]
		if line == "" {
			continue
		}
		if strings.HasPrefix(line, "@@ ") {
			start, count, _ := strings.Cut(strings.TrimPrefix(strings.Fields(line)[1], "-"), ",")
			first, _ := strconv.Atoi(start)
			if count != "0" {
				first--
			}
			for at < first {
				out = append(out, source[at])
				at++
			}
			continue
		}
		body := line[1:]
		if i+1 < len(patch) && strings.HasPrefix(patch[i+1], "\\ No newline") {
			body = strings.TrimSuffix(body, "\n")
			i++
		}
		switch line[0] {
		case ' ':
			if source[at] != body {
				t.Fatalf("context %q does not match %q", body, source[at])
			}
			out = append(out, body)
			at++
		case '-':
			if source[at] != body {
				t.Fatalf("removal %q does not match %q", body, source[at])
			}
			at++
		case '+':
			out = append(out, body)
		default:
			t.Fatalf("unreadable patch line %q", line)
		}
	}
	out = append(out, source[at:]...)

	return strings.Join(out, "")
}
