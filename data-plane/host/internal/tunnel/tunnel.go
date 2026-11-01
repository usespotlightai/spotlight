package tunnel

import (
	"context"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"math/rand/v2"
	"net/http"
	"net/url"
	"sync"
	"time"

	"github.com/coder/websocket"
	"github.com/coder/websocket/wsjson"

	"usespotlight.ai/data-plane/control"
	"usespotlight.ai/data-plane/protocol"
)

const (
	retryFloor   = 2 * time.Second
	retryCeiling = 30 * time.Second
	steady       = time.Minute
	pingEvery    = 30 * time.Second
	pingWait     = 10 * time.Second
	dialWait     = 30 * time.Second
	restartWait  = time.Second
	dialBackWait = 200 * time.Millisecond
	dialBacks    = 10
	readLimit    = 1 << 20
)

var errUnknownStream = errors.New("the control plane has no editor that waits for this stream")

type Open func(ctx context.Context, sandboxID string) (io.ReadWriteCloser, error)

type Tunnel struct {
	base       *url.URL
	hostID     string
	credential control.Credential
	log        *slog.Logger

	RetryFloor  time.Duration
	RestartWait time.Duration
	PingEvery   time.Duration
}

func New(baseURL, hostID string, credential control.Credential, log *slog.Logger) (*Tunnel, error) {
	base, err := url.Parse(baseURL)
	if err != nil || base.Scheme == "" || base.Host == "" {
		return nil, fmt.Errorf("control plane url %q is not absolute", baseURL)
	}

	return &Tunnel{base: base, hostID: hostID, credential: credential, log: log}, nil
}

func (t *Tunnel) Serve(ctx context.Context, open func(ctx context.Context, sandboxID string) (io.ReadWriteCloser, error)) {
	floor := t.RetryFloor
	if floor <= 0 {
		floor = retryFloor
	}
	backoff := floor

	var streams sync.WaitGroup
	defer streams.Wait()

	for {
		connected := time.Now()
		err := t.connect(ctx, open, &streams)
		if ctx.Err() != nil {
			return
		}

		if websocket.CloseStatus(err) == websocket.StatusGoingAway {
			wait := t.RestartWait
			if wait <= 0 {
				wait = restartWait
			}
			t.log.Info("the control plane restarts; the tunnel opens again", "retryIn", wait)
			if !sleep(ctx, jitter(wait)) {
				return
			}
			backoff = floor
			continue
		}

		if time.Since(connected) > steady {
			backoff = floor
		}
		t.log.Warn("the tunnel to the control plane closed; editors cannot reach sandboxes until it opens again", "error", err, "retryIn", backoff)
		if !sleep(ctx, jitter(backoff)) {
			return
		}
		backoff = min(backoff*2, retryCeiling)
	}
}

func (t *Tunnel) connect(ctx context.Context, open Open, streams *sync.WaitGroup) error {
	conn, err := t.dial(ctx, "")
	if err != nil {
		return err
	}
	defer conn.CloseNow()

	connected, disconnect := context.WithCancel(ctx)
	defer disconnect()
	go t.ping(connected, conn, disconnect)

	t.log.Info("opened the tunnel for editors")
	for {
		var asked protocol.TunnelStream
		if err := wsjson.Read(connected, conn, &asked); err != nil {
			return err
		}
		if asked.Stream == "" || asked.SandboxID == "" {
			continue
		}

		streams.Go(func() { t.stream(ctx, asked, open) })
	}
}

func (t *Tunnel) ping(ctx context.Context, conn *websocket.Conn, disconnect context.CancelFunc) {
	every := t.PingEvery
	if every <= 0 {
		every = pingEvery
	}
	ticker := time.NewTicker(every)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
		}

		waiting, cancel := context.WithTimeout(ctx, pingWait)
		err := conn.Ping(waiting)
		cancel()
		if err != nil {
			disconnect()
			return
		}
	}
}

func (t *Tunnel) stream(ctx context.Context, asked protocol.TunnelStream, open Open) {
	log := t.log.With("sandboxId", asked.SandboxID, "stream", asked.Stream)

	streaming, stop := context.WithCancel(ctx)
	defer stop()

	conn, err := t.dialBack(streaming, asked.Stream)
	if err != nil {
		log.Warn("could not join an editor stream", "error", err)
		return
	}
	defer conn.CloseNow()

	ssh, opened := open(streaming, asked.SandboxID)
	if opened == nil {
		defer ssh.Close()
	}
	if opened != nil {
		log.Warn("could not open SSH in the sandbox for an editor", "error", opened)
		_ = conn.Close(protocol.TunnelNoSandbox, "The sandbox does not run on this host.")
		return
	}

	log.Info("an editor connected to the sandbox")
	piped := websocket.NetConn(streaming, conn, websocket.MessageBinary)

	var done sync.WaitGroup
	done.Go(func() {
		_, _ = io.Copy(piped, ssh)
		stop()
	})
	done.Go(func() {
		_, _ = io.Copy(ssh, piped)
		stop()
	})
	<-streaming.Done()
	_ = ssh.Close()
	_ = piped.Close()
	done.Wait()
	log.Info("an editor left the sandbox")
}

func (t *Tunnel) dialBack(ctx context.Context, stream string) (*websocket.Conn, error) {
	for tries := 1; ; tries++ {
		conn, err := t.dial(ctx, stream)
		if !errors.Is(err, errUnknownStream) || tries == dialBacks || !sleep(ctx, dialBackWait) {
			return conn, err
		}
	}
}

func (t *Tunnel) dial(ctx context.Context, stream string) (*websocket.Conn, error) {
	path := "api/hosts/" + url.PathEscape(t.hostID) + "/tunnel"
	if stream != "" {
		path += "/" + url.PathEscape(stream)
	}
	target := t.base.JoinPath(path)

	request, err := http.NewRequestWithContext(ctx, http.MethodGet, target.String(), nil)
	if err != nil {
		return nil, err
	}
	if err := t.credential.Authorize(request); err != nil {
		return nil, err
	}

	dialing, cancel := context.WithTimeout(ctx, dialWait)
	defer cancel()
	conn, response, err := websocket.Dial(dialing, target.String(), &websocket.DialOptions{HTTPHeader: request.Header})
	if err != nil {
		if response != nil && response.StatusCode == http.StatusUnauthorized {
			return nil, fmt.Errorf("%w: %w", control.ErrUnauthorized, err)
		}
		if stream != "" && response != nil && response.StatusCode == http.StatusNotFound {
			return nil, fmt.Errorf("%w: %w", errUnknownStream, err)
		}
		return nil, err
	}
	conn.SetReadLimit(readLimit)

	return conn, nil
}

func jitter(d time.Duration) time.Duration {
	return d/2 + time.Duration(rand.Int64N(int64(d)))
}

func sleep(ctx context.Context, d time.Duration) bool {
	timer := time.NewTimer(d)
	defer timer.Stop()

	select {
	case <-timer.C:
		return true
	case <-ctx.Done():
		return false
	}
}
