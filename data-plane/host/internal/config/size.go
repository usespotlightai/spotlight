package config

import (
	"fmt"
	"math"
	"regexp"
	"strconv"
	"strings"
)

const (
	kibibyte = int64(1) << 10
	mebibyte = kibibyte << 10
	gibibyte = mebibyte << 10
	tebibyte = gibibyte << 10
)

var units = []struct {
	suffix string
	size   int64
}{{"t", tebibyte}, {"g", gibibyte}, {"m", mebibyte}, {"k", kibibyte}}

var size = regexp.MustCompile(`^(\d+)\s*(?:([kmgt])(?:i?b)?|b)?$`)

// ParseSize reads a whole number of bytes, or of binary units: 512m, 6g, 6GiB.
func ParseSize(raw string) (int64, error) {
	match := size.FindStringSubmatch(strings.ToLower(strings.TrimSpace(raw)))
	if match == nil {
		return 0, fmt.Errorf("%q is not a size such as 512m or 6g", raw)
	}

	count, err := strconv.ParseInt(match[1], 10, 64)
	if err != nil {
		return 0, fmt.Errorf("%q is too large", raw)
	}
	unit := int64(1)
	for _, each := range units {
		if each.suffix == match[2] {
			unit = each.size
		}
	}
	if count > math.MaxInt64/unit {
		return 0, fmt.Errorf("%q is too large", raw)
	}

	return count * unit, nil
}

// FormatSize writes bytes exactly, in the largest unit that divides them: 6g, 2688m.
func FormatSize(bytes int64) string {
	for _, unit := range units {
		if bytes != 0 && bytes%unit.size == 0 {
			return strconv.FormatInt(bytes/unit.size, 10) + unit.suffix
		}
	}
	return strconv.FormatInt(bytes, 10)
}
