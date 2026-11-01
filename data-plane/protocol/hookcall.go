package protocol

import "log/slog"

const (
	HostCallClaimPath    = "/api/hosts/calls/claim"
	HostCallResponsePath = "/api/hosts/calls/{id}/response"
	HostCallSecretsPath  = "/api/hosts/calls/{id}/secrets"

	EgressSendPath  = "/run/spotlight/egress/response.json"
	MaxResponseBody = 256 << 10
)

type HostCall struct {
	ID           string            `json:"id"`
	Method       string            `json:"method"`
	URL          string            `json:"url"`
	Headers      map[string]string `json:"headers"`
	Body         string            `json:"body"`
	TimeoutMs    int               `json:"timeoutMs"`
	SecretsToken string            `json:"secretsToken,omitempty"`
}

type HostCallClaim struct {
	Host string `json:"host"`
}

type HostCallResponse struct {
	Host    string            `json:"host"`
	Status  int               `json:"status"`
	Headers map[string]string `json:"headers,omitempty"`
	Body    string            `json:"body,omitempty"`
	Ms      int               `json:"ms"`
	Error   string            `json:"error,omitempty"`
}

type HostCallSecretsRequest struct {
	Host      string `json:"host"`
	Token     string `json:"token"`
	Recipient string `json:"recipient"`
}

type CallSecrets struct {
	CallID string `json:"callId"`
	Host   string `json:"host"`
	Token  string `json:"token"`
}

func (c CallSecrets) LogValue() slog.Value {
	return slog.GroupValue(slog.String("call", c.CallID), slog.String("host", c.Host))
}
