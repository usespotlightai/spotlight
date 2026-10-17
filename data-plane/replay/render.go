package replay

import (
	"flag"
	"fmt"
	"io"
	"strings"
	"text/tabwriter"
)

type named interface {
	id() string
	label() string
}

func (c candidate) id() string    { return c.ID }
func (c candidate) label() string { return c.Name }
func (s replaySet) id() string    { return s.ID }
func (s replaySet) label() string { return s.Name }

func pick[T named](items []T, asked, kind, at string) (T, error) {
	var none T
	var byName []T

	for _, each := range items {
		if each.id() == asked {
			return each, nil
		}
		if each.label() == asked {
			byName = append(byName, each)
		}
	}

	switch len(byName) {
	case 1:
		return byName[0], nil
	case 0:
		names := make([]string, 0, len(items))
		for _, each := range items {
			names = append(names, each.label())
		}
		if len(names) == 0 {
			return none, fmt.Errorf("%s has no %s %q, nor any other", at, kind, asked)
		}
		return none, fmt.Errorf("%s has no %s %q; it has %s", at, kind, asked, strings.Join(names, ", "))
	default:
		ids := make([]string, 0, len(byName))
		for _, each := range byName {
			ids = append(ids, each.id())
		}
		return none, fmt.Errorf("%s has %d of %s named %q; name one by its id: %s", at, len(byName), kind, asked, strings.Join(ids, ", "))
	}
}

func tabled(out io.Writer) *tabwriter.Writer {
	return tabwriter.NewWriter(out, 0, 0, 2, ' ', 0)
}

func parsed(set *flag.FlagSet, args []string) ([]string, error) {
	var positional []string

	for {
		if err := set.Parse(args); err != nil {
			return nil, err
		}
		if set.NArg() == 0 {
			return positional, nil
		}

		positional = append(positional, set.Arg(0))
		args = set.Args()[1:]
	}
}
