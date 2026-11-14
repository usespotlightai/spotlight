package v1

import "encoding/json"

const Version = 1

const Protocol = "acp/1"

type Capabilities struct {
	Fs        FsCapabilities `json:"fs"`
	Subagents struct{}       `json:"subagents"`
}

type FsCapabilities struct {
	ReadTextFile  bool `json:"readTextFile"`
	WriteTextFile bool `json:"writeTextFile"`
}

type Result struct {
	StopReason string          `json:"stopReason"`
	Usage      json.RawMessage `json:"usage"`
	Heard      int             `json:"-"`
}
