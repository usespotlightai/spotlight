package control

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"usespotlight.ai/data-plane/protocol"
)

const (
	PollTimeout     = 10 * time.Second
	CallPollTimeout = 25 * time.Second
)

var ErrRefused = errors.New("the control plane refused the credential")

type Rejection struct {
	Status  int
	Reason  string
	Message string
	Errors  []protocol.FieldError
	Err     error
}

func (r *Rejection) Error() string { return r.Err.Error() }

func (r *Rejection) Refusal() bool {
	switch r.Status {
	case http.StatusBadRequest, http.StatusNotFound, http.StatusConflict, http.StatusUnprocessableEntity:
		return true
	}

	return false
}

func (r *Rejection) Refused() (string, bool) {
	if !r.Refusal() {
		return "", false
	}

	return r.Message, r.Message != ""
}

func (r *Rejection) Unfit() ([]protocol.FieldError, bool) {
	return r.Errors, r.Status == http.StatusUnprocessableEntity && protocol.Refuses(r.Errors)
}

func (r *Rejection) Unwrap() error { return r.Err }

func (r *Rejection) Gone() bool { return r.Status == http.StatusNotFound }

func (r *Rejection) Lost() bool { return r.Gone() || errors.Is(r.Err, ErrRefused) }

func CheckLeaseLost(err error) bool {
	var rejection *Rejection
	return errors.As(err, &rejection) && rejection.Refusal() && rejection.Status != http.StatusConflict
}

func Rejected(err error, reason string) bool {
	var rejection *Rejection
	return errors.As(err, &rejection) && rejection.Reason == reason
}

type Credential interface {
	Authorize(request *http.Request) error
}

type Bearer string

func (b Bearer) Authorize(request *http.Request) error {
	request.Header.Set("Authorization", "Bearer "+string(b))
	return nil
}

type Client struct {
	base       *url.URL
	credential Credential
	token      string
	http       *http.Client

	runnerID string
}

func New(baseURL, token string) (*Client, error) {
	client, err := Authorized(baseURL, Bearer(token))
	if err != nil {
		return nil, err
	}

	client.token = token
	return client, nil
}

func Authorized(baseURL string, credential Credential) (*Client, error) {
	base, err := url.Parse(baseURL)
	if err != nil || base.Scheme == "" || base.Host == "" {
		return nil, fmt.Errorf("control plane url %q is not absolute", baseURL)
	}

	return &Client{
		base:       base,
		credential: credential,
		http:       &http.Client{Timeout: 2 * time.Minute},
	}, nil
}

func (c *Client) RunnerID() string { return c.runnerID }

func (c *Client) Token() string { return c.token }

func (c *Client) Register(ctx context.Context, in protocol.Registration) error {
	var out protocol.Registered
	if err := c.do(ctx, http.MethodPost, "/api/runners/register", in, &out); err != nil {
		return fmt.Errorf("register: %w", err)
	}
	if out.RunnerID == "" {
		return fmt.Errorf("register: control plane returned no runner id")
	}

	c.runnerID = out.RunnerID
	return nil
}

func (c *Client) Installable(ctx context.Context) ([]protocol.Installable, error) {
	var out []protocol.Installable
	if err := c.do(ctx, http.MethodGet, "/api/runners/harnesses", nil, &out); err != nil {
		return nil, fmt.Errorf("ask what to look for: %w", err)
	}

	return out, nil
}

func (c *Client) UseTool(
	ctx context.Context, runID, name string, input json.RawMessage,
) (json.RawMessage, error) {
	var out json.RawMessage
	path := "/api/runs/" + runID + "/tools/" + url.PathEscape(name)

	if err := c.do(ctx, http.MethodPost, path, input, &out); err != nil {
		return nil, fmt.Errorf("use %s: %w", name, err)
	}

	return out, nil
}

func (c *Client) AskPermission(
	ctx context.Context, runID string, asked protocol.PermissionAsked,
) (protocol.PermissionAnswer, error) {
	var out protocol.PermissionAnswer
	path := fmt.Sprintf("/api/runs/%s/permissions", url.PathEscape(runID))

	if err := c.do(ctx, http.MethodPost, path, asked, &out); err != nil {
		return protocol.PermissionAnswer{}, fmt.Errorf("ask for permission: %w", err)
	}

	return out, nil
}

func (c *Client) AnswerRemark(
	ctx context.Context, runID string, said protocol.Remark,
) error {
	path := "/api/runs/" + runID + "/remark"

	if err := c.do(ctx, http.MethodPost, path, said, nil); err != nil {
		return fmt.Errorf("answer a remark: %w", err)
	}

	return nil
}

func (c *Client) Trace(
	ctx context.Context, runID, taskID string,
) (json.RawMessage, error) {
	var out json.RawMessage
	path := "/api/runs/" + runID + "/trace/" + taskID

	if err := c.do(ctx, http.MethodGet, path, nil, &out); err != nil {
		return nil, fmt.Errorf("read a trace: %w", err)
	}

	return out, nil
}

func (c *Client) History(
	ctx context.Context, runID string, asked protocol.HistoryRequest,
) (json.RawMessage, error) {
	query := url.Values{"station": {asked.Station}}
	for name, value := range map[string]string{
		"line": asked.Line, "fingerprint": asked.Fingerprint, "outcome": asked.Outcome, "since": asked.Since,
	} {
		if value != "" {
			query.Set(name, value)
		}
	}
	if asked.Last > 0 {
		query.Set("last", strconv.Itoa(asked.Last))
	}

	var out json.RawMessage
	path := fmt.Sprintf("/api/runs/%s/history?%s", url.PathEscape(runID), query.Encode())

	if err := c.do(ctx, http.MethodGet, path, nil, &out); err != nil {
		var rejection *Rejection
		if errors.As(err, &rejection) && rejection.Gone() {
			rejection.Message = unknownStation(asked)
		}
		return nil, fmt.Errorf("read the history of %s: %w", asked.Station, err)
	}

	return out, nil
}

func unknownStation(asked protocol.HistoryRequest) string {
	if asked.Line != "" {
		return fmt.Sprintf("line %q has no station %q in this team", asked.Line, asked.Station)
	}

	return fmt.Sprintf("no line in this team has a station %q", asked.Station)
}

func (c *Client) RecallMemories(
	ctx context.Context, runID, words string,
) (json.RawMessage, error) {
	var out json.RawMessage
	path := fmt.Sprintf("/api/runs/%s/memories/recall", url.PathEscape(runID))
	asked := struct {
		Words string `json:"words"`
	}{Words: words}

	if err := c.do(ctx, http.MethodPost, path, asked, &out); err != nil {
		return nil, fmt.Errorf("recall: %w", err)
	}

	return out, nil
}

func (c *Client) RecallMemory(
	ctx context.Context, runID, handle string,
) (json.RawMessage, error) {
	var out json.RawMessage
	path := fmt.Sprintf("/api/runs/%s/memories/%s/recall", url.PathEscape(runID), url.PathEscape(handle))

	if err := c.do(ctx, http.MethodPost, path, nil, &out); err != nil {
		return nil, fmt.Errorf("recall %s: %w", handle, err)
	}

	return out, nil
}

func (c *Client) MemoryFiles(ctx context.Context, runID string) ([]protocol.MemoryFile, error) {
	var out []protocol.MemoryFile
	path := fmt.Sprintf("/api/runs/%s/memory-files", url.PathEscape(runID))

	if err := c.do(ctx, http.MethodGet, path, nil, &out); err != nil {
		return nil, fmt.Errorf("read the team's memory: %w", err)
	}

	return out, nil
}

func (c *Client) Remember(
	ctx context.Context, runID string, remembered protocol.Remembering,
) (json.RawMessage, error) {
	var out json.RawMessage
	path := fmt.Sprintf("/api/runs/%s/memories", url.PathEscape(runID))

	if err := c.do(ctx, http.MethodPost, path, remembered, &out); err != nil {
		return nil, fmt.Errorf("remember: %w", err)
	}

	return out, nil
}

func (c *Client) ProposeCandidate(
	ctx context.Context, runID string, proposal protocol.CandidateProposal,
) (json.RawMessage, error) {
	var out json.RawMessage
	path := fmt.Sprintf("/api/runs/%s/search-candidates", url.PathEscape(runID))

	if err := c.do(ctx, http.MethodPost, path, proposal, &out); err != nil {
		var rejection *Rejection
		if errors.As(err, &rejection) {
			switch {
			case rejection.Message != "":
			case rejection.Status == http.StatusConflict:
				rejection.Message = "this iteration has proposed all the candidates it may, or this run is no longer the active run of the search"
			case rejection.Gone():
				rejection.Message = "this run is no longer the active run of the search"
			}
		}
		return nil, fmt.Errorf("propose %s: %w", proposal.Name, err)
	}

	return out, nil
}

func (c *Client) RecordCause(
	ctx context.Context, runID string, record protocol.CauseRecord,
) (json.RawMessage, error) {
	var out json.RawMessage
	path := fmt.Sprintf("/api/runs/%s/search-causes", url.PathEscape(runID))

	if err := c.do(ctx, http.MethodPost, path, record, &out); err != nil {
		var rejection *Rejection
		if errors.As(err, &rejection) {
			switch {
			case rejection.Message != "":
			case rejection.Status == http.StatusConflict:
				rejection.Message = "this run proposes candidates; only a run looking into why a search stalled records causes"
			case rejection.Gone():
				rejection.Message = "this run is no longer the active run of the search, or the task is none it looks into"
			}
		}
		return nil, fmt.Errorf("record the cause of %s: %w", record.TaskID, err)
	}

	return out, nil
}

func (c *Client) Claim(ctx context.Context) (*protocol.Claimed, error) {
	ctx, cancel := context.WithTimeout(ctx, PollTimeout+15*time.Second)
	defer cancel()

	var claimed protocol.Claimed
	const path = "/api/runners/claim"

	status, err := c.request(ctx, http.MethodPost, path, nil, &claimed)
	if err != nil {
		return nil, fmt.Errorf("claim: %w", err)
	}
	if status == http.StatusNoContent {
		return nil, nil
	}

	return &claimed, nil
}

func (c *Client) ClaimCall(ctx context.Context, host string) (*protocol.HostCall, error) {
	ctx, cancel := context.WithTimeout(ctx, CallPollTimeout+15*time.Second)
	defer cancel()

	var call protocol.HostCall
	asked := protocol.HostCallClaim{Host: host}
	status, err := c.request(ctx, http.MethodPost, protocol.HostCallClaimPath, asked, &call)
	if err != nil {
		return nil, fmt.Errorf("claim a call: %w", err)
	}
	if status == http.StatusNoContent {
		return nil, nil
	}
	if call.ID == "" || call.URL == "" {
		return nil, fmt.Errorf("claim a call: the control plane handed a call with no id or url")
	}

	return &call, nil
}

func (c *Client) AnswerCall(ctx context.Context, id string, answer protocol.HostCallAnswer) error {
	path := strings.Replace(protocol.HostCallAnswerPath, "{id}", url.PathEscape(id), 1)
	if err := c.do(ctx, http.MethodPost, path, answer, nil); err != nil {
		return fmt.Errorf("answer a call: %w", err)
	}

	return nil
}

func (c *Client) Said(ctx context.Context, runID string) ([]protocol.Said, error) {
	path := fmt.Sprintf("/api/runs/%s/messages", url.PathEscape(runID))

	var said []protocol.Said
	if err := c.do(ctx, http.MethodGet, path, nil, &said); err != nil {
		return nil, fmt.Errorf("read what was said: %w", err)
	}

	return said, nil
}

func (c *Client) Delivered(ctx context.Context, runID string, upTo int) error {
	path := fmt.Sprintf("/api/runs/%s/messages/delivered", url.PathEscape(runID))
	body := struct {
		UpTo int `json:"upTo"`
	}{UpTo: upTo}

	if err := c.do(ctx, http.MethodPost, path, body, nil); err != nil {
		return fmt.Errorf("mark what was said delivered: %w", err)
	}

	return nil
}

func (c *Client) RenewLease(ctx context.Context, runID string) (bool, error) {
	path := fmt.Sprintf("/api/runs/%s/lease", url.PathEscape(runID))

	var out struct {
		Stop bool `json:"stop"`
	}
	if err := c.do(ctx, http.MethodPost, path, nil, &out); err != nil {
		return false, fmt.Errorf("renew lease: %w", err)
	}

	return out.Stop, nil
}

func (c *Client) AppendEvents(ctx context.Context, runID string, events []protocol.Event) error {
	if len(events) == 0 {
		return nil
	}

	batch := struct {
		Events []protocol.Event `json:"events"`
	}{Events: events}

	path := fmt.Sprintf("/api/runs/%s/events", url.PathEscape(runID))
	if err := c.do(ctx, http.MethodPost, path, batch, nil); err != nil {
		return fmt.Errorf("append events: %w", err)
	}
	return nil
}

func (c *Client) RecordImage(ctx context.Context, runID, image string) error {
	path := fmt.Sprintf("/api/runs/%s/image", url.PathEscape(runID))
	if err := c.do(ctx, http.MethodPost, path, protocol.RunImage{Image: image}, nil); err != nil {
		return fmt.Errorf("record the image: %w", err)
	}
	return nil
}

func (c *Client) Complete(ctx context.Context, runID string, done protocol.Completion) (protocol.Completed, error) {
	path := fmt.Sprintf("/api/runs/%s/completion", url.PathEscape(runID))

	var completed protocol.Completed
	if err := c.do(ctx, http.MethodPost, path, done, &completed); err != nil {
		return protocol.Completed{}, fmt.Errorf("complete: %w", err)
	}

	return completed, nil
}

func (c *Client) Asks(ctx context.Context, runID string, turn protocol.Completion) (bool, error) {
	path := fmt.Sprintf("/api/runs/%s/completion/asks", url.PathEscape(runID))

	var asks protocol.TurnAsks
	if err := c.do(ctx, http.MethodPost, path, turn, &asks); err != nil {
		return false, fmt.Errorf("ask whether the turn waits: %w", err)
	}

	return asks.Asks, nil
}

func (c *Client) Park(ctx context.Context, runID string, cold bool) (protocol.Parking, error) {
	path := fmt.Sprintf("/api/runs/%s/parked", url.PathEscape(runID))

	var parking protocol.Parking
	if err := c.do(ctx, http.MethodPost, path, protocol.ParkRequest{Cold: cold}, &parking); err != nil {
		return protocol.Parking{}, fmt.Errorf("park: %w", err)
	}

	return parking, nil
}

func (c *Client) Attachment(
	ctx context.Context, runID, attachmentID string, into io.Writer,
) error {
	path := fmt.Sprintf(
		"/api/runs/%s/attachments/%s",
		url.PathEscape(runID), url.PathEscape(attachmentID),
	)

	response, err := c.send(ctx, http.MethodGet, path, nil)
	if err != nil {
		return fmt.Errorf("fetch an attachment: %w", err)
	}
	defer response.Body.Close()

	if response.StatusCode >= 300 {
		return fmt.Errorf("fetch an attachment: %w", refused(http.MethodGet, path, response))
	}

	if _, err := io.Copy(into, response.Body); err != nil {
		return fmt.Errorf("fetch an attachment: %s %s: %w", http.MethodGet, path, err)
	}

	return nil
}

func (c *Client) WorkspaceArchive(ctx context.Context, runID string) (*protocol.StoredArchive, error) {
	path := fmt.Sprintf("/api/runs/%s/workspace-archive", url.PathEscape(runID))

	var stored protocol.StoredArchive
	status, err := c.request(ctx, http.MethodGet, path, nil, &stored)
	if err != nil {
		return nil, fmt.Errorf("ask for the workspace to restore: %w", err)
	}
	if status == http.StatusNoContent {
		return nil, nil
	}

	return &stored, nil
}

func (c *Client) GrantArchive(
	ctx context.Context, runID string, size int64, sha256 string,
) (protocol.ArchiveGrant, error) {
	path := fmt.Sprintf("/api/runs/%s/workspace-archive", url.PathEscape(runID))

	var granted protocol.ArchiveGrant
	asked := protocol.ArchiveRequest{Size: size, SHA256: sha256}
	if err := c.do(ctx, http.MethodPost, path, asked, &granted); err != nil {
		return protocol.ArchiveGrant{}, fmt.Errorf("ask to keep the workspace: %w", err)
	}

	return granted, nil
}

func (c *Client) SealArchive(ctx context.Context, runID, archiveID string) error {
	path := fmt.Sprintf(
		"/api/runs/%s/workspace-archive/%s/sealed",
		url.PathEscape(runID), url.PathEscape(archiveID),
	)

	if err := c.do(ctx, http.MethodPost, path, nil, nil); err != nil {
		return fmt.Errorf("seal the workspace kept: %w", err)
	}

	return nil
}

func (c *Client) RecordStartingPoint(ctx context.Context, runID string, point protocol.StartingPoint) error {
	path := fmt.Sprintf("/api/runs/%s/starting-point", url.PathEscape(runID))

	if err := c.do(ctx, http.MethodPost, path, point, nil); err != nil {
		return fmt.Errorf("say where the run started: %w", err)
	}

	return nil
}

func (c *Client) DraftChangeStack(ctx context.Context, runID, repository, diff, base string) error {
	path := fmt.Sprintf("/api/runs/%s/change-stacks", url.PathEscape(runID))
	handed := protocol.ChangeStackDraft{Diff: diff, Repository: repository, Base: base}

	if err := c.do(ctx, http.MethodPost, path, handed, nil); err != nil {
		return fmt.Errorf("hand over what a run changed: %w", err)
	}

	return nil
}

func checkPath(runID, stackID string, recheck bool, rest string) string {
	path := fmt.Sprintf(
		"/api/runs/%s/change-stack-checks/%s%s",
		url.PathEscape(runID), url.PathEscape(stackID), rest,
	)
	if recheck {
		return path + "?recheck=true"
	}

	return path
}

func (c *Client) RecordChangeStackCheck(
	ctx context.Context, runID, stackID string, recheck bool, checked protocol.StackChecked,
) error {
	path := checkPath(runID, stackID, recheck, "")

	if err := c.do(ctx, http.MethodPost, path, checked, nil); err != nil {
		return fmt.Errorf("report a change stack check: %w", err)
	}

	return nil
}

func (c *Client) RenewCheckLease(ctx context.Context, runID, stackID string, recheck bool) (bool, error) {
	path := checkPath(runID, stackID, recheck, "/lease")

	var out struct {
		Stop bool `json:"stop"`
	}
	if err := c.do(ctx, http.MethodPost, path, nil, &out); err != nil {
		return false, fmt.Errorf("renew the lease of a change stack check: %w", err)
	}

	return out.Stop, nil
}

func (c *Client) RedeemEgress(ctx context.Context, recipient string) (protocol.EgressRedemption, error) {
	var redeemed protocol.EgressRedemption
	asked := protocol.EgressRedeem{Recipient: recipient}
	if err := c.do(ctx, http.MethodPost, "/api/egress/redeem", asked, &redeemed); err != nil {
		return protocol.EgressRedemption{}, fmt.Errorf("redeem the run's secrets: %w", err)
	}

	return redeemed, nil
}

func (c *Client) AdmitEgress(ctx context.Context, proxyCredential string) (protocol.EgressAdmitted, error) {
	var admitted protocol.EgressAdmitted
	asked := protocol.EgressAdmit{ProxyCredential: proxyCredential}
	if err := c.do(ctx, http.MethodPost, "/api/egress/admit", asked, &admitted); err != nil {
		return protocol.EgressAdmitted{}, fmt.Errorf("admit a sandbox: %w", err)
	}

	return admitted, nil
}

func (c *Client) RedeemEgressFor(
	ctx context.Context, proxyCredential, recipient string,
) (protocol.EgressRedemption, error) {
	var redeemed protocol.EgressRedemption
	asked := protocol.EgressRedeem{ProxyCredential: proxyCredential, Recipient: recipient}
	if err := c.do(ctx, http.MethodPost, "/api/egress/redeem", asked, &redeemed); err != nil {
		return protocol.EgressRedemption{}, fmt.Errorf("redeem a run's secrets: %w", err)
	}

	return redeemed, nil
}

func (c *Client) ActiveRuns(ctx context.Context, proxyCredentials []string) ([]string, error) {
	var answer protocol.ActiveRunsResponse
	asked := protocol.ActiveRunsRequest{ProxyCredentials: proxyCredentials}
	if err := c.do(ctx, http.MethodPost, "/api/egress/active-runs", asked, &answer); err != nil {
		return nil, fmt.Errorf("ask which runs are active: %w", err)
	}

	return answer.Active, nil
}

func (c *Client) RecordConnections(ctx context.Context, records []protocol.EgressConnection) error {
	asked := protocol.EgressConnections{Records: records}
	if err := c.do(ctx, http.MethodPost, "/api/egress/connections", asked, nil); err != nil {
		return fmt.Errorf("record connections: %w", err)
	}

	return nil
}

func (c *Client) Through(transport http.RoundTripper) {
	c.http.Transport = transport
}

func (c *Client) do(ctx context.Context, method, path string, in, out any) error {
	_, err := c.request(ctx, method, path, in, out)
	return err
}

func (c *Client) Request(ctx context.Context, method, path string, in, out any) (int, error) {
	return c.request(ctx, method, path, in, out)
}

func (c *Client) request(ctx context.Context, method, path string, in, out any) (int, error) {
	response, err := c.send(ctx, method, path, in)
	if err != nil {
		return 0, err
	}
	defer response.Body.Close()

	if response.StatusCode >= 300 {
		return response.StatusCode, rejection(method, path, response)
	}

	if out != nil && response.StatusCode != http.StatusNoContent {
		if err := json.NewDecoder(response.Body).Decode(out); err != nil {
			return response.StatusCode, fmt.Errorf("%s %s: %w", method, path, err)
		}
	}

	return response.StatusCode, nil
}

func (c *Client) send(ctx context.Context, method, path string, in any) (*http.Response, error) {
	var body io.Reader
	if in != nil {
		encoded, err := json.Marshal(in)
		if err != nil {
			return nil, err
		}
		body = bytes.NewReader(encoded)
	}

	route, query, _ := strings.Cut(path, "?")
	target := c.base.JoinPath(route)
	target.RawQuery = query

	request, err := http.NewRequestWithContext(ctx, method, target.String(), body)
	if err != nil {
		return nil, err
	}
	if err := c.credential.Authorize(request); err != nil {
		return nil, err
	}
	if in != nil {
		request.Header.Set("Content-Type", "application/json")
	}

	return c.http.Do(request)
}

const (
	maxDetail  = 4096
	maxProblem = 1 << 20
)

func rejection(method, path string, response *http.Response) error {
	read, _ := io.ReadAll(io.LimitReader(response.Body, maxProblem))

	var said struct {
		Reason  string                `json:"reason"`
		Message json.RawMessage       `json:"message"`
		Detail  string                `json:"detail"`
		Errors  []protocol.FieldError `json:"errors"`
	}
	_ = json.Unmarshal(read, &said)

	detail := read
	if len(detail) > maxDetail {
		detail = detail[:maxDetail]
	}

	err := fmt.Errorf("%s %s: %s: %s", method, path, response.Status, strings.TrimSpace(string(detail)))
	if response.StatusCode == http.StatusUnauthorized || response.StatusCode == http.StatusForbidden {
		err = fmt.Errorf("%w: %w", ErrRefused, err)
	}

	message := messageOf(said.Message)
	if message == "" {
		message = said.Detail
	}

	return &Rejection{
		Status: response.StatusCode, Reason: said.Reason, Message: message, Errors: said.Errors, Err: err,
	}
}

func messageOf(raw json.RawMessage) string {
	var one string
	if json.Unmarshal(raw, &one) == nil {
		return one
	}

	var many []string
	if json.Unmarshal(raw, &many) == nil {
		return strings.Join(many, "; ")
	}

	return ""
}

func refused(method, path string, response *http.Response) error {
	detail, _ := io.ReadAll(io.LimitReader(response.Body, 1024))
	return fmt.Errorf(
		"%s %s: %s: %s",
		method, path, response.Status, strings.TrimSpace(string(detail)),
	)
}

func Seated(baseURL string, handed protocol.Handed) (*Client, error) {
	client, err := New(baseURL, handed.Token)
	if err != nil {
		return nil, err
	}

	client.runnerID = handed.RunnerID
	return client, nil
}
