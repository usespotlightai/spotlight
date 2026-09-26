package protocol

const (
	HostCallClaimPath  = "/api/hosts/calls/claim"
	HostCallAnswerPath = "/api/hosts/calls/{id}/answer"

	EgressSendPath = "/run/spotlight/egress/answer.json"
	AnswerBodyMost = 16 << 10
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

type HostCallAnswer struct {
	Host    string            `json:"host"`
	Status  int               `json:"status"`
	Headers map[string]string `json:"headers,omitempty"`
	Body    string            `json:"body,omitempty"`
	Ms      int               `json:"ms"`
	Error   string            `json:"error,omitempty"`
}
