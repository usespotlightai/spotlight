package protocol

// TraceRequest is what the agent's CLI asks the runner for: one task's trace,
// which the runner reads from the control plane on the agent's behalf.
type TraceRequest struct {
	Task string `json:"task"`
}

// Trace and the types under it mirror the control plane's trace response, so
// the CLI can print only the slice the agent asked for rather than the whole.
type Trace struct {
	StartedAt *string     `json:"startedAt"`
	Ms        int         `json:"ms"`
	Rows      int         `json:"rows"`
	Faults    int         `json:"faults"`
	Roots     []TraceNode `json:"roots"`
}

type TraceNode struct {
	ID        string      `json:"id"`
	Kind      string      `json:"kind"`
	Name      string      `json:"name"`
	StartedAt string      `json:"startedAt"`
	Ms        int         `json:"ms"`
	Tone      string      `json:"tone"`
	Cost      *float64    `json:"cost"`
	Currency  *string     `json:"currency"`
	Step      *TraceStep  `json:"step"`
	Span      *TraceSpan  `json:"span"`
	Children  []TraceNode `json:"children"`
}

type TraceStep struct {
	Kind      string          `json:"kind"`
	Text      string          `json:"text"`
	Status    *string         `json:"status"`
	Tool      *string         `json:"tool"`
	Detail    *string         `json:"detail"`
	Ms        int             `json:"ms"`
	StartedAt string          `json:"startedAt"`
	Locations []TraceLocation `json:"locations"`
	Given     *string         `json:"given"`
	Returned  *string         `json:"returned"`
	Change    *TraceChange    `json:"change"`
}

type TraceLocation struct {
	Path string `json:"path"`
	Line *int   `json:"line"`
}

type TraceChange struct {
	Path   *string `json:"path"`
	Before string  `json:"before"`
	After  string  `json:"after"`
}

type TraceSpan struct {
	ID         string           `json:"id"`
	ParentID   *string          `json:"parentId"`
	Name       string           `json:"name"`
	StartedAt  string           `json:"startedAt"`
	Ms         int              `json:"ms"`
	Failed     bool             `json:"failed"`
	Attributes []TraceAttribute `json:"attributes"`
}

type TraceAttribute struct {
	Name  string `json:"name"`
	Value string `json:"value"`
}
