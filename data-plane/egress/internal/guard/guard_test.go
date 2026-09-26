package guard

import (
	"context"
	"testing"
)

func TestNeverConnectsToItselfNorToInstanceMetadata(t *testing.T) {
	anywhere := Naming(context.Background(), false)
	for _, address := range []string{
		"127.0.0.1:3128", "[::1]:80", "169.254.169.254:80", "[fe80::1]:80", "0.0.0.0:80", "0.1.2.3:80",
		"224.0.0.1:80", "[::ffff:127.0.0.1]:80", "[::ffff:169.254.169.254]:80",
	} {
		if err := refuseUnreachable(Naming(context.Background(), true), "tcp", address, nil); err == nil {
			t.Errorf("would connect to %s even for a named host", address)
		}
	}
	for _, address := range []string{
		"10.0.0.7:443", "192.168.1.20:8080", "172.18.0.3:3000", "[fd00:ec2::254]:80", "100.100.100.200:80",
		"[::ffff:10.0.0.1]:80", "[64:ff9b::a00:1]:80", "[2002:a00:1::]:80",
	} {
		if err := refuseUnreachable(anywhere, "tcp", address, nil); err == nil {
			t.Errorf("would connect to the private %s for a host no list names", address)
		}
		if err := refuseUnreachable(Naming(context.Background(), true), "tcp", address, nil); err != nil {
			t.Errorf("refused %s for a named host: %v", address, err)
		}
	}
	if err := refuseUnreachable(anywhere, "tcp", "140.82.112.3:443", nil); err != nil {
		t.Errorf("refused a public address: %v", err)
	}
}
