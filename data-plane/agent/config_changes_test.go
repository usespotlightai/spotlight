package agent

import (
	"slices"
	"testing"

	"usespotlight.ai/data-plane/protocol"
)

func TestConfigChangesSayWhatMovedOnTheJudge(t *testing.T) {
	plain := protocol.StationConfig{Harness: "claude-code"}
	judged := plain
	judged.Judge = &protocol.ConfigJudge{RubricDigest: "aaaa", Sample: 0.2, Trust: 0.6}
	retuned := plain
	retuned.Judge = &protocol.ConfigJudge{RubricDigest: "bbbb", Sample: 0.5, Trust: 0.8}

	for _, tc := range []struct {
		name     string
		was, now protocol.StationConfig
		want     []string
	}{
		{"added", plain, judged, []string{"judge added"}},
		{"removed", judged, plain, []string{"judge removed"}},
		{"retuned", judged, retuned, []string{"judge rubric changed", "judge sample 0.2 → 0.5", "judge trust 0.6 → 0.8"}},
		{"unchanged", judged, judged, nil},
	} {
		t.Run(tc.name, func(t *testing.T) {
			if got := configChanges(tc.was, tc.now); !slices.Equal(got, tc.want) {
				t.Errorf("got %q, want %q", got, tc.want)
			}
		})
	}
}
