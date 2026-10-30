package sshd

import (
	"io"
	"net"
	"sync"
	"time"
)

type stdio struct {
	in     io.Reader
	out    io.Writer
	close  func() error
	closed sync.Once
}

func Stdio(in io.Reader, out io.Writer, close func() error) net.Conn {
	return &stdio{in: in, out: out, close: close}
}

func (s *stdio) Read(p []byte) (int, error)  { return s.in.Read(p) }
func (s *stdio) Write(p []byte) (int, error) { return s.out.Write(p) }

func (s *stdio) Close() error {
	var err error
	s.closed.Do(func() {
		if s.close != nil {
			err = s.close()
		}
	})
	return err
}

func (s *stdio) LocalAddr() net.Addr              { return address{} }
func (s *stdio) RemoteAddr() net.Addr             { return address{} }
func (s *stdio) SetDeadline(time.Time) error      { return nil }
func (s *stdio) SetReadDeadline(time.Time) error  { return nil }
func (s *stdio) SetWriteDeadline(time.Time) error { return nil }

type address struct{}

func (address) Network() string { return "stdio" }
func (address) String() string  { return "stdio" }
