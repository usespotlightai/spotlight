package service_test

import (
	"encoding/xml"
	"strings"
	"testing"

	"usespotlight.ai/data-plane/host/internal/service"
)

var host = service.Service{Binary: "/usr/local/bin/spotlight-host", Config: "/etc/spotlight/host.env"}

func TestTheSystemdUnitRestartsTheHostAndGivesItsSandboxesTimeToStop(t *testing.T) {
	unit := service.SystemdUnit(host, true)

	for _, want := range []string{
		`ExecStart="/usr/local/bin/spotlight-host"`,
		`Environment="SPOTLIGHT_HOST_CONFIG=/etc/spotlight/host.env"`,
		"Restart=always",
		"RestartPreventExitStatus=3",
		"TimeoutStopSec=90",
		"WantedBy=multi-user.target",
	} {
		if !strings.Contains(unit, want) {
			t.Errorf("the unit lacks %q:\n%s", want, unit)
		}
	}

	if !strings.Contains(service.SystemdUnit(host, false), "WantedBy=default.target") {
		t.Error("a user unit is not wanted by the user's default target")
	}
}

func TestTheLaunchdAgentIsAPlistThatKeepsTheHostAlive(t *testing.T) {
	plist := service.LaunchdPlist(service.Service{Binary: "/Users/a&b/bin/spotlight-host", Config: "/Users/a&b/.spotlight/host.env"}, "/tmp/host.log")

	if err := xml.Unmarshal([]byte(plist), new(struct{})); err != nil {
		t.Fatalf("not well-formed: %v\n%s", err, plist)
	}
	for _, want := range []string{"<key>KeepAlive</key><true/>", "/Users/a&amp;b/bin/spotlight-host", "SPOTLIGHT_HOST_CONFIG"} {
		if !strings.Contains(plist, want) {
			t.Errorf("the agent lacks %q", want)
		}
	}
}

func TestTheSystemdUnitSurvivesAPathSystemdWouldOtherwiseExpand(t *testing.T) {
	unit := service.SystemdUnit(service.Service{Binary: "/opt/my $tools/spotlight-host", Config: "/etc/50%$HOME.env"}, true)

	for _, want := range []string{
		`ExecStart="/opt/my $$tools/spotlight-host"`,
		`Environment="SPOTLIGHT_HOST_CONFIG=/etc/50%%$HOME.env"`,
	} {
		if !strings.Contains(unit, want) {
			t.Errorf("the unit lacks %q:\n%s", want, unit)
		}
	}
}
