package protocol

type TraceRequest struct {
	Task string `json:"task"`
}

type Trace struct {
	StartedAt *string     `json:"startedAt"`
	Ms        int         `json:"ms"`
	Rows      int         `json:"rows"`
	Errors    int         `json:"errors"`
	Roots     []TraceNode `json:"roots"`
}

type TraceNode struct {
	ID        string      `json:"id"`
	Kind      string      `json:"kind"`
	Name      string      `json:"name"`
	StartedAt string      `json:"startedAt"`
	Ms        int         `json:"ms"`
	Category  string      `json:"category"`
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
	Input     *string         `json:"input"`
	Output    *string         `json:"output"`
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
