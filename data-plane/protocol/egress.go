package protocol

import "time"

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

const (
	CarriedInHeader = "header"
	CarriedInQuery  = "query"
)

type EgressRedeem struct {
	ProxyCredential string `json:"proxyCredential,omitempty"`
	Recipient       string `json:"recipient"`
}

type EgressRedemption struct {
	RunID        string           `json:"runId,omitempty"`
	Reaches      []string         `json:"reaches"`
	Secrets      []RedeemedSecret `json:"secrets"`
	Withheld     []WithheldSecret `json:"withheld"`
	SpotlightAPI *SpotlightAPI    `json:"spotlightApi,omitempty"`
	Bound        []string         `json:"bound,omitempty"`
}

type SpotlightAPI struct {
	Sealed string `json:"sealed"`
}

const SpotlightAPISecret = "spotlight-api"

const SpotlightAPIStandIn = StandInPrefix + SpotlightAPISecret

type RedeemedSecret struct {
	Secret        string         `json:"secret"`
	Host          string         `json:"host"`
	Carrier       string         `json:"carrier"`
	Name          string         `json:"name"`
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

const (
	EgressURLVar        = "SPOTLIGHT_EGRESS_URL"
	EgressCredentialVar = "SPOTLIGHT_EGRESS_CREDENTIAL"
	EgressTrafficVar    = "SPOTLIGHT_EGRESS_TRAFFIC"
	EgressTrafficAll    = "all"
	EgressTrafficBound  = "bound"
	EgressTargetHeader  = "Spotlight-Egress-Target"
	EgressBoundPath     = "/.well-known/spotlight/bound"
	EgressProxyUser     = "sandbox"
)

type EgressAdmit struct {
	ProxyCredential string `json:"proxyCredential"`
}

type EgressAdmitted struct {
	RunnerID         string   `json:"runnerId"`
	WorkspaceID      string   `json:"workspaceId"`
	ControlPlaneHost string   `json:"controlPlaneHost"`
	ControlPlanePort int      `json:"controlPlanePort"`
	Reaches          []string `json:"reaches"`
}

const (
	MaxHoldsAtOnce   = 500
	MaxRecordsAtOnce = 2000
)

type EgressHolds struct {
	ProxyCredentials []string `json:"proxyCredentials"`
}

type EgressHeld struct {
	Held []string `json:"held"`
}

const (
	ConnectionTunnelled = "tunnelled"
	ConnectionForwarded = "forwarded"
	ConnectionBlocked   = "blocked"
	ConnectionFailed    = "failed"
)

const (
	ReasonNotAllowed     = "not-allowed"
	ReasonAddressRefused = "address-refused"
	ReasonNotBound       = "not-bound"
	ReasonNoSuchHost     = "no-such-host"
	ReasonTimedOut       = "timed-out"
	ReasonTLSFailed      = "tls-failed"
	ReasonUnreachable    = "unreachable"
)

type EgressConnection struct {
	ProxyCredential string    `json:"proxyCredential"`
	Host            string    `json:"host"`
	Port            int       `json:"port"`
	BytesOut        int64     `json:"bytesOut"`
	BytesIn         int64     `json:"bytesIn"`
	Ms              int64     `json:"ms"`
	Outcome         string    `json:"outcome"`
	Status          int       `json:"status,omitempty"`
	Reason          string    `json:"reason,omitempty"`
	At              time.Time `json:"at"`
}

type EgressConnections struct {
	Records []EgressConnection `json:"records"`
}

type EgressBound struct {
	Hosts []string `json:"hosts"`
}

type EgressChecked struct {
	Enforced bool `json:"enforced"`
}
