package v2

import (
	"cmp"
	"context"
	"encoding/json"
	"errors"
	"slices"
	"sync"

	"usespotlight.ai/data-plane/protocol"
	"usespotlight.ai/data-plane/runner/internal/acp"
)

const codeUnsupportedVersion = -32022

type Client struct {
	conn *acp.Conn

	mu         sync.Mutex
	answer     acp.Permission
	watching   func(protocol.Event)
	work       *acp.WorkState
	sessionID  string
	turns      int
	turn       *turn
	prompted   *prompt
	shown      protocol.SessionStateName
	background []protocol.BackgroundTask
	asking     map[string]context.CancelFunc

	translating sync.Mutex
	translator  *translator

	root    string
	meta    json.RawMessage
	servers []acp.McpServer

	life context.Context
	end  context.CancelFunc
}

type turn struct {
	number int
	heard  int
}

type prompt struct {
	turn  *turn
	ended chan Result
}

func Start(ctx context.Context, opts acp.Options) (*Client, error) {
	life, end := context.WithCancel(ctx)

	answer := opts.Answer
	if answer == nil {
		answer = acp.RejectAll
	}

	client := &Client{
		answer:     answer,
		work:       acp.NewWorkState(cmp.Or(opts.SettleQuiet, acp.SettleQuiet)),
		asking:     map[string]context.CancelFunc{},
		translator: newTranslator(),
		root:       opts.Root,
		meta:       opts.Session,
		servers:    opts.McpServers,
		life:       life,
		end:        end,
	}

	conn, err := acp.Dial(ctx, opts.Process(), acp.Handler{
		Read:      client.framed,
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

	err := c.conn.Call(ctx, "initialize", map[string]any{
		"protocolVersion": Version,
		"info":            map[string]any{"name": "spotlight", "version": "1"},
		"capabilities":    map[string]any{},
	}, &out)

	var failed *acp.Failure
	switch {
	case errors.As(err, &failed) && failed.Code == codeUnsupportedVersion:
		return ErrOlderProtocol
	case err != nil:
		return err
	case out.ProtocolVersion != Version:
		return ErrOlderProtocol
	default:
		return nil
	}
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
	if err := c.conn.Call(ctx, "session/resume", c.opening(map[string]any{
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
	return protocol.HarnessReports{Background: true, SelfStartedTurns: true, TurnUsage: true, CommandOutput: true}
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
		"type":      "id",
		"value":     value,
	}, nil)
}

func (c *Client) opening(params map[string]any) map[string]any {
	params["mcpServers"] = stdioServers(c.servers)
	if acp.Present(c.meta) {
		params["_meta"] = c.meta
	}
	return params
}

type stdioServer struct {
	Type string `json:"type"`
	acp.McpServer
}

func stdioServers(servers []acp.McpServer) []stdioServer {
	listed := make([]stdioServer, 0, len(servers))
	for _, server := range servers {
		if server.Args == nil {
			server.Args = []string{}
		}
		if server.Env == nil {
			server.Env = []acp.EnvVariable{}
		}
		listed = append(listed, stdioServer{Type: "stdio", McpServer: server})
	}
	return listed
}

func (c *Client) Prompt(ctx context.Context, text string) (Result, error) {
	c.work.Touch()

	waiting := &prompt{ended: make(chan Result, 1)}
	c.mu.Lock()
	c.prompted = waiting
	sessionID := c.sessionID
	c.mu.Unlock()

	defer func() {
		c.mu.Lock()
		if c.prompted == waiting {
			c.prompted = nil
		}
		c.mu.Unlock()
	}()

	err := c.conn.Call(ctx, "session/prompt", map[string]any{
		"sessionId": sessionID,
		"prompt":    []any{map[string]any{"type": "text", "text": text}},
	}, nil)
	if err != nil {
		c.promptFailed(waiting, err)
		return Result{Error: err.Error()}, err
	}

	select {
	case <-ctx.Done():
		return Result{}, ctx.Err()
	case <-c.conn.Done():
		err := errors.New("session/prompt: the harness stopped before the turn ended")
		c.promptFailed(waiting, err)
		return Result{Error: err.Error()}, err
	case result := <-waiting.ended:
		return result, nil
	}
}

func (c *Client) promptFailed(waiting *prompt, err error) {
	c.mu.Lock()
	open := c.turn
	owned := open != nil && waiting.turn == open
	if owned {
		c.turn = nil
	}
	c.mu.Unlock()

	if owned {
		c.emit(
			protocol.HarnessEvent(protocol.EventTurnEnded, protocol.TurnEnded{Turn: open.number, Stop: protocol.TurnStopFailed, Error: err.Error()}),
			protocol.HarnessEvent(protocol.EventSessionState, protocol.SessionState{State: protocol.SessionIdle}),
		)
	}
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

func (c *Client) stateChanged(update state) {
	busy := update.State != "idle"
	change := acp.WorkChange{Reported: true, Busy: &busy}

	var events []protocol.Event

	if update.Background != nil {
		c.translating.Lock()
		tasks := c.translator.backgroundOf(*update.Background)
		c.translating.Unlock()

		change.Tasks = &tasks
		c.mu.Lock()
		changed := !slices.Equal(tasks, c.background)
		c.background = tasks
		c.mu.Unlock()
		if changed {
			events = append(events, protocol.HarnessEvent(protocol.EventBackgroundChanged, protocol.BackgroundChanged{Items: tasks}))
		}
	}

	name, stop := stateOf(update)
	if name == "" {
		c.work.Apply(change)
		c.emit(events...)
		return
	}

	c.mu.Lock()
	var started *turn
	origin := protocol.TurnFromSelf
	if busy && c.turn == nil {
		c.turns++
		c.turn = &turn{number: c.turns}
		started = c.turn
		if c.prompted != nil && c.prompted.turn == nil {
			c.prompted.turn = started
			origin = protocol.TurnFromPrompt
		}
	}

	var ended *turn
	var resolve *prompt
	if !busy && c.turn != nil {
		ended, c.turn = c.turn, nil
		if c.prompted != nil && c.prompted.turn == ended {
			resolve, c.prompted = c.prompted, nil
		}
	}

	shown := name != c.shown
	c.shown = name
	c.mu.Unlock()

	if started != nil {
		events = append(events, protocol.HarnessEvent(protocol.EventTurnStarted, protocol.TurnStarted{Turn: started.number, Origin: origin}))
	}

	if ended != nil {
		reason := ""
		if update.StopReason != nil {
			reason = *update.StopReason
		}
		ending := protocol.TurnEnded{Turn: ended.number, Stop: cmp.Or(stop, protocol.TurnStopEnded), Reason: reason, Usage: usageOf(update.Usage)}
		if update.Error != nil {
			ending.Error = update.Error.Message
		}
		events = append(events, protocol.HarnessEvent(protocol.EventTurnEnded, ending))

		if resolve != nil {
			resolve.ended <- Result{StopReason: reason, Error: ending.Error, Heard: ended.heard}
		}
	}

	if shown {
		events = append(events, protocol.HarnessEvent(protocol.EventSessionState, protocol.SessionState{State: name}))
	}

	c.work.Apply(change)
	c.emit(events...)
}

func (c *Client) echoed() {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.prompted != nil && c.prompted.turn == nil {
		c.prompted.turn = c.turn
	}
}

func (c *Client) heard() {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.turn != nil {
		c.turn.heard++
	}
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
