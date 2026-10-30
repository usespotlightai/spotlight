package protocol

const TrustHeader = "Spotlight-Trust"

const RunTimeoutVar = "SPOTLIGHT_RUN_TIMEOUT"

type HostRequirements struct {
	Host      HostRequirement   `json:"host"`
	Runner    RunnerRequirement `json:"runner"`
	Harnesses []HarnessProbe    `json:"harnesses"`
	Images    []string          `json:"images"`
}

type HostRequirement struct {
	Release string `json:"release,omitempty"`
	Minimum string `json:"minimum"`
}

type RunnerRequirement struct {
	Minimum string `json:"minimum"`
}

type HostClaim struct {
	Host    string `json:"host"`
	Image   string `json:"image"`
	Sandbox string `json:"sandbox,omitempty"`
}

type HostImage struct {
	Image             string          `json:"image"`
	Digest            string          `json:"digest,omitempty"`
	IsDefault         bool            `json:"isDefault"`
	Release           string          `json:"release,omitempty"`
	Harnesses         []HarnessReport `json:"harnesses"`
	UnavailableReason string          `json:"unavailableReason,omitempty"`
}

type HostSandbox struct {
	ID string `json:"id"`
}

type HostHeartbeat struct {
	BootID           string        `json:"bootId"`
	Name             string        `json:"name"`
	Release          string        `json:"release"`
	ContainerRuntime string        `json:"containerRuntime"`
	Capacity         int           `json:"capacity"`
	Running          []string      `json:"running"`
	Sandboxes        []HostSandbox `json:"sandboxes"`
	Images           []HostImage   `json:"images"`
	Stopping         bool          `json:"stopping"`
}

type HeartbeatResponse struct {
	Workspace string   `json:"workspace"`
	Drain     []string `json:"drain,omitempty"`
}

type RunImage struct {
	Image string `json:"image"`
}
