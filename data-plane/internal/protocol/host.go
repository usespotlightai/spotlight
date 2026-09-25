package protocol

const TrustHeader = "Spotlight-Trust"

type HostClaim struct {
	Host      string          `json:"host"`
	Harnesses []HarnessReport `json:"harnesses"`
}

type HostPresence struct {
	Name      string          `json:"name"`
	Release   string          `json:"release"`
	Executor  string          `json:"executor"`
	Capacity  int             `json:"capacity"`
	Running   []string        `json:"running"`
	Harnesses []HarnessReport `json:"harnesses"`
}

type HostStanding struct {
	Workspace string `json:"workspace"`
}
