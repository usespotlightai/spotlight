package replay

import (
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
)

type stationChange struct {
	Part string  `json:"part"`
	Name *string `json:"name"`
	Kind string  `json:"kind"`
	Was  *string `json:"was"`
	Now  *string `json:"now"`
}

type candidate struct {
	ID             string         `json:"id"`
	Version        int            `json:"version"`
	Address        string         `json:"address"`
	StationID      string         `json:"stationId"`
	StationAddress string         `json:"stationAddress"`
	Name           string         `json:"name"`
	Station        map[string]any `json:"station"`
	Fingerprint    string         `json:"fingerprint"`
	ChangedFrom    struct {
		Fingerprint string          `json:"fingerprint"`
		Changes     []stationChange `json:"changes"`
	} `json:"changedFrom"`
	CreatedAt string `json:"createdAt"`
}

type stationFlags struct {
	set     *flag.FlagSet
	station *string
	json    *bool
	args    []string
}

func flagsFor(name string) *stationFlags {
	set := flag.NewFlagSet(name, flag.ContinueOnError)
	set.SetOutput(io.Discard)

	return &stationFlags{
		set:     set,
		station: set.String("station", "", "the station, as team/line/station"),
		json:    set.Bool("json", false, "answer in JSON"),
	}
}

func (f *stationFlags) parse(args []string) error {
	positional, err := parsed(f.set, args)
	if err != nil {
		return fmt.Errorf("%w\nusage:\n%s", err, Usage)
	}
	f.args = positional
	if *f.station == "" {
		return fmt.Errorf("--station names the station, as team/line/station\nusage:\n%s", Usage)
	}

	return nil
}

func (c *cli) propose(args []string) error {
	flags := flagsFor("propose")
	name := flags.set.String("name", "", "tells the candidate from the station's others")
	if err := flags.parse(args); err != nil {
		return err
	}
	if strings.TrimSpace(*name) == "" {
		return fmt.Errorf("--name tells the candidate from the station's others")
	}
	if len(flags.args) != 1 {
		return fmt.Errorf("name one file holding the station block, as the line resource holds a station, or - to read it from stdin")
	}

	block, err := c.block(flags.args[0])
	if err != nil {
		return err
	}

	at, err := c.station(*flags.station)
	if err != nil {
		return err
	}

	var raw json.RawMessage
	var made candidate
	if err := c.api.create(at.proposals(), map[string]any{"name": *name, "station": block}, &raw); err != nil {
		return fmt.Errorf("propose %s: %w", *name, err)
	}
	if err := json.Unmarshal(raw, &made); err != nil {
		return fmt.Errorf("Spotlight answered with %q", string(raw))
	}

	if *flags.json {
		return c.printJSON(raw)
	}

	fmt.Fprintf(c.out, "Proposed %s (%s); nothing is applied.\n", made.Address, made.ID)
	c.printChanges(made)

	return nil
}

func (c *cli) block(path string) (map[string]any, error) {
	if ext := strings.ToLower(filepath.Ext(path)); ext == ".tf" || ext == ".hcl" {
		return nil, fmt.Errorf("%s is HCL; Spotlight writes HCL but never reads it, so give the station block as JSON, as the line resource holds it", path)
	}

	var read []byte
	var err error
	if path == "-" {
		read, err = io.ReadAll(c.in)
	} else {
		read, err = os.ReadFile(path)
	}
	if err != nil {
		return nil, fmt.Errorf("read the station block: %w", err)
	}

	var block map[string]any
	if err := json.Unmarshal(read, &block); err != nil || block == nil {
		return nil, fmt.Errorf("%s holds no JSON object; it holds the station block, as the line resource holds a station", path)
	}

	return block, nil
}

func (c *cli) candidates(args []string) error {
	flags := flagsFor("candidates")
	if err := flags.parse(args); err != nil {
		return err
	}

	listed, raws, err := c.candidatesAt(*flags.station)
	if err != nil {
		return err
	}

	if *flags.json {
		return c.printJSON(raws)
	}

	if len(listed) == 0 {
		fmt.Fprintf(c.out, "%s has no candidates.\n", *flags.station)
		return nil
	}

	table := tabled(c.out)
	fmt.Fprintln(table, "NAME\tCHANGES\tPROPOSED\tID")
	for _, each := range listed {
		fmt.Fprintf(table, "%s\t%d\t%s\t%s\n", each.Name, len(each.ChangedFrom.Changes), each.CreatedAt, each.ID)
	}

	return table.Flush()
}

func (c *cli) candidatesAt(address string) ([]candidate, []json.RawMessage, error) {
	at, err := c.station(address)
	if err != nil {
		return nil, nil, err
	}

	return c.candidatesOf(at)
}

func (c *cli) candidatesOf(at *station) ([]candidate, []json.RawMessage, error) {
	var raws listed[json.RawMessage]
	if err := c.api.get(at.candidates(), &raws); err != nil {
		return nil, nil, fmt.Errorf("list the candidates of %s: %w", at.address, err)
	}

	held := make([]candidate, len(raws.Items))
	for at, raw := range raws.Items {
		if err := json.Unmarshal(raw, &held[at]); err != nil {
			return nil, nil, fmt.Errorf("Spotlight answered with %q", string(raw))
		}
	}

	return held, raws.Items, nil
}

func (c *cli) show(args []string) error {
	flags := flagsFor("show")
	if err := flags.parse(args); err != nil {
		return err
	}
	if len(flags.args) != 1 {
		return fmt.Errorf("name the candidate to show, by its name or id")
	}

	listed, raws, err := c.candidatesAt(*flags.station)
	if err != nil {
		return err
	}

	found, err := pick(listed, flags.args[0], "candidate", *flags.station)
	if err != nil {
		return err
	}

	if *flags.json {
		for at, each := range listed {
			if each.ID == found.ID {
				return c.printJSON(raws[at])
			}
		}
	}

	fmt.Fprintf(c.out, "%s, proposed %s\nid %s\nfingerprint %s\n", found.Address, found.CreatedAt, found.ID, found.Fingerprint)
	c.printChanges(found)

	return nil
}

func (c *cli) printChanges(of candidate) {
	if len(of.ChangedFrom.Changes) == 0 {
		fmt.Fprintf(c.out, "It changes nothing from the live config %s.\n", short(of.ChangedFrom.Fingerprint))
		return
	}

	fmt.Fprintf(c.out, "What it changes from the live config %s:\n", short(of.ChangedFrom.Fingerprint))
	for _, change := range of.ChangedFrom.Changes {
		fmt.Fprintf(c.out, "  %s\n", phrased(change))
	}
}

func phrased(change stationChange) string {
	subject := change.Part
	if change.Name != nil {
		subject += " " + *change.Name
	}

	if change.Was == nil && change.Now == nil || change.Kind != "changed" && change.Name != nil {
		return subject + " " + change.Kind
	}

	return fmt.Sprintf("%s %s → %s", subject, shown(change.Was), shown(change.Now))
}

func shown(text *string) string {
	if text == nil {
		return "none"
	}

	return *text
}

func short(fingerprint string) string {
	if len(fingerprint) > 12 {
		return fingerprint[:12]
	}

	return fingerprint
}
