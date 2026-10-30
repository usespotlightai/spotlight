package ssh

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/coder/websocket"

	"usespotlight.ai/data-plane/protocol"
)

type fakeSpotlight struct {
	server *httptest.Server
	asked  chan *http.Request
	serve  func(r *http.Request, w http.ResponseWriter)
}

func newFakeSpotlight(t *testing.T, serve func(r *http.Request, w http.ResponseWriter)) *fakeSpotlight {
	t.Helper()

	fake := &fakeSpotlight{asked: make(chan *http.Request, 1), serve: serve}
	fake.server = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != protocol.EditorConnectPath {
			http.NotFound(w, r)
			return
		}
		select {
		case fake.asked <- r:
		default:
		}
		fake.serve(r, w)
	}))
	t.Cleanup(fake.server.Close)

	return fake
}

func refusing(status int) func(*http.Request, http.ResponseWriter) {
	return func(_ *http.Request, w http.ResponseWriter) {
		http.Error(w, "refused", status)
	}
}

func accepting(t *testing.T, then func(context.Context, *websocket.Conn)) func(*http.Request, http.ResponseWriter) {
	return func(r *http.Request, w http.ResponseWriter) {
		conn, err := websocket.Accept(w, r, nil)
		if err != nil {
			t.Error(err)
			return
		}
		defer conn.CloseNow()
		then(r.Context(), conn)
	}
}

type proxyRun struct {
	cli  cli
	out  *lockedBuffer
	errs *bytes.Buffer
}

type lockedBuffer struct {
	mu      sync.Mutex
	written bytes.Buffer
}

func (b *lockedBuffer) Write(p []byte) (int, error) {
	b.mu.Lock()
	defer b.mu.Unlock()
	return b.written.Write(p)
}

func (b *lockedBuffer) String() string {
	b.mu.Lock()
	defer b.mu.Unlock()
	return b.written.String()
}

func newProxy(t *testing.T, address string, signedIn bool, in io.Reader) *proxyRun {
	t.Helper()

	dir := t.TempDir()
	if signedIn {
		logins, _ := json.Marshal(map[string]any{"logins": map[string]any{address: map[string]string{"token": "session-token", "user": "me@example.com"}}})
		if err := os.WriteFile(filepath.Join(dir, "credentials.json"), logins, 0o600); err != nil {
			t.Fatal(err)
		}
	}
	env := map[string]string{"SPOTLIGHT_CONFIG_DIR": dir, "SPOTLIGHT_URL": address}

	run := &proxyRun{out: &lockedBuffer{}, errs: &bytes.Buffer{}}
	run.cli = cli{env: func(key string) string { return env[key] }, in: in, out: run.out, errs: run.errs, version: "test"}

	return run
}

func (r *proxyRun) proxy(t *testing.T, ctx context.Context, alias string) int {
	t.Helper()
	return r.cli.main(ctx, []string{"proxy", alias})
}

func within(t *testing.T) context.Context {
	t.Helper()
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	t.Cleanup(cancel)
	return ctx
}

func TestProxyPipesBytesBothWaysWithTheLogin(t *testing.T) {
	fake := newFakeSpotlight(t, nil)
	fake.serve = accepting(t, func(ctx context.Context, conn *websocket.Conn) {
		if err := conn.Write(ctx, websocket.MessageBinary, []byte("SSH-2.0-sandbox\r\n")); err != nil {
			t.Error(err)
			return
		}
		for {
			kind, message, err := conn.Read(ctx)
			if err != nil {
				return
			}
			if kind != websocket.MessageBinary {
				t.Errorf("got a %v frame, want binary", kind)
			}
			_ = conn.Write(ctx, websocket.MessageBinary, append([]byte("echo:"), message...))
		}
	})

	in, typed := io.Pipe()
	run := newProxy(t, fake.server.URL, true, in)
	run.cli.waitHint = time.Second
	done := make(chan int, 1)
	go func() { done <- run.proxy(t, within(t), "task-abc.acme.spotlight") }()

	asked := <-fake.asked
	if got := asked.Header.Get("Authorization"); got != "Bearer session-token" {
		t.Errorf("Authorization = %q", got)
	}
	if got := asked.URL.RawQuery; got != "task=abc&workspace=acme" {
		t.Errorf("query = %q", got)
	}

	if _, err := typed.Write([]byte("SSH-2.0-OpenSSH\r\n")); err != nil {
		t.Fatal(err)
	}
	deadline := time.Now().Add(5 * time.Second)
	for !strings.Contains(run.out.String(), "echo:SSH-2.0-OpenSSH") && time.Now().Before(deadline) {
		time.Sleep(10 * time.Millisecond)
	}
	typed.Close()

	if code := <-done; code != 0 {
		t.Fatalf("exit %d: %s", code, run.errs.String())
	}
	if got := run.out.String(); got != "SSH-2.0-sandbox\r\necho:SSH-2.0-OpenSSH\r\n" {
		t.Errorf("stdout = %q", got)
	}
	if run.errs.Len() != 0 {
		t.Errorf("stderr = %q", run.errs.String())
	}
}

func TestProxyBlocksWhileTheSandboxStarts(t *testing.T) {
	ready := make(chan struct{})
	fake := newFakeSpotlight(t, nil)
	fake.serve = accepting(t, func(ctx context.Context, conn *websocket.Conn) {
		<-ready
		_ = conn.Write(ctx, websocket.MessageBinary, []byte("hello"))
		_ = conn.Close(websocket.StatusNormalClosure, "")
	})

	in, typed := io.Pipe()
	defer typed.Close()
	run := newProxy(t, fake.server.URL, true, in)
	run.cli.waitHint = 100 * time.Millisecond
	done := make(chan int, 1)
	go func() { done <- run.proxy(t, within(t), "chat-c1.acme.spotlight") }()

	select {
	case code := <-done:
		t.Fatalf("exited %d while the sandbox started", code)
	case <-time.After(300 * time.Millisecond):
	}
	close(ready)

	if code := <-done; code != 0 || run.out.String() != "hello" {
		t.Fatalf("exit %d, stdout %q, stderr %q", code, run.out.String(), run.errs.String())
	}
	if got := run.errs.String(); got != "Starting the sandbox. This can take some minutes.\n" {
		t.Errorf("stderr = %q, want one start hint", got)
	}
}

func TestProxyNamesEachRefusal(t *testing.T) {
	for status, want := range map[int]string{
		http.StatusBadRequest:         "did not find one task or chat in task-abc.acme.spotlight",
		http.StatusUnauthorized:       "your login for",
		http.StatusForbidden:          "refused the connection: refused",
		http.StatusNotFound:           "there is no task abc in workspace acme that you may open",
		http.StatusServiceUnavailable: "the sandbox could not be opened",
		http.StatusTeapot:             "answered 418: refused",
	} {
		fake := newFakeSpotlight(t, refusing(status))
		run := newProxy(t, fake.server.URL, true, strings.NewReader(""))

		code := run.proxy(t, within(t), "task-abc.acme.spotlight")

		lines := strings.Split(strings.TrimSpace(run.errs.String()), "\n")
		if code != 1 || len(lines) != 1 || !strings.Contains(lines[0], want) || !strings.HasPrefix(lines[0], "spotlight ssh proxy: Sorry, ") {
			t.Errorf("%d: exit %d, stderr %q; want one line with %q", status, code, run.errs.String(), want)
		}
	}
}

func TestProxyAsksForALoginBeforeItConnects(t *testing.T) {
	fake := newFakeSpotlight(t, refusing(http.StatusTeapot))
	run := newProxy(t, fake.server.URL, false, strings.NewReader(""))

	code := run.proxy(t, within(t), "task-abc.acme.spotlight")

	want := "spotlight ssh proxy: Sorry, you are not signed in to " + fake.server.URL + ". Run: spotlight login --url " + fake.server.URL + "\n"
	if code != 1 || run.errs.String() != want {
		t.Errorf("exit %d, stderr %q; want %q", code, run.errs.String(), want)
	}
	select {
	case <-fake.asked:
		t.Error("the proxy connected without a login")
	default:
	}
}

func TestProxyNamesEachCloseCode(t *testing.T) {
	for code, want := range map[websocket.StatusCode]string{
		protocol.EditorStartTimedOut:  "Sorry, the sandbox did not start in 10 minutes",
		protocol.EditorSandboxStopped: "The sandbox stopped. Connect again to start it",
		protocol.EditorHostOffline:    "Sorry, the host of the sandbox is not connected",
		websocket.StatusInternalError: "Sorry, the connection to the sandbox failed",
		websocket.StatusGoingAway:     "restarted. Connect again",
	} {
		fake := newFakeSpotlight(t, nil)
		fake.serve = accepting(t, func(_ context.Context, conn *websocket.Conn) {
			_ = conn.Close(code, "closed")
		})
		in, typed := io.Pipe()
		run := newProxy(t, fake.server.URL, true, in)

		exit := run.proxy(t, within(t), "task-abc.acme.spotlight")
		typed.Close()

		lines := strings.Split(strings.TrimSpace(run.errs.String()), "\n")
		if exit != 1 || len(lines) != 1 || !strings.Contains(lines[0], want) {
			t.Errorf("%d: exit %d, stderr %q; want one line with %q", code, exit, run.errs.String(), want)
		}
	}
}

func TestProxyEndsQuietlyOnANormalClose(t *testing.T) {
	fake := newFakeSpotlight(t, nil)
	fake.serve = accepting(t, func(_ context.Context, conn *websocket.Conn) {
		_ = conn.Close(websocket.StatusNormalClosure, "The sandbox closed the connection.")
	})
	in, typed := io.Pipe()
	defer typed.Close()
	run := newProxy(t, fake.server.URL, true, in)

	if code := run.proxy(t, within(t), "task-abc.acme.spotlight"); code != 0 || run.errs.Len() != 0 {
		t.Errorf("exit %d, stderr %q", code, run.errs.String())
	}
}

func TestProxyStopsOnASignal(t *testing.T) {
	fake := newFakeSpotlight(t, nil)
	fake.serve = accepting(t, func(ctx context.Context, _ *websocket.Conn) {
		<-ctx.Done()
	})
	in, typed := io.Pipe()
	defer typed.Close()
	run := newProxy(t, fake.server.URL, true, in)

	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan int, 1)
	go func() { done <- run.proxy(t, ctx, "task-abc.acme.spotlight") }()
	<-fake.asked
	time.Sleep(100 * time.Millisecond)
	cancel()

	if code := <-done; code != stoppedExit {
		t.Errorf("exit %d, stderr %q", code, run.errs.String())
	}
}
