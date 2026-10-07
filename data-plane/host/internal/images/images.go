package images

import (
	"fmt"
	"regexp"
	"slices"
	"strings"
)

type Wanted struct {
	Image string
	Usual bool
}

type Allowed struct {
	Default string
	entries []string
}

func Parse(entries []string, fallback string) (Allowed, error) {
	allowed := Allowed{}

	for _, entry := range entries {
		prefix, pattern := strings.CutSuffix(entry, "*")
		switch {
		case strings.Contains(prefix, "*"):
			return Allowed{}, fmt.Errorf("%q: an image pattern ends in * and has no other", entry)
		case pattern && !patternShape.MatchString(prefix):
			return Allowed{}, fmt.Errorf("%q: an image pattern starts like an image reference, in lowercase", entry)
		case !pattern && !referenceShape.MatchString(entry):
			return Allowed{}, fmt.Errorf("%q is not an image reference such as ghcr.io/acme/runner:main", entry)
		}
		if allowed.Default == "" && !strings.HasSuffix(entry, "*") {
			allowed.Default = entry
		}
		allowed.entries = append(allowed.entries, entry)
	}

	if allowed.Default == "" {
		allowed.Default = fallback
		allowed.entries = append(allowed.entries, fallback)
	}

	return allowed, nil
}

func (a Allowed) Admits(image string) bool {
	return slices.ContainsFunc(a.entries, func(entry string) bool {
		if prefix, pattern := strings.CutSuffix(entry, "*"); pattern {
			return strings.HasPrefix(image, prefix)
		}
		return image == entry
	})
}

func (a Allowed) Wanted(named []string) []Wanted {
	wanted := []Wanted{{Image: a.Default, Usual: true}}

	for _, image := range named {
		if image == a.Default || !a.Admits(image) {
			continue
		}
		if !slices.ContainsFunc(wanted, func(held Wanted) bool { return held.Image == image }) {
			wanted = append(wanted, Wanted{Image: image})
		}
	}

	return wanted
}

func (a Allowed) Refused(named []string) []string {
	var refused []string
	for _, image := range named {
		if !a.Admits(image) && !slices.Contains(refused, image) {
			refused = append(refused, image)
		}
	}
	return refused
}

var (
	datedRelease   = regexp.MustCompile(`^(\d{8})-(\d+)$`)
	patternShape   = regexp.MustCompile(`^[a-z0-9][a-z0-9._:/@-]*$`)
	referenceShape = regexp.MustCompile(
		`^[a-z0-9]+([._-][a-z0-9]+)*(:[0-9]+)?(/[a-z0-9]+([._-][a-z0-9]+)*)*(:[A-Za-z0-9_][A-Za-z0-9._-]{0,127})?(@sha256:[0-9a-f]{64})?$`,
	)
)

func RunnerRefusal(release, atLeast string) string {
	if release == "" {
		return fmt.Sprintf("Runner doesn't report its release number. Minimum version required: %s", atLeast)
	}

	have, need := datedRelease.FindStringSubmatch(release), datedRelease.FindStringSubmatch(atLeast)
	if have == nil || need == nil {
		return ""
	}

	if have[1] < need[1] || (have[1] == need[1] && number(have[2]) < number(need[2])) {
		return fmt.Sprintf("Runner is on release %s. Minimum version required: %s", release, atLeast)
	}

	return ""
}

func number(digits string) int {
	n := 0
	for _, digit := range digits {
		n = n*10 + int(digit-'0')
	}
	return n
}
