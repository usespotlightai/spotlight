package protocol

import "time"

const (
	EgressConfigPath = "/run/spotlight/egress.json"
	EgressAuthority  = "/run/spotlight/egress/authority.pem"
	EgressPort       = 3128

	SandboxAuthority = "/etc/spotlight/egress/authority.pem"
	SandboxBundle    = "/etc/spotlight/egress/bundle.pem"
)

type EgressConfig struct {
	URL         string       `json:"url"`
	Token       string       `json:"token,omitempty"`
	Credential  string       `json:"credential"`
	Allow       []string     `json:"allow,omitempty"`
	SecretAllow []string     `json:"secretAllow,omitempty"`
	HarnessKeys []HarnessKey `json:"harnessKeys,omitempty"`
	Send        *HostCall    `json:"send,omitempty"`
}

type HarnessKey struct {
	Name   string `json:"name"`
	Host   string `json:"host"`
	Header string `json:"header"`
	Prefix string `json:"prefix"`
	Value  string `json:"value"`
}

const StandInPrefix = "spotlight-egress:"

const (
	LocationHeader = "header"
	LocationQuery  = "query"
)

type EgressSecretsRequest struct {
	ProxyCredential string `json:"proxyCredential,omitempty"`
	Recipient       string `json:"recipient"`
}

type EgressSecrets struct {
	RunID             string          `json:"runId,omitempty"`
	ExtraAllowedHosts []string        `json:"extraAllowedHosts"`
	Secrets           []FetchedSecret `json:"secrets"`
	Denied            []DeniedSecret  `json:"denied"`
	SpotlightAPI      *SpotlightAPI   `json:"spotlightApi,omitempty"`
	Bound             []string        `json:"bound,omitempty"`
}

type SpotlightAPI struct {
	Sealed string `json:"sealed"`
}

const SpotlightAPISecret = "spotlight-api"

const SpotlightAPIStandIn = StandInPrefix + SpotlightAPISecret

type FetchedSecret struct {
	Secret      string             `json:"secret"`
	Host        string             `json:"host"`
	Location    string             `json:"location"`
	Name        string             `json:"name"`
	Prefix      string             `json:"prefix"`
	Sealed      string             `json:"sealed,omitempty"`
	ExternalRef *ExternalSecretRef `json:"externalRef,omitempty"`
}

type ExternalSecretRef struct {
	Kind     string `json:"kind"`
	SecretID string `json:"secretId"`
	Field    string `json:"field,omitempty"`
}

const ReadFromAWSSecretsManager = "aws-secrets-manager"

type DeniedSecret struct {
	Secret string `json:"secret"`
	Reason string `json:"reason"`
}

const (
	EgressURLVar             = "SPOTLIGHT_EGRESS_URL"
	EgressProxyCredentialVar = "SPOTLIGHT_EGRESS_PROXY_CREDENTIAL"
	EgressTrafficVar         = "SPOTLIGHT_EGRESS_TRAFFIC"
	EgressTrafficAll         = "all"
	EgressTrafficBound       = "bound"
	EgressTargetHeader       = "Spotlight-Egress-Target"
	EgressBoundPath          = "/.well-known/spotlight/bound"
	EgressProxyUser          = "sandbox"
)

type EgressAuthorizeRequest struct {
	ProxyCredential string `json:"proxyCredential"`
}

type EgressAuthorizeResponse struct {
	RunnerID          string   `json:"runnerId"`
	WorkspaceID       string   `json:"workspaceId"`
	ControlPlaneHost  string   `json:"controlPlaneHost"`
	ControlPlanePort  int      `json:"controlPlanePort"`
	ExtraAllowedHosts []string `json:"extraAllowedHosts"`
}

const (
	MaxRunsAtOnce    = 500
	MaxRecordsAtOnce = 2000
)

type ActiveRunsRequest struct {
	ProxyCredentials []string `json:"proxyCredentials"`
}

type ActiveRunsResponse struct {
	Active []string `json:"active"`
}

const (
	ConnectionPassthrough = "passthrough"
	ConnectionInjected    = "injected"
	ConnectionBlocked     = "blocked"
	ConnectionFailed      = "failed"
)

const (
	ReasonNotAllowed     = "not-allowed"
	ReasonPrivateAddress = "private-address"
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

type EgressCheckResult struct {
	Enforced bool `json:"enforced"`
}
