package unidiff

import (
	"fmt"
	"strings"
)

const Context = 3

const DevNull = "/dev/null"

func File(path, before, after string) string {
	if before == after {
		return ""
	}

	from, to := "a/"+path, "b/"+path
	if before == "" {
		from = DevNull
	}
	if after == "" {
		to = DevNull
	}

	return Diff(from, to, before, after)
}

func Diff(from, to, before, after string) string {
	hunks := Hunks(before, after)
	if hunks == "" {
		return ""
	}

	return "--- " + from + "\n+++ " + to + "\n" + hunks
}

func Hunks(before, after string) string {
	if before == after {
		return ""
	}

	a, b := lines(before), lines(after)
	edits := script(a, b)

	var out strings.Builder
	for _, hunk := range grouped(edits) {
		writeHunk(&out, edits[hunk.from:hunk.to], a, b)
	}

	return out.String()
}

type op byte

const (
	same op = iota
	removed
	added
)

type edit struct {
	op   op
	a, b int
}

func lines(text string) []string {
	if text == "" {
		return nil
	}

	split := strings.SplitAfter(text, "\n")
	if split[len(split)-1] == "" {
		split = split[:len(split)-1]
	}

	return split
}

func script(a, b []string) []edit {
	ids := map[string]int{}
	intern := func(texts []string) []int {
		out := make([]int, len(texts))
		for i, text := range texts {
			id, found := ids[text]
			if !found {
				id = len(ids)
				ids[text] = id
			}
			out[i] = id
		}
		return out
	}

	d := &differ{
		a: intern(a), b: intern(b),
		gone: make([]bool, len(a)), came: make([]bool, len(b)),
	}
	d.compare(0, len(a), 0, len(b))

	var edits []edit
	i, j := 0, 0
	for i < len(a) || j < len(b) {
		switch {
		case i < len(a) && d.gone[i]:
			edits = append(edits, edit{op: removed, a: i, b: j})
			i++
		case j < len(b) && d.came[j]:
			edits = append(edits, edit{op: added, a: i, b: j})
			j++
		default:
			edits = append(edits, edit{op: same, a: i, b: j})
			i++
			j++
		}
	}

	return edits
}

type differ struct {
	a, b       []int
	gone, came []bool
}

func (d *differ) compare(aLo, aHi, bLo, bHi int) {
	for aLo < aHi && bLo < bHi && d.a[aLo] == d.b[bLo] {
		aLo++
		bLo++
	}
	for aLo < aHi && bLo < bHi && d.a[aHi-1] == d.b[bHi-1] {
		aHi--
		bHi--
	}

	switch {
	case aLo == aHi:
		for j := bLo; j < bHi; j++ {
			d.came[j] = true
		}
	case bLo == bHi:
		for i := aLo; i < aHi; i++ {
			d.gone[i] = true
		}
	default:
		x, y, found := d.middle(aLo, aHi, bLo, bHi)
		if !found {
			for i := aLo; i < aHi; i++ {
				d.gone[i] = true
			}
			for j := bLo; j < bHi; j++ {
				d.came[j] = true
			}
			return
		}
		d.compare(aLo, aLo+x, bLo, bLo+y)
		d.compare(aLo+x, aHi, bLo+y, bHi)
	}
}

func (d *differ) middle(aLo, aHi, bLo, bHi int) (int, int, bool) {
	n, m := aHi-aLo, bHi-bLo
	most := (n + m + 1) / 2
	offset, size := most, 2*most+2
	forward, backward := make([]int, size), make([]int, size)
	for k := range forward {
		forward[k], backward[k] = -1, -1
	}
	forward[offset+1], backward[offset+1] = 0, 0

	delta := n - m
	odd := delta%2 != 0
	fStart, fEnd, bStart, bEnd := 0, 0, 0, 0

	for step := 0; step < most; step++ {
		for k := -step + fStart; k <= step-fEnd; k += 2 {
			at := offset + k
			var x int
			if k == -step || (k != step && forward[at-1] < forward[at+1]) {
				x = forward[at+1]
			} else {
				x = forward[at-1] + 1
			}
			y := x - k
			for x < n && y < m && d.a[aLo+x] == d.b[bLo+y] {
				x++
				y++
			}
			forward[at] = x

			switch {
			case x > n:
				fEnd += 2
			case y > m:
				fStart += 2
			case odd:
				other := offset + delta - k
				if other >= 0 && other < size && backward[other] != -1 && x >= n-backward[other] {
					return x, y, true
				}
			}
		}

		for k := -step + bStart; k <= step-bEnd; k += 2 {
			at := offset + k
			var x int
			if k == -step || (k != step && backward[at-1] < backward[at+1]) {
				x = backward[at+1]
			} else {
				x = backward[at-1] + 1
			}
			y := x - k
			for x < n && y < m && d.a[aHi-x-1] == d.b[bHi-y-1] {
				x++
				y++
			}
			backward[at] = x

			switch {
			case x > n:
				bEnd += 2
			case y > m:
				bStart += 2
			case !odd:
				other := offset + delta - k
				if other >= 0 && other < size && forward[other] != -1 {
					fx := forward[other]
					fy := offset + fx - other
					if fx >= n-x {
						return fx, fy, true
					}
				}
			}
		}
	}

	return 0, 0, false
}

type span struct{ from, to int }

func grouped(edits []edit) []span {
	var hunks []span

	for i := 0; i < len(edits); {
		if edits[i].op == same {
			i++
			continue
		}

		from := max(i-Context, 0)
		end := i
		for end < len(edits) {
			if edits[end].op != same {
				end++
				continue
			}
			run := end
			for run < len(edits) && edits[run].op == same {
				run++
			}
			if run == len(edits) || run-end > 2*Context {
				break
			}
			end = run
		}
		to := min(end+Context, len(edits))

		hunks = append(hunks, span{from: from, to: to})
		i = to
	}

	return hunks
}

func writeHunk(out *strings.Builder, edits []edit, a, b []string) {
	aCount, bCount := 0, 0
	for _, e := range edits {
		if e.op != added {
			aCount++
		}
		if e.op != removed {
			bCount++
		}
	}

	fmt.Fprintf(out, "@@ -%s +%s @@\n",
		lineRange(edits[0].a, aCount), lineRange(edits[0].b, bCount))

	for _, e := range edits {
		switch e.op {
		case same:
			writeLine(out, ' ', a[e.a])
		case removed:
			writeLine(out, '-', a[e.a])
		case added:
			writeLine(out, '+', b[e.b])
		}
	}
}

func lineRange(start, count int) string {
	switch count {
	case 0:
		return fmt.Sprintf("%d,0", start)
	case 1:
		return fmt.Sprintf("%d", start+1)
	default:
		return fmt.Sprintf("%d,%d", start+1, count)
	}
}

func writeLine(out *strings.Builder, mark byte, line string) {
	out.WriteByte(mark)
	if text, ended := strings.CutSuffix(line, "\n"); ended {
		out.WriteString(text)
		out.WriteByte('\n')
		return
	}
	out.WriteString(line)
	out.WriteString("\n\\ No newline at end of file\n")
}
