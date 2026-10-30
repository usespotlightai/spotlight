package tunnel

import (
	"context"
	"errors"
	"io"
	"log/slog"
	"net"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"
	"time"

	"github.com/coder/websocket"
	"github.com/coder/websocket/wsjson"

	"usespotlight.ai/data-plane/control"
	"usespotlight.ai/data-plane/protocol"
)

var quiet = slog.New(slog.DiscardHandler)

type controlPlane struct {
	server   *httptest.Server
	asks     chan protocol.TunnelStream
	streams  chan *websocket.Conn
	connects atomic.Int32
	dropOnce atomic.Bool
}

func newControlPlane(t *testing.T) *controlPlane {
	t.Helper()

	cp := &controlPlane{asks: make(chan protocol.TunnelStream, 4), streams: make(chan *websocket.Conn, 4)}
	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/hosts/host_1/tunnel", func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") != "Bearer pool-token" {
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		conn, err := websocket.Accept(w, r, nil)
		if err != nil {
			return
		}
		defer conn.CloseNow()

		if cp.connects.Add(1) == 1 && cp.dropOnce.Load() {
			return
		}
		for {
			select {
			case ask := <-cp.asks:
				if err := wsjson.Write(r.Context(), conn, ask); err != nil {
					return
				}
			case <-r.Context().Done():
				return
			}
		}
	})
	mux.HandleFunc("GET /api/hosts/host_1/tunnel/{stream}", func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") != "Bearer pool-token" {
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		conn, err := websocket.Accept(w, r, nil)
		if err != nil {
			return
		}
		cp.streams <- conn
		<-r.Context().Done()
	})
	cp.server = httptest.NewServer(mux)
	t.Cleanup(cp.server.Close)

	return cp
}

func serving(t *testing.T, cp *controlPlane, open Open) {
	t.Helper()

	tunnel, err := New(cp.server.URL, "host_1", control.Bearer("pool-token"), quiet)
	if err != nil {
		t.Fatal(err)
	}
	tunnel.RetryFloor = 10 * time.Millisecond

	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan struct{})
	go func() {
		tunnel.Serve(ctx, open)
		close(done)
	}()
	t.Cleanup(func() {
		cancel()
		select {
		case <-done:
		case <-time.After(5 * time.Second):
			t.Error("the tunnel did not stop")
		}
	})
}

func echoing(opened *atomic.Int32) Open {
	return func(_ context.Context, sandboxID string) (io.ReadWriteCloser, error) {
		if sandboxID != "sandbox_a" {
			return nil, errors.New("no such sandbox on this host")
		}
		opened.Add(1)
		ours, theirs := net.Pipe()
		go func() {
			_, _ = io.Copy(theirs, theirs)
			theirs.Close()
		}()
		return ours, nil
	}
}

func stream(t *testing.T, cp *controlPlane) *websocket.Conn {
	t.Helper()
	select {
	case conn := <-cp.streams:
		t.Cleanup(func() { conn.CloseNow() })
		return conn
	case <-time.After(5 * time.Second):
		t.Fatal("the host did not dial the stream back")
		return nil
	}
}

func TestPipesAnEditorStreamToSSHInTheSandbox(t *testing.T) {
	cp := newControlPlane(t)
	var opened atomic.Int32
	serving(t, cp, echoing(&opened))

	cp.asks <- protocol.TunnelStream{Stream: "stream_1", SandboxID: "sandbox_a"}
	conn := stream(t, cp)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := conn.Write(ctx, websocket.MessageBinary, []byte("SSH-2.0-OpenSSH\r\n")); err != nil {
		t.Fatal(err)
	}
	kind, got, err := conn.Read(ctx)
	if err != nil || kind != websocket.MessageBinary || string(got) != "SSH-2.0-OpenSSH\r\n" {
		t.Fatalf("read %v %q: %v", kind, got, err)
	}
	if opened.Load() != 1 {
		t.Errorf("opened SSH %d times", opened.Load())
	}
}

func TestClosesTheStreamOfASandboxItDoesNotRun(t *testing.T) {
	cp := newControlPlane(t)
	var opened atomic.Int32
	serving(t, cp, echoing(&opened))

	cp.asks <- protocol.TunnelStream{Stream: "stream_2", SandboxID: "sandbox_elsewhere"}
	conn := stream(t, cp)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	_, _, err := conn.Read(ctx)
	if status := websocket.CloseStatus(err); status != protocol.TunnelNoSandbox {
		t.Errorf("closed with %v (%v)", status, err)
	}
}

func TestOpensTheTunnelAgainAfterItCloses(t *testing.T) {
	cp := newControlPlane(t)
	cp.dropOnce.Store(true)
	var opened atomic.Int32
	serving(t, cp, echoing(&opened))

	cp.asks <- protocol.TunnelStream{Stream: "stream_3", SandboxID: "sandbox_a"}
	stream(t, cp)

	if cp.connects.Load() < 2 {
		t.Errorf("connected %d times", cp.connects.Load())
	}
}
