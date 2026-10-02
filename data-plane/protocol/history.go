package protocol

import "encoding/json"

type HistoryRequest struct {
	Station     string `json:"station"`
	Line        string `json:"line,omitempty"`
	Fingerprint string `json:"fingerprint,omitempty"`
	Outcome     string `json:"outcome,omitempty"`
	Since       string `json:"since,omitempty"`
	Last        int    `json:"last,omitempty"`
}

type History struct {
	Line    HistoryPlace    `json:"line"`
	Station HistoryPlace    `json:"station"`
	Configs []HistoryConfig `json:"configs"`
	Runs    []HistoryRun    `json:"runs"`

	Candidates []HistoryCandidate `json:"candidates,omitempty"`
	SeedBlock  json.RawMessage    `json:"seedBlock,omitempty"`
}

type HistoryCandidate struct {
	CandidateName string          `json:"candidateName"`
	Fingerprint   string          `json:"fingerprint"`
	Hypothesis    string          `json:"hypothesis"`
	Block         json.RawMessage `json:"block"`
	Runs          []CandidateRun  `json:"runs"`
}

type CandidateRun struct {
	RunID       string          `json:"runId"`
	Original    string          `json:"original"`
	TaskID      string          `json:"taskId"`
	Title       string          `json:"title"`
	Fingerprint *string         `json:"fingerprint"`
	State       string          `json:"state"`
	Attempt     int             `json:"attempt"`
	Harness     string          `json:"harness"`
	StartedAt   *string         `json:"startedAt"`
	EndedAt     *string         `json:"endedAt"`
	Cost        *RunCost        `json:"cost"`
	Changes     []HistoryChange `json:"changes"`
	Trace       Trace           `json:"trace"`
	Succeeded   *bool           `json:"succeeded"`
	Reasons     []string        `json:"reasons"`
	Verdict     *string         `json:"verdict"`
}

func (r CandidateRun) Run() HistoryRun {
	return HistoryRun{
		RunID: r.RunID, TaskID: r.TaskID, Title: r.Title, Fingerprint: r.Fingerprint,
		State: r.State, Attempt: r.Attempt, Harness: r.Harness,
		StartedAt: r.StartedAt, EndedAt: r.EndedAt, Changes: r.Changes, Trace: r.Trace,
	}
}

type HistoryPlace struct {
	Key  string `json:"key"`
	Name string `json:"name"`
}

type HistoryConfig struct {
	Fingerprint string        `json:"fingerprint"`
	Config      StationConfig `json:"config"`
}

type StationConfig struct {
	Prompt       *string            `json:"prompt"`
	Harness      string             `json:"harness"`
	Model        *string            `json:"model"`
	Effort       *string            `json:"effort"`
	Profile      *ConfigProfile     `json:"profile"`
	Image        *string            `json:"image"`
	Repositories []ConfigRepository `json:"repositories"`
	Skills       []ConfigSkill      `json:"skills"`
	Tools        []string           `json:"tools"`
	Decisions    bool               `json:"decisions"`
	Memories     bool               `json:"memories"`
	Judge        *ConfigJudge       `json:"judge"`
}

type ConfigJudge struct {
	RubricDigest string  `json:"rubricDigest"`
	Sample       float64 `json:"sample"`
	Trust        float64 `json:"trust"`
}

type ConfigProfile struct {
	Key      string          `json:"key"`
	Settings json.RawMessage `json:"settings"`
}

type ConfigRepository struct {
	Name  string  `json:"name"`
	Setup *string `json:"setup"`
}

type ConfigSkill struct {
	Key    string `json:"key"`
	Digest string `json:"digest"`
}

type HistoryRun struct {
	RunID       string          `json:"runId"`
	TaskID      string          `json:"taskId"`
	Title       string          `json:"title"`
	Fingerprint *string         `json:"fingerprint"`
	State       string          `json:"state"`
	Attempt     int             `json:"attempt"`
	Harness     string          `json:"harness"`
	StartedAt   *string         `json:"startedAt"`
	EndedAt     *string         `json:"endedAt"`
	Outcome     *RunOutcome     `json:"outcome"`
	Changes     []HistoryChange `json:"changes"`
	Trace       Trace           `json:"trace"`
}

type RunOutcome struct {
	Ending   string   `json:"ending"`
	Failure  *string  `json:"failure"`
	Round    int      `json:"round"`
	Cost     *RunCost `json:"cost"`
	Checks   *string  `json:"checks"`
	Next     *RunNext `json:"next"`
	Delivery *string  `json:"delivery"`
}

type RunCost struct {
	Ms       *int     `json:"ms"`
	Steps    int      `json:"steps"`
	Faults   int      `json:"faults"`
	Used     *int     `json:"used"`
	Cost     *float64 `json:"cost"`
	Currency *string  `json:"currency"`
}

type RunNext struct {
	Act string `json:"act"`
	At  string `json:"at"`
}

type HistoryChange struct {
	Path    string `json:"path"`
	Before  string `json:"before"`
	After   string `json:"after"`
	Omitted bool   `json:"omitted"`
}
