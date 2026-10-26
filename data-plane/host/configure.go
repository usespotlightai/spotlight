package host

import (
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"os"
	"slices"
	"strings"
	"text/tabwriter"

	"usespotlight.ai/data-plane/host/internal/config"
)

func configure(version string, args []string) error {
	if len(args) == 0 || strings.HasPrefix(args[0], "-") {
		return listSettings(os.Stdout, args)
	}

	switch rest := args[1:]; args[0] {
	case "list":
		return listSettings(os.Stdout, rest)
	case "get":
		return getSetting(os.Stdout, rest)
	case "set":
		return changeSettings(os.Stdout, version, "set", rest)
	case "unset":
		return changeSettings(os.Stdout, version, "unset", rest)
	case "keys":
		return listKeys(os.Stdout)
	default:
		return fmt.Errorf("no command %q\n%s", "host config "+args[0], configHelp.Synopsis())
	}
}

type listed struct {
	Key   string `json:"key"`
	Env   string `json:"variable"`
	Value string `json:"value"`
}

// shown is what the file sets, friendly keys first in table order, secrets masked.
func shown(values map[string]string) []listed {
	var settings []listed
	for _, setting := range config.Settings {
		if value, ok := values[setting.Env]; ok {
			if setting.Secret {
				value = config.Mask(value)
			}
			settings = append(settings, listed{Key: setting.Key, Env: setting.Env, Value: value})
		}
	}
	var others []string
	for env := range values {
		if config.KeyOf(env) == env {
			others = append(others, env)
		}
	}
	slices.Sort(others)
	for _, env := range others {
		settings = append(settings, listed{Key: env, Env: env, Value: values[env]})
	}
	return settings
}

func listSettings(out io.Writer, args []string) error {
	flags := flag.NewFlagSet("config", flag.ContinueOnError)
	asJSON := flags.Bool("json", false, "")
	if rest, err := parse(flags, args); err != nil || len(rest) > 0 {
		return fmt.Errorf("%s", configHelp.Synopsis())
	}

	file, err := config.Open(config.Path())
	if err != nil {
		return err
	}
	settings := shown(file.Values())

	if *asJSON {
		if settings == nil {
			settings = []listed{}
		}
		return json.NewEncoder(out).Encode(map[string]any{"path": file.Path, "settings": settings})
	}

	fmt.Fprintln(out, paint(bold, file.Path))
	if len(settings) == 0 {
		fmt.Fprintln(out, "No settings. Run: spotlight host init")
		return nil
	}
	table := tabwriter.NewWriter(out, 0, 0, 2, ' ', 0)
	for _, each := range settings {
		fmt.Fprintf(table, "  %s\t%s\n", each.Key, each.Value)
	}
	return table.Flush()
}

func getSetting(out io.Writer, args []string) error {
	if len(args) != 1 {
		return fmt.Errorf("say which key\n%s", configGetHelp.Synopsis())
	}
	setting, err := config.Lookup(args[0])
	if err != nil {
		return err
	}

	file, err := config.Open(config.Path())
	if err != nil {
		return err
	}
	value, ok := file.Values()[setting.Env]
	if !ok {
		return fmt.Errorf("%s is not set in %s", setting.Key, file.Path)
	}

	fmt.Fprintln(out, value)
	return nil
}

func changeSettings(out io.Writer, version, verb string, args []string) error {
	shown := configSetHelp
	if verb == "unset" {
		shown = configUnsetHelp
	}

	flags := flag.NewFlagSet("config "+verb, flag.ContinueOnError)
	now := flags.Bool("now", false, "")
	pairs, err := parse(flags, args)
	if err != nil || len(pairs) == 0 {
		return fmt.Errorf("%s", shown.Synopsis())
	}

	file, err := config.Open(config.Path())
	if err != nil {
		return err
	}

	var changed []config.Setting
	for _, pair := range pairs {
		key, value, hasValue := strings.Cut(pair, "=")
		if hasValue != (verb == "set") {
			return fmt.Errorf("%s", shown.Synopsis())
		}
		setting, err := config.Lookup(strings.TrimSpace(key))
		if err != nil {
			return err
		}
		if verb == "set" {
			if err := file.Set(setting.Env, value); err != nil {
				return err
			}
		} else if !file.Unset(setting.Env) {
			fmt.Fprintf(out, "%s was not set\n", setting.Key)
			continue
		}
		changed = append(changed, setting)
	}
	if len(changed) == 0 {
		return nil
	}

	if _, err := config.Check(version, file.Values()); err != nil {
		return fmt.Errorf("nothing changed, because %w", config.Friendly(err))
	}
	if err := file.Save(); err != nil {
		return err
	}

	keys := make([]string, 0, len(changed))
	for _, setting := range changed {
		keys = append(keys, setting.Key)
		if os.Getenv(setting.Env) != "" {
			fmt.Fprintf(out, "%s The environment sets %s, which wins over the file.\n", mark(warned), setting.Env)
		}
	}
	fmt.Fprintf(out, "%s Saved %s in %s\n", mark(passed), strings.Join(keys, ", "), file.Path)

	return apply(out, version, changed, *now)
}

func listKeys(out io.Writer) error {
	table := tabwriter.NewWriter(out, 0, 0, 2, ' ', 0)
	fmt.Fprintln(table, "KEY\tVARIABLE\tAPPLIES")
	for _, setting := range config.Settings {
		applies := "at a restart"
		if setting.Live {
			applies = "live"
		}
		fmt.Fprintf(table, "%s\t%s\t%s\n", setting.Key, setting.Env, applies)
	}
	return table.Flush()
}
