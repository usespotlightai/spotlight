package allowlist

import (
	"fmt"
	"strings"
)

type List struct {
	any      bool
	exact    map[string]bool
	suffixes []string
}

func Parse(entries []string) (List, error) {
	list := List{any: len(entries) == 0, exact: map[string]bool{}}

	for _, entry := range entries {
		entry = strings.ToLower(strings.TrimSpace(entry))

		switch {
		case entry == "":
		case entry == "*":
			return List{}, fmt.Errorf("%q allows everything; leave the list empty for that", entry)
		case strings.HasPrefix(entry, "*."):
			suffix := entry[1:]
			if strings.Contains(suffix[1:], "*") || !strings.Contains(suffix[1:], ".") {
				return List{}, fmt.Errorf("%q is not a pattern such as *.example.com", entry)
			}
			list.suffixes = append(list.suffixes, suffix)
		case strings.ContainsAny(entry, "*/: "):
			return List{}, fmt.Errorf("%q is not a host such as api.example.com or a pattern such as *.example.com", entry)
		default:
			list.exact[entry] = true
		}
	}

	return list, nil
}

func (l List) With(hosts ...string) List {
	exact := make(map[string]bool, len(l.exact)+len(hosts))
	for host := range l.exact {
		exact[host] = true
	}
	for _, host := range hosts {
		if host = strings.ToLower(strings.TrimSpace(host)); host != "" {
			exact[host] = true
		}
	}

	return List{any: l.any, exact: exact, suffixes: l.suffixes}
}

func (l List) Allows(host string) bool {
	return l.ExplicitlyListed(host) || (l.any && Normal(host) != "")
}

func (l List) ExplicitlyListed(host string) bool {
	host = Normal(host)
	if host == "" {
		return false
	}
	if l.exact[host] {
		return true
	}

	for _, suffix := range l.suffixes {
		if strings.HasSuffix(host, suffix) && len(host) > len(suffix) {
			return true
		}
	}

	return false
}

func Normal(host string) string {
	return strings.ToLower(strings.TrimSuffix(host, "."))
}
