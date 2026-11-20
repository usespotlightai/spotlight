package flagset

import (
	"flag"
	"io"
	"slices"
	"testing"
)

func TestInterspersed(t *testing.T) {
	for _, test := range []struct {
		name       string
		args       []string
		positional []string
		now        bool
		image      string
		fails      bool
	}{
		{name: "no arguments", args: nil, positional: nil},
		{name: "flags before", args: []string{"--now", "--image", "runner:2", "capacity=8"}, positional: []string{"capacity=8"}, now: true, image: "runner:2"},
		{name: "flags after", args: []string{"capacity=8", "--now"}, positional: []string{"capacity=8"}, now: true},
		{name: "flags between", args: []string{"capacity=8", "--image=runner:2", "memory=6g", "-now", "name=a"}, positional: []string{"capacity=8", "memory=6g", "name=a"}, now: true, image: "runner:2"},
		{name: "after the marker", args: []string{"capacity=8", "--", "--now", "-image", "x"}, positional: []string{"capacity=8", "--now", "-image", "x"}},
		{name: "flags before the marker", args: []string{"--now", "--", "--image"}, positional: []string{"--image"}, now: true},
		{name: "only the marker", args: []string{"--"}, positional: nil},
		{name: "the marker as a flag value", args: []string{"--image", "--", "capacity=8", "--now"}, positional: []string{"capacity=8"}, now: true, image: "--"},
		{name: "the marker after a flag value", args: []string{"--image", "x", "--", "--now"}, positional: []string{"--now"}, image: "x"},
		{name: "the marker after a flag set inline", args: []string{"--image=x", "--", "--now"}, positional: []string{"--now"}, image: "x"},
		{name: "a lone dash", args: []string{"-", "--now"}, positional: []string{"-"}, now: true},
		{name: "an unknown flag", args: []string{"capacity=8", "--later"}, fails: true},
		{name: "a flag with no value", args: []string{"capacity=8", "--image"}, fails: true},
	} {
		t.Run(test.name, func(t *testing.T) {
			set := flag.NewFlagSet("set", flag.ContinueOnError)
			set.SetOutput(io.Discard)
			now := set.Bool("now", false, "")
			image := set.String("image", "", "")

			positional, err := Interspersed(set, test.args)
			if test.fails {
				if err == nil {
					t.Fatalf("parsed %v with no error", test.args)
				}
				return
			}
			if err != nil {
				t.Fatal(err)
			}
			if !slices.Equal(positional, test.positional) || *now != test.now || *image != test.image {
				t.Errorf("positional %q, now %v, image %q", positional, *now, *image)
			}
		})
	}
}
