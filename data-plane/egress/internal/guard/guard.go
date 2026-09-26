package guard

import (
	"context"
	"fmt"
	"net"
	"net/netip"
	"slices"
	"syscall"
	"time"
)

type Refusal struct {
	Reason string
}

func (r *Refusal) Error() string { return r.Reason }

type named struct{}

func Naming(ctx context.Context, listed bool) context.Context {
	return context.WithValue(ctx, named{}, listed)
}

func Named(ctx context.Context) bool {
	listed, _ := ctx.Value(named{}).(bool)
	return listed
}

func Dialer() *net.Dialer {
	return &net.Dialer{Timeout: 30 * time.Second, KeepAlive: 30 * time.Second, ControlContext: refuseUnreachable}
}

var (
	nowhere = netip.MustParsePrefix("0.0.0.0/8")
	inside  = []netip.Prefix{
		netip.MustParsePrefix("100.64.0.0/10"),
		netip.MustParsePrefix("64:ff9b::/96"),
		netip.MustParsePrefix("2002::/16"),
	}
)

func refuseUnreachable(ctx context.Context, _, address string, _ syscall.RawConn) error {
	host, _, err := net.SplitHostPort(address)
	if err != nil {
		return err
	}

	ip, err := netip.ParseAddr(host)
	if err != nil {
		return &Refusal{fmt.Sprintf("egress never opens a connection to %s", host)}
	}
	ip = ip.Unmap()

	if ip.IsLoopback() || ip.IsLinkLocalUnicast() || ip.IsLinkLocalMulticast() || ip.IsUnspecified() ||
		ip.IsMulticast() || ip.IsInterfaceLocalMulticast() || nowhere.Contains(ip) {
		return &Refusal{fmt.Sprintf("egress never opens a connection to %s", host)}
	}

	if !Named(ctx) && (ip.IsPrivate() || slices.ContainsFunc(inside, func(prefix netip.Prefix) bool {
		return prefix.Contains(ip)
	})) {
		return &Refusal{fmt.Sprintf("egress opens a connection to the private address %s only for a host the allow-list names", host)}
	}

	return nil
}
