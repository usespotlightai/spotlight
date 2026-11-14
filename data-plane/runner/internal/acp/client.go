package acp

import (
	"cmp"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"os/exec"
	"sync"
	"syscall"
	"time"

	"usespotlight.ai/data-plane/protocol"
	"usespotlight.ai/data-plane/runner/internal/account"
)

type Client struct {
	command *exec.Cmd
	stdin   io.WriteCloser

	mu      sync.Mutex
	nextID  int
	waiting map[int]chan response

	answer    Permission
	watching  func(protocol.Event)
	replaying bool
	work      *workState
	turns     int
	heard     int
	prompts   map[int]int

	translating sync.Mutex
	translator  *translator

	root    string
	meta    json.RawMessage
	servers []McpServer

	life context.Context
	end  context.CancelFunc

	closeOnce sync.Once
	done      chan struct{}
}

type Asked struct {
	SessionID  string
	ToolCallID string
	Kind       string
	Title      string
	Input      json.RawMessage
}

type McpServer struct {
	Name    string        `json:"name"`
	Command string        `json:"command"`
	Args    []string      `json:"args"`
	Env     []EnvVariable `json:"env"`
}

func (s McpServer) MarshalJSON() ([]byte, error) {
	type plain McpServer
	if s.Args == nil {
		s.Args = []string{}
	}
	if s.Env == nil {
		s.Env = []EnvVariable{}
	}
	return json.Marshal(plain(s))
}

type EnvVariable struct {
	Name  string `json:"name"`
	Value string `json:"value"`
}

type Verdict int

const (
	Reject Verdict = iota
	Allow
	Cancel
)

type Permission func(ctx context.Context, asked Asked) Verdict

type Options struct {
	Executable  string
	Args        []string
	Env         map[string]string
	Root        string
	RunAs       *account.User
	Answer      Permission
	Session     json.RawMessage
	McpServers  []McpServer
	SettleQuiet time.Duration
}

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
		answer = func(context.Context, Asked) Verdict { return Reject }
	}

	life, end := context.WithCancel(ctx)

	client := &Client{
		command:    command,
		stdin:      stdin,
		waiting:    map[int]chan response{},
		prompts:    map[int]int{},
		answer:     answer,
		root:       opts.Root,
		meta:       opts.Session,
		servers:    opts.McpServers,
		life:       life,
		end:        end,
		done:       make(chan struct{}),
		work:       newWorkState(cmp.Or(opts.SettleQuiet, settleQuiet)),
		translator: newTranslator(),
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

func (c *Client) NewSession(ctx context.Context) (string, error) {
	var out struct {
		SessionID string `json:"sessionId"`
	}

	if err := c.call(ctx, "session/new", c.opening(map[string]any{
		"cwd": c.root,
	}), &out); err != nil {
		return "", err
	}

	c.opened(out.SessionID)
	return out.SessionID, nil
}

func (c *Client) Resume(ctx context.Context, sessionID string) error {
	c.mu.Lock()
	c.replaying = true
	c.mu.Unlock()

	defer func() {
		c.mu.Lock()
		c.replaying = false
		c.mu.Unlock()
	}()

	if err := c.call(ctx, "session/load", c.opening(map[string]any{
		"sessionId": sessionID,
		"cwd":       c.root,
	}), nil); err != nil {
		return err
	}

	c.opened(sessionID)
	return nil
}

func (c *Client) opened(sessionID string) {
	c.translating.Lock()
	defer c.translating.Unlock()
	c.translator.opened(sessionID)
}

func (c *Client) Protocol() string {
	return Protocol
}

func (c *Client) Reports() protocol.HarnessReports {
	return protocol.HarnessReports{TurnUsage: true}
}

func (c *Client) Watch(saw func(protocol.Event)) {
	c.mu.Lock()
	c.watching = saw
	c.mu.Unlock()
}

func (c *Client) Settle(ctx context.Context) (Work, bool) {
	return c.work.settle(ctx, c.done)
}

func (c *Client) Current() Work {
	return c.work.now()
}

func (c *Client) SetConfigOption(ctx context.Context, sessionID, id, value string) error {
	return c.call(ctx, "session/set_config_option", map[string]any{
		"sessionId": sessionID,
		"configId":  id,
		"value":     value,
	}, nil)
}

func (c *Client) opening(params map[string]any) map[string]any {
	servers := c.servers
	if servers == nil {
		servers = []McpServer{}
	}
	params["mcpServers"] = servers

	if len(c.meta) > 0 && string(c.meta) != "null" {
		params["_meta"] = c.meta
	}

	return params
}

func (c *Client) Prompt(ctx context.Context, sessionID string, text string) (Result, error) {
	c.work.touch()

	c.mu.Lock()
	c.turns++
	turn := c.turns
	c.heard = 0
	c.mu.Unlock()
	promptID := 0

	c.translating.Lock()
	c.translator.turned()
	c.translating.Unlock()

	c.emit(
		protocol.HarnessEvent(protocol.EventTurnStarted, protocol.TurnStarted{Turn: turn, Origin: protocol.TurnFromPrompt}),
		protocol.HarnessEvent(protocol.EventSessionState, protocol.SessionState{State: protocol.SessionRunning}),
	)

	var out Result
	err := c.request(ctx, "session/prompt", map[string]any{
		"sessionId": sessionID,
		"prompt":    []any{map[string]any{"type": "text", "text": text}},
	}, &out, func(id int) {
		promptID = id
		c.prompts[id] = turn
	})

	c.mu.Lock()
	out.Heard = c.heard
	_, unanswered := c.prompts[promptID]
	delete(c.prompts, promptID)
	c.mu.Unlock()

	if unanswered {
		c.turnEnded(protocol.TurnEnded{Turn: turn, Stop: protocol.TurnStopFailed, Error: err.Error()})
	}

	return out, err
}

func (c *Client) turnEnded(ended protocol.TurnEnded) {
	c.emit(
		protocol.HarnessEvent(protocol.EventTurnEnded, ended),
		protocol.HarnessEvent(protocol.EventSessionState, protocol.SessionState{State: protocol.SessionIdle}),
	)
}

func (c *Client) promptAnswered(turn int, result json.RawMessage, failed *responseError) {
	if failed != nil {
		c.turnEnded(protocol.TurnEnded{Turn: turn, Stop: protocol.TurnStopFailed, Error: failed.Message})
		return
	}

	var out Result
	_ = json.Unmarshal(result, &out)
	c.turnEnded(protocol.TurnEnded{
		Turn: turn, Stop: StopOf(out.StopReason), Reason: out.StopReason, Usage: usageOf(out.Usage),
	})
}

func (c *Client) emit(events ...protocol.Event) {
	c.mu.Lock()
	watching := c.watching
	c.mu.Unlock()

	if watching == nil {
		return
	}
	for _, event := range events {
		watching(event)
	}
}

func usageOf(raw json.RawMessage) *protocol.TurnUsage {
	var usage struct {
		InputTokens       *int `json:"inputTokens"`
		OutputTokens      *int `json:"outputTokens"`
		CachedReadTokens  *int `json:"cachedReadTokens"`
		CachedWriteTokens *int `json:"cachedWriteTokens"`
	}
	if !present(raw) || json.Unmarshal(raw, &usage) != nil {
		return nil
	}
	return &protocol.TurnUsage{
		Input: usage.InputTokens, Output: usage.OutputTokens,
		CacheRead: usage.CachedReadTokens, CacheWrite: usage.CachedWriteTokens,
	}
}

func (c *Client) Cancel(sessionID string) error {
	return c.notify("session/cancel", map[string]any{"sessionId": sessionID})
}

func (c *Client) notify(method string, params any) error {
	encoded, err := json.Marshal(params)
	if err != nil {
		return err
	}

	return c.write(request{JSONRPC: "2.0", Method: method, Params: encoded})
}

func (c *Client) Close() error {
	c.closeOnce.Do(func() {
		c.end()
		_ = c.stdin.Close()
		if c.command.Process != nil {
			_ = syscall.Kill(-c.command.Process.Pid, syscall.SIGTERM)
		}
		close(c.done)
	})

	return nil
}

func (c *Client) call(ctx context.Context, method string, params any, out any) error {
	return c.request(ctx, method, params, out, nil)
}

func (c *Client) request(ctx context.Context, method string, params any, out any, sent func(id int)) error {
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
