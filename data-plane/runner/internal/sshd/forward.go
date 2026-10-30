package sshd

import (
	"log/slog"
	"net"
	"strconv"
	"time"

	"golang.org/x/crypto/ssh"
)

const dialTimeout = 10 * time.Second

type directTCPIP struct {
	Host       string
	Port       uint32
	OriginHost string
	OriginPort uint32
}

type directLocal struct {
	SocketPath string
	Reserved   string
	Reserved2  uint32
}

func forwardTCP(incoming ssh.NewChannel, log *slog.Logger) {
	var target directTCPIP
	if err := ssh.Unmarshal(incoming.ExtraData(), &target); err != nil {
		_ = incoming.Reject(ssh.ConnectionFailed, "the forward request is malformed")
		return
	}

	if !loopback(target.Host) {
		_ = incoming.Reject(ssh.Prohibited, "only ports on localhost can be forwarded")
		return
	}

	address := net.JoinHostPort(target.Host, strconv.FormatUint(uint64(target.Port), 10))
	forward(incoming, "tcp", address, log)
}

func forwardLocal(incoming ssh.NewChannel, log *slog.Logger) {
	var target directLocal
	if err := ssh.Unmarshal(incoming.ExtraData(), &target); err != nil {
		_ = incoming.Reject(ssh.ConnectionFailed, "the forward request is malformed")
		return
	}

	forward(incoming, "unix", target.SocketPath, log)
}

func forward(incoming ssh.NewChannel, network, address string, log *slog.Logger) {
	other, err := net.DialTimeout(network, address, dialTimeout)
	if err != nil {
		log.Debug("could not forward", "address", address, "error", err)
		_ = incoming.Reject(ssh.ConnectionFailed, err.Error())
		return
	}

	channel, requests, err := incoming.Accept()
	if err != nil {
		other.Close()
		return
	}
	go ssh.DiscardRequests(requests)

	join(channel, other)
}

func loopback(host string) bool {
	if host == "localhost" {
		return true
	}
	ip := net.ParseIP(host)
	return ip != nil && ip.IsLoopback()
}
