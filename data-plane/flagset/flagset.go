package flagset

import (
	"flag"
	"strings"
)

func Interspersed(set *flag.FlagSet, args []string) ([]string, error) {
	var positional []string
	for {
		if err := set.Parse(args); err != nil {
			return nil, err
		}
		rest := set.Args()
		if endedAtMarker(set, args[:len(args)-len(rest)]) {
			return append(positional, rest...), nil
		}
		if len(rest) == 0 {
			return positional, nil
		}
		positional = append(positional, rest[0])
		args = rest[1:]
	}
}

func endedAtMarker(set *flag.FlagSet, parsed []string) bool {
	for at := 0; at < len(parsed); at++ {
		token := parsed[at]
		if token == "--" {
			return true
		}
		name := strings.TrimPrefix(strings.TrimPrefix(token, "-"), "-")
		if strings.Contains(name, "=") {
			continue
		}
		if each := set.Lookup(name); each != nil && !isBool(each) {
			at++
		}
	}
	return false
}

func isBool(each *flag.Flag) bool {
	value, ok := each.Value.(interface{ IsBoolFlag() bool })
	return ok && value.IsBoolFlag()
}
