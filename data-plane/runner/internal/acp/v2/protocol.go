package v2

import "errors"

const (
	Version  = 2
	Protocol = "acp/2"
)

var ErrOlderProtocol = errors.New("the harness does not speak ACP v2")

type Result struct {
	StopReason string
	Error      string
	Heard      int
}
