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

type Blocked struct {
	Reason string
}

func (b *Blocked) Error() string { return b.Reason }

type named struct{}

func Naming(ctx context.Context, listed bool) context.Context {
	return context.WithValue(ctx, named{}, listed)
}

func Named(ctx context.Context) bool {
	listed, _ := ctx.Value(named{}).(bool)
	return listed
}

func Dialer() *net.Dialer {
	return &net.Dialer{Timeout: 30 * time.Second, KeepAlive: 30 * time.Second, ControlContext: blockUnreachable}
}

var (
	nowhere = netip.MustParsePrefix("0.0.0.0/8")
	inside  = []netip.Prefix{
		netip.MustParsePrefix("100.64.0.0/10"),
		netip.MustParsePrefix("64:ff9b::/96"),
		netip.MustParsePrefix("2002::/16"),
	}
)

func blockUnreachable(ctx context.Context, _, address string, _ syscall.RawConn) error {
	host, _, err := net.SplitHostPort(address)
	if err != nil {
		return err
	}

	ip, err := netip.ParseAddr(host)
	if err != nil {
		return &Blocked{fmt.Sprintf("Egress never opens a connection to %s.", host)}
	}
	ip = ip.Unmap()

	if ip.IsLoopback() || ip.IsLinkLocalUnicast() || ip.IsLinkLocalMulticast() || ip.IsUnspecified() ||
		ip.IsMulticast() || ip.IsInterfaceLocalMulticast() || nowhere.Contains(ip) {
		return &Blocked{fmt.Sprintf("Egress never opens a connection to %s.", host)}
	}

	if !Named(ctx) && (ip.IsPrivate() || slices.ContainsFunc(inside, func(prefix netip.Prefix) bool {
		return prefix.Contains(ip)
	})) {
		return &Blocked{fmt.Sprintf("Egress opens a connection to private address %s only if the allow-list names the host.", host)}
	}

	return nil
}
