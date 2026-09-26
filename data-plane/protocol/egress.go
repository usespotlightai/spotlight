package protocol

const (
	EgressHandedPath = "/run/spotlight/egress.json"
	EgressAuthority  = "/run/spotlight/egress/authority.pem"
	EgressPort       = 3128

	SandboxAuthority = "/etc/spotlight/egress/authority.pem"
	SandboxBundle    = "/etc/spotlight/egress/bundle.pem"
)

type EgressHanded struct {
	URL        string          `json:"url"`
	Token      string          `json:"token,omitempty"`
	Credential string          `json:"credential"`
	Allow      []string        `json:"allow,omitempty"`
	Reads      []string        `json:"reads,omitempty"`
	Held       []HeldByTheHost `json:"held,omitempty"`
	Send       *HostCall       `json:"send,omitempty"`
}

type HeldByTheHost struct {
	Name   string `json:"name"`
	Host   string `json:"host"`
	Header string `json:"header"`
	Prefix string `json:"prefix"`
	Value  string `json:"value"`
}

const StandInPrefix = "spotlight-egress:"

type EgressRedeem struct {
	Recipient string `json:"recipient"`
}

type EgressRedemption struct {
	RunID    string           `json:"runId,omitempty"`
	Reaches  []string         `json:"reaches"`
	Secrets  []RedeemedSecret `json:"secrets"`
	Withheld []WithheldSecret `json:"withheld"`
}

type RedeemedSecret struct {
	Secret        string         `json:"secret"`
	Host          string         `json:"host"`
	Header        string         `json:"header"`
	Prefix        string         `json:"prefix"`
	Sealed        string         `json:"sealed,omitempty"`
	ReadInNetwork *ReadInNetwork `json:"readInNetwork,omitempty"`
}

type ReadInNetwork struct {
	Kind     string `json:"kind"`
	SecretID string `json:"secretId"`
	Field    string `json:"field,omitempty"`
}

const ReadFromAWSSecretsManager = "aws-secrets-manager"

type WithheldSecret struct {
	Secret string `json:"secret"`
	Reason string `json:"reason"`
}
