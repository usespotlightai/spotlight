// Package acp speaks the Agent Client Protocol to a harness the runner starts.
//
// The runner is the client: it opens the session, sends the work, and answers
// what the agent asks for. What comes back is structured, so a run can be read
// and rendered rather than replayed as terminal bytes.
package acp

import "encoding/json"

const Version = 1

// Capabilities are what this client can do for the agent. Only what is
// answered here is offered: an agent is told about the filesystem, and so
// never asks for a terminal the runner would have to refuse.
type Capabilities struct {
	Fs FsCapabilities `json:"fs"`
}

type FsCapabilities struct {
	ReadTextFile  bool `json:"readTextFile"`
	WriteTextFile bool `json:"writeTextFile"`
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
	Error   *responseError  `json:"error,omitempty"`
}

type responseError struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
}

// Update is one thing that happened during a turn, as the agent reported it.
// Kind names what it was; Raw is kept whole, because the journal should record
// what was said rather than what this runner understood of it.
type Update struct {
	Kind string
	Text string
	Raw  json.RawMessage
}

// Result closes a turn. Usage is what it cost, which nothing else in the
// system has ever been able to say.
type Result struct {
	StopReason string `json:"stopReason"`
	Usage      *Usage `json:"usage,omitempty"`
}

type Usage struct {
	InputTokens       int `json:"inputTokens"`
	OutputTokens      int `json:"outputTokens"`
	CachedReadTokens  int `json:"cachedReadTokens"`
	CachedWriteTokens int `json:"cachedWriteTokens"`
	TotalTokens       int `json:"totalTokens"`
}
