package acp

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"os/exec"
	"sync"
	"syscall"

	"usespotlight.ai/runner/internal/account"
)

// Client is a harness the runner has started and is talking to.
type Client struct {
	command *exec.Cmd
	stdin   io.WriteCloser

	mu      sync.Mutex
	nextID  int
	waiting map[int]chan response

	// answer decides what to say when the agent asks permission. A station
	// runs unattended, so something has to answer, and it is the runner.
	answer   Permission
	watching func(Update)

	root string

	closeOnce sync.Once
	done      chan struct{}
	failed    error
}

// Permission answers the agent's request to do something it considers worth
// asking about.
type Permission func(kind string) bool

type Options struct {
	Executable string
	Args       []string
	Env        map[string]string
	// Root is the directory the agent works in. File requests outside it are
	// refused: the agent asked for a workspace, not a machine.
	Root string
	// RunAs is the account to start the harness under. Its credentials are
	// what the harness signs in with, so this is not only about isolation.
	RunAs  *account.User
	Answer Permission
}

// Start spawns the harness and completes the handshake.
func Start(ctx context.Context, opts Options) (*Client, error) {
	command := exec.CommandContext(ctx, opts.Executable, opts.Args...)
	command.Dir = opts.Root
	command.Env = account.Environment(opts.Env, opts.RunAs)
	command.SysProcAttr = opts.RunAs.SysProcAttr()

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

	answer := opts.Answer
	if answer == nil {
		answer = func(string) bool { return false }
	}

	client := &Client{
		command: command,
		stdin:   stdin,
		waiting: map[int]chan response{},
		answer:  answer,
		root:    opts.Root,
		done:    make(chan struct{}),
	}

	go client.read(stdout)

	if err := client.initialize(ctx); err != nil {
		_ = client.Close()
		return nil, err
	}

	return client, nil
}

func (c *Client) initialize(ctx context.Context) error {
	var out struct {
		ProtocolVersion int `json:"protocolVersion"`
	}

	return c.call(ctx, "initialize", map[string]any{
		"protocolVersion": Version,
		"clientCapabilities": Capabilities{
			Fs: FsCapabilities{ReadTextFile: true, WriteTextFile: true},
		},
	}, &out)
}

// NewSession opens a session in the workspace and answers with its id, which
// is what a later run needs to take the same conversation up again.
func (c *Client) NewSession(ctx context.Context) (string, error) {
	var out struct {
		SessionID string `json:"sessionId"`
	}

	if err := c.call(ctx, "session/new", map[string]any{
		"cwd":        c.root,
		"mcpServers": []any{},
	}, &out); err != nil {
		return "", err
	}

	return out.SessionID, nil
}

// Resume takes up a session the harness already holds.
func (c *Client) Resume(ctx context.Context, sessionID string) error {
	return c.call(ctx, "session/load", map[string]any{
		"sessionId":  sessionID,
		"cwd":        c.root,
		"mcpServers": []any{},
	}, nil)
}

// Prompt sends one turn and reports everything the agent says while working.
func (c *Client) Prompt(
	ctx context.Context,
	sessionID string,
	text string,
	saw func(Update),
) (Result, error) {
	c.mu.Lock()
	c.watching = saw
	c.mu.Unlock()

	defer func() {
		c.mu.Lock()
		c.watching = nil
		c.mu.Unlock()
	}()

	var out Result
	err := c.call(ctx, "session/prompt", map[string]any{
		"sessionId": sessionID,
		"prompt":    []any{map[string]any{"type": "text", "text": text}},
	}, &out)

	return out, err
}

func (c *Client) Close() error {
	c.closeOnce.Do(func() {
		_ = c.stdin.Close()
		if c.command.Process != nil {
			_ = syscall.Kill(-c.command.Process.Pid, syscall.SIGTERM)
		}
		close(c.done)
	})

	return nil
}

func (c *Client) call(ctx context.Context, method string, params any, out any) error {
	encoded, err := json.Marshal(params)
	if err != nil {
		return err
	}

	c.mu.Lock()
	c.nextID++
	id := c.nextID
	answered := make(chan response, 1)
	c.waiting[id] = answered
	c.mu.Unlock()

	defer func() {
		c.mu.Lock()
		delete(c.waiting, id)
		c.mu.Unlock()
	}()

	if err := c.write(request{
		JSONRPC: "2.0",
		ID:      rawID(id),
		Method:  method,
		Params:  encoded,
	}); err != nil {
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
		return json.Unmarshal(mustRaw(reply.Result), out)
	}
}
