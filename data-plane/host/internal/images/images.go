package images

import (
	"fmt"
	"math"
	"regexp"
	"slices"
	"strings"
)

type Wanted struct {
	Image     string
	IsDefault bool
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

func (a Allowed) Allows(image string) bool {
	return slices.ContainsFunc(a.entries, func(entry string) bool {
		if prefix, pattern := strings.CutSuffix(entry, "*"); pattern {
			return strings.HasPrefix(image, prefix)
		}
		return image == entry
	})
}

func (a Allowed) Wanted(named []string) []Wanted {
	wanted := []Wanted{{Image: a.Default, IsDefault: true}}

	for _, image := range named {
		if image == a.Default || !a.Allows(image) {
			continue
		}
		if !slices.ContainsFunc(wanted, func(each Wanted) bool { return each.Image == image }) {
			wanted = append(wanted, Wanted{Image: image})
		}
	}

	return wanted
}

func (a Allowed) Disallowed(named []string) []string {
	var disallowed []string
	for _, image := range named {
		if !a.Allows(image) && !slices.Contains(disallowed, image) {
			disallowed = append(disallowed, image)
		}
	}
	return disallowed
}

const HarnessExamples = "https://github.com/usespotlightai/spotlight/tree/main/.docker/runner/examples"

var (
	publishedRelease = regexp.MustCompile(`^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-rc\.(0|[1-9]\d*))?$`)
	patternShape     = regexp.MustCompile(`^[a-z0-9][a-z0-9._:/@-]*$`)
	referenceShape   = regexp.MustCompile(
		`^[a-z0-9]+([._-][a-z0-9]+)*(:[0-9]+)?(/[a-z0-9]+([._-][a-z0-9]+)*)*(:[A-Za-z0-9_][A-Za-z0-9._-]{0,127})?(@sha256:[0-9a-f]{64})?$`,
	)
)

func RunnerTooOld(release, minimum string) string {
	if release == "" {
		return fmt.Sprintf("Runner doesn't report its release number. Minimum version required: %s", minimum)
	}

	have, need := versionOf(release), versionOf(minimum)
	if have == nil || need == nil {
		return ""
	}

	if slices.Compare(have, need) < 0 {
		return fmt.Sprintf("Runner is on release %s. Minimum version required: %s", release, minimum)
	}

	return ""
}

func versionOf(release string) []int {
	parts := publishedRelease.FindStringSubmatch(release)
	if parts == nil {
		return nil
	}

	candidate := math.MaxInt
	if parts[4] != "" {
		candidate = number(parts[4])
	}
	return []int{number(parts[1]), number(parts[2]), number(parts[3]), candidate}
}

func number(digits string) int {
	n := 0
	for _, digit := range digits {
		n = n*10 + int(digit-'0')
	}
	return n
}
