package v1

import (
	"cmp"
	"context"
	"encoding/json"
	"sync"

	"usespotlight.ai/data-plane/protocol"
	"usespotlight.ai/data-plane/runner/internal/acp"
)

type Client struct {
	conn *acp.Conn

	mu        sync.Mutex
	answer    acp.Permission
	frames    bool
	watching  func(protocol.Event)
	replaying bool
	work      *acp.WorkState
	sessionID string
	turns     int
	heard     int
	prompts   map[int]int

	translating sync.Mutex
	translator  *translator

	root    string
	meta    json.RawMessage
	servers []acp.McpServer

	life context.Context
	end  context.CancelFunc
}

func Start(ctx context.Context, opts acp.Options) (*Client, error) {
	life, end := context.WithCancel(ctx)

	answer := opts.Answer
	if answer == nil {
		answer = acp.RejectAll
	}

	client := &Client{
		answer:     answer,
		frames:     opts.Frames,
		work:       acp.NewWorkState(cmp.Or(opts.SettleQuiet, acp.SettleQuiet)),
		prompts:    map[int]int{},
		translator: newTranslator(),
		root:       opts.Root,
		meta:       opts.Session,
		servers:    opts.McpServers,
		life:       life,
		end:        end,
	}

	conn, err := acp.Dial(ctx, opts.Process(), acp.Handler{
		Read:      client.framed,
		Answered:  client.answered,
		Requested: client.requested,
		Notified:  client.notified,
	})
	if err != nil {
		end()
		return nil, err
	}
	client.conn = conn

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

	return c.conn.Call(ctx, "initialize", map[string]any{
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

	if err := c.conn.Call(ctx, "session/new", c.opening(map[string]any{
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

	if err := c.conn.Call(ctx, "session/load", c.opening(map[string]any{
		"sessionId": sessionID,
		"cwd":       c.root,
	}), nil); err != nil {
		return err
	}

	c.opened(sessionID)
	return nil
}

func (c *Client) opened(sessionID string) {
	c.mu.Lock()
	c.sessionID = sessionID
	c.mu.Unlock()

	c.translating.Lock()
	defer c.translating.Unlock()
	c.translator.opened(sessionID)
}

func (c *Client) session() string {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.sessionID
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

func (c *Client) Settle(ctx context.Context) (acp.Work, bool) {
	return c.work.Settle(ctx, c.conn.Done())
}

func (c *Client) Current() acp.Work {
	return c.work.Now()
}

func (c *Client) SetConfigOption(ctx context.Context, id, value string) error {
	return c.conn.Call(ctx, "session/set_config_option", map[string]any{
		"sessionId": c.session(),
		"configId":  id,
		"value":     value,
	}, nil)
}

func (c *Client) opening(params map[string]any) map[string]any {
	servers := c.servers
	if servers == nil {
		servers = []acp.McpServer{}
	}
	params["mcpServers"] = stdioServers(servers)

	if acp.Present(c.meta) {
		params["_meta"] = c.meta
	}

	return params
}

func stdioServers(servers []acp.McpServer) []acp.McpServer {
	listed := make([]acp.McpServer, 0, len(servers))
	for _, server := range servers {
		if server.Args == nil {
			server.Args = []string{}
		}
		if server.Env == nil {
			server.Env = []acp.EnvVariable{}
		}
		listed = append(listed, server)
	}
	return listed
}

func (c *Client) Prompt(ctx context.Context, text string) (Result, error) {
	c.work.Touch()

	c.mu.Lock()
	c.turns++
	turn := c.turns
	c.heard = 0
	sessionID := c.sessionID
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
	err := c.conn.Request(ctx, "session/prompt", map[string]any{
		"sessionId": sessionID,
		"prompt":    []any{map[string]any{"type": "text", "text": text}},
	}, &out, func(id int) {
		c.mu.Lock()
		defer c.mu.Unlock()
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

func (c *Client) Cancel() error {
	return c.conn.Notify("session/cancel", map[string]any{"sessionId": c.session()})
}

func (c *Client) Close() error {
	c.end()
	if c.conn == nil {
		return nil
	}
	return c.conn.Close()
}

func (c *Client) turnEnded(ended protocol.TurnEnded) {
	c.emit(
		protocol.HarnessEvent(protocol.EventTurnEnded, ended),
		protocol.HarnessEvent(protocol.EventSessionState, protocol.SessionState{State: protocol.SessionIdle}),
	)
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
	if !acp.Present(raw) || json.Unmarshal(raw, &usage) != nil {
		return nil
	}
	return &protocol.TurnUsage{
		Input: usage.InputTokens, Output: usage.OutputTokens,
		CacheRead: usage.CachedReadTokens, CacheWrite: usage.CachedWriteTokens,
	}
}
