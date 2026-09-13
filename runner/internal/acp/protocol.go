package acp

import "encoding/json"

const Version = 1

// Offer only what is answered, so the agent never asks for a terminal.
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

type Update struct {
	Kind string
	Text string
	Raw  json.RawMessage
}

type Result struct {
	StopReason string `json:"stopReason"`
}
