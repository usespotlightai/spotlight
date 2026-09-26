package authority

import (
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/tls"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/pem"
	"fmt"
	"math/big"
	"net"
	"sync"
	"time"
)

const lifetime = 48 * time.Hour

type Authority struct {
	certificate *x509.Certificate
	key         *ecdsa.PrivateKey
	leafKey     *ecdsa.PrivateKey
	notAfter    time.Time

	mu     sync.Mutex
	leaves map[string]*tls.Certificate
}

func New(now time.Time, standsInFor []string) (*Authority, error) {
	key, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		return nil, fmt.Errorf("make the run's authority: %w", err)
	}
	leafKey, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		return nil, fmt.Errorf("make the run's authority: %w", err)
	}

	serial, err := serialNumber()
	if err != nil {
		return nil, err
	}

	template := &x509.Certificate{
		SerialNumber:          serial,
		Subject:               pkix.Name{CommonName: "Spotlight egress", Organization: []string{"Spotlight"}},
		NotBefore:             now.Add(-time.Hour),
		NotAfter:              now.Add(lifetime),
		KeyUsage:              x509.KeyUsageCertSign | x509.KeyUsageCRLSign,
		BasicConstraintsValid: true,
		IsCA:                  true,
		MaxPathLenZero:        true,
	}
	constrained(template, standsInFor)

	der, err := x509.CreateCertificate(rand.Reader, template, template, &key.PublicKey, key)
	if err != nil {
		return nil, fmt.Errorf("make the run's authority: %w", err)
	}
	certificate, err := x509.ParseCertificate(der)
	if err != nil {
		return nil, fmt.Errorf("make the run's authority: %w", err)
	}

	return &Authority{
		certificate: certificate,
		key:         key,
		leafKey:     leafKey,
		notAfter:    template.NotAfter,
		leaves:      map[string]*tls.Certificate{},
	}, nil
}

func (a *Authority) PEM() []byte {
	return pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: a.certificate.Raw})
}

func (a *Authority) For(host string) (*tls.Certificate, error) {
	a.mu.Lock()
	defer a.mu.Unlock()

	if leaf, ok := a.leaves[host]; ok {
		return leaf, nil
	}

	serial, err := serialNumber()
	if err != nil {
		return nil, err
	}

	template := &x509.Certificate{
		SerialNumber: serial,
		Subject:      pkix.Name{CommonName: host},
		NotBefore:    a.certificate.NotBefore,
		NotAfter:     a.notAfter,
		KeyUsage:     x509.KeyUsageDigitalSignature,
		ExtKeyUsage:  []x509.ExtKeyUsage{x509.ExtKeyUsageServerAuth},
	}
	if ip := net.ParseIP(host); ip != nil {
		template.IPAddresses = []net.IP{ip}
	} else {
		template.DNSNames = []string{host}
	}

	der, err := x509.CreateCertificate(rand.Reader, template, a.certificate, &a.leafKey.PublicKey, a.key)
	if err != nil {
		return nil, fmt.Errorf("make a certificate for %s: %w", host, err)
	}

	leaf := &tls.Certificate{Certificate: [][]byte{der, a.certificate.Raw}, PrivateKey: a.leafKey}
	a.leaves[host] = leaf

	return leaf, nil
}

func constrained(template *x509.Certificate, hosts []string) {
	template.PermittedDNSDomainsCritical = true
	template.PermittedIPRanges = []*net.IPNet{{IP: net.IPv4zero, Mask: net.CIDRMask(32, 32)}}

	for _, host := range hosts {
		if ip := net.ParseIP(host); ip != nil {
			bits := 8 * len(ip.To16())
			if four := ip.To4(); four != nil {
				ip, bits = four, 32
			}
			template.PermittedIPRanges = append(template.PermittedIPRanges, &net.IPNet{IP: ip, Mask: net.CIDRMask(bits, bits)})
			continue
		}
		template.PermittedDNSDomains = append(template.PermittedDNSDomains, host)
	}

	if len(template.PermittedDNSDomains) == 0 {
		template.PermittedDNSDomains = []string{"spotlight.invalid"}
	}
}

func serialNumber() (*big.Int, error) {
	serial, err := rand.Int(rand.Reader, new(big.Int).Lsh(big.NewInt(1), 128))
	if err != nil {
		return nil, fmt.Errorf("draw a serial number: %w", err)
	}

	return serial, nil
}
