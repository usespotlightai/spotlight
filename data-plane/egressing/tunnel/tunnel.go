package tunnel

import (
	"bufio"
	"errors"
	"io"
	"net"
	"net/http"
	"sync"
)

const Established = "HTTP/1.1 200 Connection Established\r\n\r\n"

func Hijack(w http.ResponseWriter) (net.Conn, *bufio.Reader, error) {
	hijacker, ok := w.(http.Hijacker)
	if !ok {
		return nil, nil, errors.New("the connection cannot be taken over")
	}

	conn, buffered, err := hijacker.Hijack()
	if err != nil {
		return nil, nil, err
	}

	return conn, buffered.Reader, nil
}

func Splice(client net.Conn, buffered io.Reader, upstream net.Conn) (out, in int64) {
	var copying sync.WaitGroup
	copying.Go(func() {
		out, _ = io.Copy(upstream, buffered)
		CloseWrite(upstream)
	})
	in, _ = io.Copy(client, upstream)
	CloseWrite(client)
	copying.Wait()

	return out, in
}

func CloseWrite(conn net.Conn) {
	if half, ok := conn.(interface{ CloseWrite() error }); ok {
		_ = half.CloseWrite()
	}
}

func Buffered(conn net.Conn, reader *bufio.Reader) net.Conn {
	return &bufferedConn{Conn: conn, reader: reader}
}

type bufferedConn struct {
	net.Conn
	reader *bufio.Reader
}

func (c *bufferedConn) Read(b []byte) (int, error) {
	return c.reader.Read(b)
}

func One(conn net.Conn) net.Listener {
	return &oneConn{conn: conn}
}

type oneConn struct {
	conn   net.Conn
	once   sync.Once
	closed chan struct{}
}

func (l *oneConn) Accept() (net.Conn, error) {
	var handed net.Conn

	l.once.Do(func() {
		l.closed = make(chan struct{})
		handed = &closingConn{Conn: l.conn, closed: l.closed}
	})
	if handed != nil {
		return handed, nil
	}

	<-l.closed
	return nil, net.ErrClosed
}

func (l *oneConn) Close() error {
	return nil
}

func (l *oneConn) Addr() net.Addr {
	return l.conn.LocalAddr()
}

type closingConn struct {
	net.Conn
	once   sync.Once
	closed chan struct{}
}

func (c *closingConn) Close() error {
	c.once.Do(func() { close(c.closed) })
	return c.Conn.Close()
}
