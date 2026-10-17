package protocol

type RecallRequest struct {
	Words  string `json:"words,omitempty"`
	Handle string `json:"handle,omitempty"`
}

type Remembering struct {
	Kind       string   `json:"kind"`
	Body       string   `json:"body"`
	Reach      string   `json:"reach,omitempty"`
	Paths      []string `json:"paths,omitempty"`
	Supersedes string   `json:"supersedes,omitempty"`
}

type MemoryPerson struct {
	ID   string  `json:"id"`
	Name *string `json:"name"`
}

type MemoryGrounds struct {
	TaskID string `json:"taskId"`
	RunID  string `json:"runId"`
}

type MemoryRetirement struct {
	At     string        `json:"at"`
	By     *MemoryPerson `json:"by"`
	Reason *string       `json:"reason"`
}

type MemoryStep struct {
	Index int    `json:"index"`
	Kind  string `json:"kind"`
	Text  string `json:"text"`
}

type MemoryNote struct {
	Position int    `json:"position"`
	By       string `json:"by"`
	Text     string `json:"text"`
}

type MemoryLink struct {
	Handle string `json:"handle"`
	Body   string `json:"body"`
}

type RecalledMemory struct {
	Handle     string            `json:"handle"`
	Kind       string            `json:"kind"`
	Body       string            `json:"body"`
	Source     string            `json:"source"`
	Status     string            `json:"status"`
	Reach      string            `json:"reach"`
	Repository *string           `json:"repository"`
	Paths      []string          `json:"paths"`
	ApprovedBy MemoryPerson      `json:"approvedBy"`
	ApprovedAt string            `json:"approvedAt"`
	Retirement *MemoryRetirement `json:"retirement"`
	Grounds    *MemoryGrounds    `json:"grounds"`
	Steps      []MemoryStep      `json:"steps"`
	Notes      []MemoryNote      `json:"notes"`
	Superseded *MemoryLink       `json:"superseded"`
	Successor  *MemoryLink       `json:"successor"`
}

type ProposedMemory struct {
	Kind       string       `json:"kind"`
	Body       string       `json:"body"`
	Source     string       `json:"source"`
	Reach      string       `json:"reach"`
	Repository *string      `json:"repository"`
	Paths      []string     `json:"paths"`
	Steps      []MemoryStep `json:"steps"`
}

type MemoryFile struct {
	Path string `json:"path"`
	Body string `json:"body"`
}
