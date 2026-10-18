package protocol

const (
	HostCallClaimPath    = "/api/hosts/calls/claim"
	HostCallResponsePath = "/api/hosts/calls/{id}/response"

	EgressSendPath  = "/run/spotlight/egress/response.json"
	MaxResponseBody = 16 << 10
)

type HostCall struct {
	ID        string            `json:"id"`
	Method    string            `json:"method"`
	URL       string            `json:"url"`
	Headers   map[string]string `json:"headers"`
	Body      string            `json:"body"`
	TimeoutMs int               `json:"timeoutMs"`
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
