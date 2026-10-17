package protocol

const TrustHeader = "Spotlight-Trust"

const AnswerWaitVar = "SPOTLIGHT_ANSWER_WAIT"

type HostRequirements struct {
	Runner    RunnerRequirement `json:"runner"`
	Harnesses []Installable     `json:"harnesses"`
	Images    []string          `json:"images"`
}

type RunnerRequirement struct {
	Minimum string `json:"minimum"`
}

type HostClaim struct {
	Host  string `json:"host"`
	Image string `json:"image"`
}

type HostImage struct {
	Image     string          `json:"image"`
	Digest    string          `json:"digest,omitempty"`
	Usual     bool            `json:"usual"`
	Release   string          `json:"release,omitempty"`
	Harnesses []HarnessReport `json:"harnesses"`
	Refused   string          `json:"refused,omitempty"`
}

type HostPresence struct {
	Session  string      `json:"session"`
	Name     string      `json:"name"`
	Release  string      `json:"release"`
	Executor string      `json:"executor"`
	Capacity int         `json:"capacity"`
	Running  []string    `json:"running"`
	Images   []HostImage `json:"images"`
}

type HeartbeatResponse struct {
	Workspace string `json:"workspace"`
}

type RunImage struct {
	Image string `json:"image"`
}
