package acp

import (
	"context"
	"encoding/json"
	"strings"
	"time"

	"usespotlight.ai/data-plane/runner/internal/account"
)

type Asked struct {
	SessionID  string
	ToolCallID string
	Kind       string
	Title      string
	Input      json.RawMessage
}

type Verdict int

const (
	Reject Verdict = iota
	Allow
	Cancel
)

type Permission func(ctx context.Context, asked Asked) Verdict

func RejectAll(context.Context, Asked) Verdict { return Reject }

type McpServer struct {
	Name    string        `json:"name"`
	Command string        `json:"command"`
	Args    []string      `json:"args"`
	Env     []EnvVariable `json:"env"`
}

type EnvVariable struct {
	Name  string `json:"name"`
	Value string `json:"value"`
}

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

type Option struct {
	OptionID string `json:"optionId"`
	Kind     string `json:"kind"`
}

func (o Options) Process() Process {
	return Process{Executable: o.Executable, Args: o.Args, Env: o.Env, Root: o.Root, RunAs: o.RunAs}
}

func Pick(options []Option, kind string) string {
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

func Present(raw json.RawMessage) bool {
	return len(raw) > 0 && string(raw) != "null"
}
