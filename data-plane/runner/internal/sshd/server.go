package sshd

import (
	"fmt"
	"io"
	"log/slog"
	"net"
	"sync"

	"golang.org/x/crypto/ssh"
)

type Options struct {
	HostKey ssh.Signer
	Dir     string
	Env     []string
	Shell   string
	Log     *slog.Logger
}

const (
	channelSession     = "session"
	channelDirectTCPIP = "direct-tcpip"
	channelDirectLocal = "direct-streamlocal@openssh.com"
)

// The control plane authenticated the person, so every client is let in.
func Serve(conn net.Conn, opts Options) error {
	if opts.Log == nil {
		opts.Log = slog.New(slog.DiscardHandler)
	}

	config := &ssh.ServerConfig{
		NoClientAuth: true,
		PublicKeyCallback: func(ssh.ConnMetadata, ssh.PublicKey) (*ssh.Permissions, error) {
			return &ssh.Permissions{}, nil
		},
		KeyboardInteractiveCallback: func(ssh.ConnMetadata, ssh.KeyboardInteractiveChallenge) (*ssh.Permissions, error) {
			return &ssh.Permissions{}, nil
		},
		ServerVersion: "SSH-2.0-Spotlight",
	}
	config.AddHostKey(opts.HostKey)

	server, channels, requests, err := ssh.NewServerConn(conn, config)
	if err != nil {
		conn.Close()
		return fmt.Errorf("open the SSH connection: %w", err)
	}
	defer server.Close()

	go ssh.DiscardRequests(requests)

	var open sync.WaitGroup
	for incoming := range channels {
		switch incoming.ChannelType() {
		case channelSession:
			open.Go(func() { serveSession(incoming, opts) })
		case channelDirectTCPIP:
			open.Go(func() { forwardTCP(incoming, opts.Log) })
		case channelDirectLocal:
			open.Go(func() { forwardLocal(incoming, opts.Log) })
		default:
			_ = incoming.Reject(ssh.UnknownChannelType, "unknown channel type: "+incoming.ChannelType())
		}
	}
	open.Wait()

	return nil
}

func join(channel ssh.Channel, other net.Conn) {
	var done sync.WaitGroup
	done.Go(func() {
		_, _ = io.Copy(other, channel)
		if half, ok := other.(interface{ CloseWrite() error }); ok {
			_ = half.CloseWrite()
		} else {
			_ = other.Close()
		}
	})
	done.Go(func() {
		_, _ = io.Copy(channel, other)
		_ = channel.CloseWrite()
	})
	done.Wait()
	_ = other.Close()
	_ = channel.Close()
}
