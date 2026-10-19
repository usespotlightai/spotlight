package authority

import (
	"crypto/x509"
	"encoding/pem"
	"testing"
	"time"
)

func TestInterceptsTLSForAHostWithACertificateOnlyItsRunTrusts(t *testing.T) {
	now := time.Now()
	run, err := New(now, []string{"mcp.linear.app", "sentry.io"})
	if err != nil {
		t.Fatal(err)
	}
	other, err := New(now, []string{"mcp.linear.app"})
	if err != nil {
		t.Fatal(err)
	}

	leaf, err := run.For("mcp.linear.app")
	if err != nil {
		t.Fatal(err)
	}
	parsed, err := x509.ParseCertificate(leaf.Certificate[0])
	if err != nil {
		t.Fatal(err)
	}

	trusting := func(a *Authority) *x509.CertPool {
		pool := x509.NewCertPool()
		block, _ := pem.Decode(a.PEM())
		authority, err := x509.ParseCertificate(block.Bytes)
		if err != nil {
			t.Fatal(err)
		}
		pool.AddCert(authority)
		return pool
	}

	if _, err := parsed.Verify(x509.VerifyOptions{DNSName: "mcp.linear.app", Roots: trusting(run)}); err != nil {
		t.Errorf("its own run does not trust it: %v", err)
	}
	if _, err := parsed.Verify(x509.VerifyOptions{DNSName: "mcp.linear.app", Roots: trusting(other)}); err == nil {
		t.Error("another run's sandbox trusts it")
	}
	if _, err := parsed.Verify(x509.VerifyOptions{DNSName: "sentry.io", Roots: trusting(run)}); err == nil {
		t.Error("it intercepts TLS for a host it was not made for")
	}

	outside, err := run.For("api.github.com")
	if err != nil {
		t.Fatal(err)
	}
	stray, _ := x509.ParseCertificate(outside.Certificate[0])
	if _, err := stray.Verify(x509.VerifyOptions{DNSName: "api.github.com", Roots: trusting(run)}); err == nil {
		t.Error("the run's authority vouches for a host egress injects nothing for")
	}
}

func TestIsAnAuthorityThatSignsNoOtherAuthority(t *testing.T) {
	run, err := New(time.Now(), nil)
	if err != nil {
		t.Fatal(err)
	}

	block, _ := pem.Decode(run.PEM())
	certificate, err := x509.ParseCertificate(block.Bytes)
	if err != nil {
		t.Fatal(err)
	}
	if !certificate.IsCA || !certificate.MaxPathLenZero || certificate.KeyUsage&x509.KeyUsageCertSign == 0 {
		t.Errorf("authority %+v", certificate)
	}
	if lives := time.Until(certificate.NotAfter); lives > lifetime || lives < lifetime-time.Minute {
		t.Errorf("lives %s", lives)
	}
}

func TestMakesOneCertificatePerHostAndKeepsIt(t *testing.T) {
	run, err := New(time.Now(), []string{"mcp.linear.app", "10.0.0.7"})
	if err != nil {
		t.Fatal(err)
	}

	first, _ := run.For("mcp.linear.app")
	again, _ := run.For("mcp.linear.app")
	address, _ := run.For("10.0.0.7")
	if first != again {
		t.Error("made a second certificate for the same host")
	}

	parsed, err := x509.ParseCertificate(address.Certificate[0])
	if err != nil || len(parsed.IPAddresses) != 1 || parsed.IPAddresses[0].String() != "10.0.0.7" {
		t.Errorf("certificate for an address %+v: %v", parsed, err)
	}

	block, _ := pem.Decode(run.PEM())
	authority, _ := x509.ParseCertificate(block.Bytes)
	roots := x509.NewCertPool()
	roots.AddCert(authority)
	if _, err := parsed.Verify(x509.VerifyOptions{Roots: roots}); err != nil {
		t.Errorf("an address it injects for is not vouched for: %v", err)
	}
}
