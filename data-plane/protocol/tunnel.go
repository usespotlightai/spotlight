package protocol

const SandboxEditorServers = "/spotlight/editor-servers"

const SandboxWorkspaceOpen = "/run/spotlight/workspace-open"

type TunnelStream struct {
	Stream    string `json:"stream"`
	SandboxID string `json:"sandboxId"`
}

const TunnelNoSandbox = 4404
