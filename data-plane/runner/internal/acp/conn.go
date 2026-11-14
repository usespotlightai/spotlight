package acp

import (
	"bufio"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"os/exec"
	"strconv"
	"sync"
	"syscall"

	"usespotlight.ai/data-plane/protocol"
	"usespotlight.ai/data-plane/runner/internal/account"
)

type Process struct {
	Executable string
	Args       []string
	Env        map[string]string
	Root       string
	RunAs      *account.User
}

type Handler struct {
	Read      func(line []byte, method string)
	Answered  func(id int, result json.RawMessage, failed *ResponseError)
	Requested func(id json.RawMessage, method string, params json.RawMessage)
	Notified  func(method string, params json.RawMessage)
}

type ResponseError struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
}

type request struct {
	JSONRPC string           `json:"jsonrpc"`
	ID      *json.RawMessage `json:"id,omitempty"`
	Method  string           `json:"method"`
	Params  json.RawMessage  `json:"params,omitempty"`
}

type response struct {
	JSONRPC string          `json:"jsonrpc"`
	ID      json.RawMessage `json:"id"`
	Result  any             `json:"result,omitempty"`
	Error   *ResponseError  `json:"error,omitempty"`
}

type Conn struct {
	command *exec.Cmd
	stdin   io.WriteCloser
	handler Handler

	writing sync.Mutex
	mu      sync.Mutex
	nextID  int
	waiting map[int]chan response

	closeOnce sync.Once
	done      chan struct{}
}

func Dial(ctx context.Context, process Process, handler Handler) (*Conn, error) {
	command := exec.CommandContext(ctx, process.Executable, process.Args...)
	command.Dir = process.Root
	command.Env = account.Environment(process.Env, process.RunAs)
	command.SysProcAttr = process.RunAs.SysProcAttr()

	stdin, err := command.StdinPipe()
	if err != nil {
		return nil, err
	}
	stdout, err := command.StdoutPipe()
	if err != nil {
		return nil, err
	}

	if err := command.Start(); err != nil {
		return nil, fmt.Errorf("start the harness: %w", err)
	}

	conn := &Conn{
		command: command,
		stdin:   stdin,
		handler: handler,
		waiting: map[int]chan response{},
		done:    make(chan struct{}),
	}
	go conn.read(stdout)

	return conn, nil
}

func (c *Conn) Done() <-chan struct{} {
	return c.done
}

func (c *Conn) Call(ctx context.Context, method string, params any, out any) error {
	return c.Request(ctx, method, params, out, nil)
}

func (c *Conn) Request(ctx context.Context, method string, params any, out any, sent func(id int)) error {
	encoded, err := json.Marshal(params)
	if err != nil {
		return err
	}

	c.mu.Lock()
	c.nextID++
	id := c.nextID
	answered := make(chan response, 1)
	c.waiting[id] = answered
	if sent != nil {
		sent(id)
	}
	c.mu.Unlock()

	defer func() {
		c.mu.Lock()
		delete(c.waiting, id)
		c.mu.Unlock()
	}()

	raw := json.RawMessage(strconv.Itoa(id))
	if err := c.write(request{JSONRPC: "2.0", ID: &raw, Method: method, Params: encoded}); err != nil {
		return err
	}

	select {
	case <-ctx.Done():
		return ctx.Err()
	case <-c.done:
		return fmt.Errorf("%s: the harness stopped answering", method)
	case reply := <-answered:
		if reply.Error != nil {
			return &Failure{Method: method, Code: reply.Error.Code, Message: reply.Error.Message}
		}
		if out == nil {
			return nil
		}
		return json.Unmarshal(rawOf(reply.Result), out)
	}
}

func (c *Conn) Notify(method string, params any) error {
	encoded, err := json.Marshal(params)
	if err != nil {
		return err
	}
	return c.write(request{JSONRPC: "2.0", Method: method, Params: encoded})
}

func (c *Conn) Reply(id json.RawMessage, result any) {
	_ = c.write(response{JSONRPC: "2.0", ID: id, Result: result})
}

func (c *Conn) Reject(id json.RawMessage, because string) {
	_ = c.write(response{JSONRPC: "2.0", ID: id, Error: &ResponseError{Code: -32601, Message: because}})
}

func (c *Conn) Close() error {
	c.closeOnce.Do(func() {
		_ = c.stdin.Close()
		if c.command.Process != nil {
			_ = syscall.Kill(-c.command.Process.Pid, syscall.SIGTERM)
		}
		close(c.done)
	})
	return nil
}

func (c *Conn) write(message any) error {
	encoded, err := json.Marshal(message)
	if err != nil {
		return err
	}

	c.writing.Lock()
	defer c.writing.Unlock()

	_, err = c.stdin.Write(append(encoded, '\n'))
	return err
}

func (c *Conn) read(stdout io.Reader) {
	lines := bufio.NewScanner(stdout)
	lines.Buffer(make([]byte, 0, 64*1024), 8*1024*1024)

	for lines.Scan() {
		line := lines.Bytes()
		if len(line) == 0 {
			continue
		}

		var message struct {
			ID     json.RawMessage `json:"id"`
			Method string          `json:"method"`
			Params json.RawMessage `json:"params"`
			Result json.RawMessage `json:"result"`
			Error  *ResponseError  `json:"error"`
		}
		if err := json.Unmarshal(line, &message); err != nil {
			continue
		}

		if c.handler.Read != nil {
			c.handler.Read(line, message.Method)
		}

		switch {
		case message.Method == "" && len(message.ID) > 0:
			c.answered(message.ID, message.Result, message.Error)
		case len(message.ID) > 0:
			if c.handler.Requested != nil {
				c.handler.Requested(message.ID, message.Method, message.Params)
			} else {
				c.Reject(message.ID, "this client does not do that")
			}
		case c.handler.Notified != nil:
			c.handler.Notified(message.Method, message.Params)
		}
	}

	_ = c.Close()
}

func (c *Conn) answered(id json.RawMessage, result json.RawMessage, failed *ResponseError) {
	at, err := strconv.Atoi(string(id))
	if err != nil {
		return
	}

	if c.handler.Answered != nil {
		c.handler.Answered(at, result, failed)
	}

	c.mu.Lock()
	waiting := c.waiting[at]
	c.mu.Unlock()

	if waiting != nil {
		waiting <- response{ID: id, Result: result, Error: failed}
	}
}

func rawOf(result any) json.RawMessage {
	if raw, ok := result.(json.RawMessage); ok {
		return raw
	}
	return json.RawMessage("null")
}

func Frame(name string, line []byte) protocol.Event {
	return protocol.HarnessEvent(protocol.EventHarnessFrame, protocol.HarnessFrame{
		Protocol: name,
		Data:     append(json.RawMessage(nil), line...),
	})
}
