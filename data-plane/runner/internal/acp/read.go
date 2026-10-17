package acp

import (
	"bufio"
	"cmp"
	"encoding/json"
	"io"
	"os"
	"path/filepath"
	"strings"
)

func (c *Client) read(stdout io.Reader) {
	lines := bufio.NewScanner(stdout)
	lines.Buffer(make([]byte, 0, 64*1024), 8*1024*1024)

	for lines.Scan() {
		line := lines.Bytes()
		if len(line) == 0 {
			continue
		}

		var spoke struct {
			ID     json.RawMessage `json:"id"`
			Method string          `json:"method"`
			Params json.RawMessage `json:"params"`
			Result json.RawMessage `json:"result"`
			Error  *responseError  `json:"error"`
		}
		if err := json.Unmarshal(line, &spoke); err != nil {
			continue
		}

		switch {
		case spoke.Method == "" && len(spoke.ID) > 0:
			c.answered(spoke.ID, spoke.Result, spoke.Error)
		case len(spoke.ID) > 0:
			c.asked(spoke.ID, spoke.Method, spoke.Params)
		default:
			c.told(spoke.Method, spoke.Params)
		}
	}

	_ = c.Close()
}

func (c *Client) answered(id json.RawMessage, result json.RawMessage, failed *responseError) {
	at, ok := idOf(id)
	if !ok {
		return
	}

	c.mu.Lock()
	waiting := c.waiting[at]
	c.mu.Unlock()

	if waiting != nil {
		waiting <- response{ID: id, Result: result, Error: failed}
	}
}

func (c *Client) told(method string, params json.RawMessage) {
	if method != "session/update" {
		return
	}

	var said struct {
		Update struct {
			SessionUpdate string `json:"sessionUpdate"`
			Content       struct {
				Text string `json:"text"`
			} `json:"content"`
		} `json:"update"`
	}
	_ = json.Unmarshal(params, &said)

	c.mu.Lock()
	watching := c.watching
	c.mu.Unlock()

	if watching == nil {
		return
	}

	watching(Update{
		Kind: said.Update.SessionUpdate,
		Text: said.Update.Content.Text,
		Raw:  params,
	})
}

func (c *Client) asked(id json.RawMessage, method string, params json.RawMessage) {
	switch method {
	case "session/request_permission":
		go c.permit(id, params)
	case "fs/read_text_file":
		c.readFile(id, params)
	case "fs/write_text_file":
		c.writeFile(id, params)
	default:
		c.reject(id, "this client does not do that")
	}
}

type option struct {
	OptionID string `json:"optionId"`
	Kind     string `json:"kind"`
}

func (c *Client) permit(id json.RawMessage, params json.RawMessage) {
	var asked struct {
		SessionID string `json:"sessionId"`
		ToolCall  struct {
			ToolCallID string          `json:"toolCallId"`
			Kind       string          `json:"kind"`
			Title      string          `json:"title"`
			RawInput   json.RawMessage `json:"rawInput"`
		} `json:"toolCall"`
		Options []option `json:"options"`
	}
	_ = json.Unmarshal(params, &asked)

	input := asked.ToolCall.RawInput
	if string(input) == "null" {
		input = nil
	}

	verdict := c.answer(c.life, Asked{
		SessionID:  asked.SessionID,
		ToolCallID: asked.ToolCall.ToolCallID,
		Kind:       asked.ToolCall.Kind,
		Title:      asked.ToolCall.Title,
		Input:      input,
	})

	if verdict == Cancel {
		_ = c.Cancel(asked.SessionID)
		c.reply(id, map[string]any{"outcome": map[string]any{"outcome": "cancelled"}})
		return
	}

	chosen := pick(asked.Options, "reject")
	if verdict == Allow {
		chosen = cmp.Or(pick(asked.Options, "allow"), chosen)
	}

	if chosen == "" {
		c.reject(id, "no option this client could choose")
		return
	}

	c.reply(id, map[string]any{
		"outcome": map[string]any{"outcome": "selected", "optionId": chosen},
	})
}

func pick(options []option, kind string) string {
	fallback := ""
	for _, each := range options {
		if each.Kind == kind+"_once" {
			return each.OptionID
		}
		if fallback == "" && strings.HasPrefix(each.Kind, kind+"_") {
			fallback = each.OptionID
		}
	}
	return fallback
}

func (c *Client) within(path string) (string, bool) {
	full := path
	if !filepath.IsAbs(full) {
		full = filepath.Join(c.root, full)
	}
	full = filepath.Clean(full)

	root := filepath.Clean(c.root)
	if full != root && !strings.HasPrefix(full, root+string(filepath.Separator)) {
		return "", false
	}

	return full, true
}

func (c *Client) readFile(id json.RawMessage, params json.RawMessage) {
	var asked struct {
		Path string `json:"path"`
	}
	_ = json.Unmarshal(params, &asked)

	full, ok := c.within(asked.Path)
	if !ok {
		c.reject(id, "outside the workspace")
		return
	}

	content, err := os.ReadFile(full)
	if err != nil {
		c.reject(id, err.Error())
		return
	}

	c.reply(id, map[string]any{"content": string(content)})
}

func (c *Client) writeFile(id json.RawMessage, params json.RawMessage) {
	var asked struct {
		Path    string `json:"path"`
		Content string `json:"content"`
	}
	_ = json.Unmarshal(params, &asked)

	full, ok := c.within(asked.Path)
	if !ok {
		c.reject(id, "outside the workspace")
		return
	}

	if err := os.MkdirAll(filepath.Dir(full), 0o755); err != nil {
		c.reject(id, err.Error())
		return
	}
	if err := os.WriteFile(full, []byte(asked.Content), 0o644); err != nil {
		c.reject(id, err.Error())
		return
	}

	c.reply(id, map[string]any{})
}

func (c *Client) reply(id json.RawMessage, result any) {
	_ = c.write(response{JSONRPC: "2.0", ID: id, Result: result})
}

func (c *Client) reject(id json.RawMessage, because string) {
	_ = c.write(response{
		JSONRPC: "2.0",
		ID:      id,
		Error:   &responseError{Code: -32601, Message: because},
	})
}
