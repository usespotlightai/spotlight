package tunnel

import (
	"bufio"
	"io"
	"net"
	"strings"
	"testing"
)

func connected(t *testing.T) (net.Conn, net.Conn) {
	t.Helper()

	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	defer listener.Close()

	dialled, err := net.Dial("tcp", listener.Addr().String())
	if err != nil {
		t.Fatal(err)
	}
	accepted, err := listener.Accept()
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		_ = dialled.Close()
		_ = accepted.Close()
	})

	return dialled, accepted
}

func TestSpliceCarriesBothWaysAndCountsTheBytes(t *testing.T) {
	sandbox, client := connected(t)
	upstream, host := connected(t)

	got := make(chan string, 1)
	go func() {
		_, _ = sandbox.Write([]byte("hello"))
		CloseWrite(sandbox)
		answer, _ := io.ReadAll(sandbox)
		got <- string(answer)
	}()
	go func() {
		sent, _ := io.ReadAll(host)
		_, _ = host.Write([]byte("answered " + string(sent)))
		CloseWrite(host)
	}()

	out, in := Splice(client, bufio.NewReader(client), upstream)

	if out != 5 || in != 14 {
		t.Errorf("counted %d out and %d in", out, in)
	}
	if answer := <-got; answer != "answered hello" {
		t.Errorf("the sandbox read %q", answer)
	}
}

func TestBufferedReadsWhatTheReaderAlreadyTook(t *testing.T) {
	one, other := net.Pipe()
	defer other.Close()
	reader := bufio.NewReader(strings.NewReader("already read"))

	read, _ := io.ReadAll(io.LimitReader(Buffered(one, reader), 12))
	if string(read) != "already read" {
		t.Errorf("read %q", read)
	}
}

func TestOneHandsItsConnectionOutOnceAndClosesWithIt(t *testing.T) {
	conn, other := net.Pipe()
	defer other.Close()
	listener := One(conn)

	handed, err := listener.Accept()
	if err != nil {
		t.Fatal(err)
	}
	accepted := make(chan error, 1)
	go func() {
		_, err := listener.Accept()
		accepted <- err
	}()

	_ = handed.Close()
	if err := <-accepted; err != net.ErrClosed {
		t.Errorf("the second accept returned %v", err)
	}
}
