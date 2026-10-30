package ssh

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/coder/websocket"

	"usespotlight.ai/data-plane/credentials"
	"usespotlight.ai/data-plane/protocol"
)

const (
	connectPath  = protocol.EditorConnectPath
	clientHeader = "Spotlight-Client"
	dialWait     = time.Minute
	closeWait    = 5 * time.Second
	readLimit    = 16 << 20
	chunk        = 32 << 10
)

func (c cli) proxy(ctx context.Context, args []string) error {
	address, positional, err := c.parse(proxyHelp, args, nil)
	if err != nil {
		return err
	}
	if len(positional) != 1 {
		return fmt.Errorf("%s", proxyHelp.Synopsis())
	}

	alias, err := ParseAlias(positional[0])
	if err != nil {
		return err
	}

	token, err := credentials.Stored(c.env, address)
	if err != nil {
		return err
	}
	if token == "" {
		return notSignedIn(address)
	}

	target, err := alias.connectURL(address)
	if err != nil {
		return err
	}

	header := http.Header{}
	header.Set("Authorization", "Bearer "+token)
	header.Set(clientHeader, "cli/"+c.version)

	dialing, cancel := context.WithTimeout(ctx, dialWait)
	defer cancel()
	conn, response, err := websocket.Dial(dialing, target, &websocket.DialOptions{HTTPHeader: header})
	if err != nil {
		if ctx.Err() != nil {
			return errStopped
		}
		return refused(address, alias, response, err)
	}
	defer conn.CloseNow()
	conn.SetReadLimit(readLimit)

	return c.pipe(ctx, conn, address)
}

func (c cli) pipe(ctx context.Context, conn *websocket.Conn, address string) error {
	piping, stop := context.WithCancel(ctx)
	defer stop()

	sent := make(chan error, 1)
	go func() {
		buffer := make([]byte, chunk)
		for {
			n, err := c.in.Read(buffer)
			if n > 0 {
				if err := conn.Write(piping, websocket.MessageBinary, buffer[:n]); err != nil {
					sent <- err
					return
				}
			}
			if err != nil {
				sent <- err
				return
			}
		}
	}()

	received := make(chan error, 1)
	answered := make(chan struct{})
	go func() {
		first := true
		for {
			_, reader, err := conn.Reader(piping)
			if err != nil {
				received <- err
				return
			}
			if first {
				close(answered)
				first = false
			}
			if _, err := io.Copy(c.out, reader); err != nil {
				received <- nil
				return
			}
		}
	}()

	var hint <-chan time.Time
	if c.waitHint > 0 {
		timer := time.NewTimer(c.waitHint)
		defer timer.Stop()
		hint = timer.C
	}

	for {
		select {
		case <-hint:
			fmt.Fprintln(c.errs, "Starting the sandbox. This can take some minutes.")
			hint = nil
		case <-answered:
			hint, answered = nil, nil
		case err := <-received:
			if ctx.Err() != nil {
				return errStopped
			}
			return closed(address, err)
		case err := <-sent:
			if errors.Is(err, io.EOF) {
				_ = conn.Close(websocket.StatusNormalClosure, "")
				return nil
			}
			select {
			case err := <-received:
				return closed(address, err)
			case <-time.After(closeWait):
				return fmt.Errorf("Sorry, the connection to Spotlight at %s broke: %w", address, err)
			}
		case <-ctx.Done():
			return errStopped
		}
	}
}

func notSignedIn(address string) error {
	return fmt.Errorf("Sorry, you are not signed in to %s. Run: %s", address, loginCommand(address))
}

func refused(address string, alias Alias, response *http.Response, err error) error {
	if response == nil {
		return fmt.Errorf("Sorry, Spotlight at %s cannot be reached: %w", address, err)
	}

	switch response.StatusCode {
	case http.StatusBadRequest:
		return fmt.Errorf("Sorry, Spotlight at %s did not find one task or chat in %s", address, alias)
	case http.StatusUnauthorized:
		return fmt.Errorf("Sorry, your login for %s expired. Run: %s", address, loginCommand(address))
	case http.StatusForbidden:
		return fmt.Errorf("Sorry, Spotlight at %s refused the connection: %s", address, said(response))
	case http.StatusNotFound:
		return fmt.Errorf("Sorry, there is no %s %s in workspace %s that you may open", alias.Kind, alias.ID, alias.Workspace)
	case http.StatusServiceUnavailable:
		return errors.New("Sorry, the sandbox could not be opened. Please try again")
	default:
		return fmt.Errorf("Sorry, Spotlight at %s answered %d: %s", address, response.StatusCode, said(response))
	}
}

func said(response *http.Response) string {
	if response.Body == nil {
		return http.StatusText(response.StatusCode)
	}

	body, _ := io.ReadAll(response.Body)
	if text := strings.TrimSpace(string(body)); text != "" {
		return text
	}

	return http.StatusText(response.StatusCode)
}

func closed(address string, err error) error {
	if err == nil {
		return nil
	}

	switch websocket.CloseStatus(err) {
	case websocket.StatusNormalClosure:
		return nil
	case protocol.EditorStartTimedOut:
		return errors.New("Sorry, the sandbox did not start in 10 minutes. Please try again")
	case protocol.EditorSandboxStopped:
		return errors.New("The sandbox stopped. Connect again to start it")
	case protocol.EditorHostOffline:
		return errors.New("Sorry, the host of the sandbox is not connected to Spotlight. Please try again")
	case websocket.StatusGoingAway:
		return fmt.Errorf("Spotlight at %s restarted. Connect again", address)
	case websocket.StatusInternalError:
		return errors.New("Sorry, the connection to the sandbox failed. Please try again")
	case -1:
		return fmt.Errorf("Sorry, the connection to Spotlight at %s broke: %w", address, err)
	default:
		return fmt.Errorf("Sorry, Spotlight at %s closed the connection: %w", address, err)
	}
}
