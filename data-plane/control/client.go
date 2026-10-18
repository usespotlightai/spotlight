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

var ErrUnauthorized = errors.New("the control plane did not accept the credential")

type ResponseError struct {
	Status  int
	Reason  string
	Message string
	Errors  []protocol.FieldError
	Err     error
}

func (r *ResponseError) Error() string { return r.Err.Error() }

func (r *ResponseError) IsClientError() bool {
	switch r.Status {
	case http.StatusBadRequest, http.StatusNotFound, http.StatusConflict, http.StatusUnprocessableEntity:
		return true
	}

	return false
}

func (r *ResponseError) ClientErrorMessage() (string, bool) {
	if !r.IsClientError() {
		return "", false
	}

	return r.Message, r.Message != ""
}

func (r *ResponseError) InvalidFields() ([]protocol.FieldError, bool) {
	return r.Errors, r.Status == http.StatusUnprocessableEntity && protocol.HasErrors(r.Errors)
}

func (r *ResponseError) Unwrap() error { return r.Err }

func (r *ResponseError) IsNotFound() bool { return r.Status == http.StatusNotFound }

func (r *ResponseError) RunNoLongerLeased() bool {
	return r.IsNotFound() || errors.Is(r.Err, ErrUnauthorized)
}

func CheckLeaseLost(err error) bool {
	var rejection *ResponseError
	return errors.As(err, &rejection) && rejection.IsClientError() && rejection.Status != http.StatusConflict
}

func HasReason(err error, reason string) bool {
	var rejection *ResponseError
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
		return nil, fmt.Errorf("read what to look for: %w", err)
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

func (c *Client) ReplyToReviewComment(
	ctx context.Context, runID string, reply protocol.ReviewCommentReply,
) error {
	path := "/api/runs/" + runID + "/review-comment-replies"

	if err := c.do(ctx, http.MethodPost, path, reply, nil); err != nil {
		return fmt.Errorf("reply to a review comment: %w", err)
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
	ctx context.Context, runID string, request protocol.HistoryRequest,
) (json.RawMessage, error) {
	query := url.Values{"station": {request.Station}}
	for name, value := range map[string]string{
		"line": request.Line, "fingerprint": request.Fingerprint, "outcome": request.Outcome, "since": request.Since,
	} {
		if value != "" {
			query.Set(name, value)
		}
	}
	if request.Last > 0 {
		query.Set("last", strconv.Itoa(request.Last))
	}

	var out json.RawMessage
	path := fmt.Sprintf("/api/runs/%s/history?%s", url.PathEscape(runID), query.Encode())

	if err := c.do(ctx, http.MethodGet, path, nil, &out); err != nil {
		var rejection *ResponseError
		if errors.As(err, &rejection) && rejection.IsNotFound() {
			rejection.Message = unknownStation(request)
		}
		return nil, fmt.Errorf("read the history of %s: %w", request.Station, err)
	}

	return out, nil
}

func unknownStation(request protocol.HistoryRequest) string {
	if request.Line != "" {
		return fmt.Sprintf("line %q has no station %q in this team", request.Line, request.Station)
	}

	return fmt.Sprintf("no line in this team has a station %q", request.Station)
}

func (c *Client) RecallMemories(
	ctx context.Context, runID, words string,
) (json.RawMessage, error) {
	var out json.RawMessage
	path := fmt.Sprintf("/api/runs/%s/memories/recall", url.PathEscape(runID))
	body := struct {
		Words string `json:"words"`
	}{Words: words}

	if err := c.do(ctx, http.MethodPost, path, body, &out); err != nil {
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
		var rejection *ResponseError
		if errors.As(err, &rejection) {
			switch {
			case rejection.Message != "":
			case rejection.Status == http.StatusConflict:
				rejection.Message = "this iteration has proposed all the candidates it may, or this run is no longer the active run of the search"
			case rejection.IsNotFound():
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
		var rejection *ResponseError
		if errors.As(err, &rejection) {
			switch {
			case rejection.Message != "":
			case rejection.Status == http.StatusConflict:
				rejection.Message = "this run proposes candidates; only a run looking into why a search stalled records causes"
			case rejection.IsNotFound():
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
	body := protocol.HostCallClaim{Host: host}
	status, err := c.request(ctx, http.MethodPost, protocol.HostCallClaimPath, body, &call)
	if err != nil {
		return nil, fmt.Errorf("claim a call: %w", err)
	}
	if status == http.StatusNoContent {
		return nil, nil
	}
	if call.ID == "" || call.URL == "" {
		return nil, fmt.Errorf("claim a call: the control plane sent a call with no id or url")
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

func (c *Client) Messages(ctx context.Context, runID string) ([]protocol.Message, error) {
	path := fmt.Sprintf("/api/runs/%s/messages", url.PathEscape(runID))

	var messages []protocol.Message
	if err := c.do(ctx, http.MethodGet, path, nil, &messages); err != nil {
		return nil, fmt.Errorf("read the messages: %w", err)
	}

	return messages, nil
}

func (c *Client) AckMessages(ctx context.Context, runID string, upTo int) error {
	path := fmt.Sprintf("/api/runs/%s/messages/ack", url.PathEscape(runID))
	body := struct {
		UpTo int `json:"upTo"`
	}{UpTo: upTo}

	if err := c.do(ctx, http.MethodPost, path, body, nil); err != nil {
		return fmt.Errorf("acknowledge the messages: %w", err)
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

func (c *Client) AwaitsPerson(ctx context.Context, runID string, turn protocol.Completion) (bool, error) {
	path := fmt.Sprintf("/api/runs/%s/completion/awaits-person", url.PathEscape(runID))

	var answer protocol.TurnAwaitsPerson
	if err := c.do(ctx, http.MethodPost, path, turn, &answer); err != nil {
		return false, fmt.Errorf("read whether the turn waits for a person: %w", err)
	}

	return answer.AwaitsPerson, nil
}

func (c *Client) Suspend(ctx context.Context, runID string, requeue bool) (protocol.Suspension, error) {
	path := fmt.Sprintf("/api/runs/%s/suspended", url.PathEscape(runID))

	var suspension protocol.Suspension
	if err := c.do(ctx, http.MethodPost, path, protocol.SuspendRequest{Requeue: requeue}, &suspension); err != nil {
		return protocol.Suspension{}, fmt.Errorf("suspend: %w", err)
	}

	return suspension, nil
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
		return fmt.Errorf("fetch an attachment: %w", statusError(http.MethodGet, path, response))
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
		return nil, fmt.Errorf("read the workspace to restore: %w", err)
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
	body := protocol.ArchiveRequest{Size: size, SHA256: sha256}
	if err := c.do(ctx, http.MethodPost, path, body, &granted); err != nil {
		return protocol.ArchiveGrant{}, fmt.Errorf("request a workspace archive: %w", err)
	}

	return granted, nil
}

func (c *Client) SealArchive(ctx context.Context, runID, archiveID string) error {
	path := fmt.Sprintf(
		"/api/runs/%s/workspace-archive/%s/sealed",
		url.PathEscape(runID), url.PathEscape(archiveID),
	)

	if err := c.do(ctx, http.MethodPost, path, nil, nil); err != nil {
		return fmt.Errorf("seal the workspace archive: %w", err)
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

func (c *Client) GenerateChangeStack(ctx context.Context, runID, repository, diff, base string) error {
	path := fmt.Sprintf("/api/runs/%s/change-stacks", url.PathEscape(runID))
	request := protocol.ChangeStackGenerationRequest{Diff: diff, Repository: repository, Base: base}

	if err := c.do(ctx, http.MethodPost, path, request, nil); err != nil {
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

func (c *Client) FetchRunSecrets(ctx context.Context, recipient string) (protocol.EgressSecrets, error) {
	var fetched protocol.EgressSecrets
	body := protocol.EgressSecretsRequest{Recipient: recipient}
	if err := c.do(ctx, http.MethodPost, "/api/egress/secrets", body, &fetched); err != nil {
		return protocol.EgressSecrets{}, fmt.Errorf("fetch the run's secrets: %w", err)
	}

	return fetched, nil
}

func (c *Client) AuthorizeEgress(ctx context.Context, proxyCredential string) (protocol.EgressAuthorizeResponse, error) {
	var authorized protocol.EgressAuthorizeResponse
	body := protocol.EgressAuthorizeRequest{ProxyCredential: proxyCredential}
	if err := c.do(ctx, http.MethodPost, "/api/egress/authorize", body, &authorized); err != nil {
		return protocol.EgressAuthorizeResponse{}, fmt.Errorf("authorize a sandbox: %w", err)
	}

	return authorized, nil
}

func (c *Client) FetchRunSecretsFor(
	ctx context.Context, proxyCredential, recipient string,
) (protocol.EgressSecrets, error) {
	var fetched protocol.EgressSecrets
	body := protocol.EgressSecretsRequest{ProxyCredential: proxyCredential, Recipient: recipient}
	if err := c.do(ctx, http.MethodPost, "/api/egress/secrets", body, &fetched); err != nil {
		return protocol.EgressSecrets{}, fmt.Errorf("fetch a run's secrets: %w", err)
	}

	return fetched, nil
}

func (c *Client) ActiveRuns(ctx context.Context, proxyCredentials []string) ([]string, error) {
	var answer protocol.ActiveRunsResponse
	body := protocol.ActiveRunsRequest{ProxyCredentials: proxyCredentials}
	if err := c.do(ctx, http.MethodPost, "/api/egress/active-runs", body, &answer); err != nil {
		return nil, fmt.Errorf("read which runs are active: %w", err)
	}

	return answer.Active, nil
}

func (c *Client) RecordConnections(ctx context.Context, records []protocol.EgressConnection) error {
	body := protocol.EgressConnections{Records: records}
	if err := c.do(ctx, http.MethodPost, "/api/egress/connections", body, nil); err != nil {
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

	var errorBody struct {
		Reason  string                `json:"reason"`
		Message json.RawMessage       `json:"message"`
		Detail  string                `json:"detail"`
		Errors  []protocol.FieldError `json:"errors"`
	}
	_ = json.Unmarshal(read, &errorBody)

	detail := read
	if len(detail) > maxDetail {
		detail = detail[:maxDetail]
	}

	err := fmt.Errorf("%s %s: %s: %s", method, path, response.Status, strings.TrimSpace(string(detail)))
	if response.StatusCode == http.StatusUnauthorized || response.StatusCode == http.StatusForbidden {
		err = fmt.Errorf("%w: %w", ErrUnauthorized, err)
	}

	message := messageOf(errorBody.Message)
	if message == "" {
		message = errorBody.Detail
	}

	return &ResponseError{
		Status: response.StatusCode, Reason: errorBody.Reason, Message: message, Errors: errorBody.Errors, Err: err,
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

func statusError(method, path string, response *http.Response) error {
	detail, _ := io.ReadAll(io.LimitReader(response.Body, 1024))
	return fmt.Errorf(
		"%s %s: %s: %s",
		method, path, response.Status, strings.TrimSpace(string(detail)),
	)
}

func ForRun(baseURL string, assignment protocol.Assignment) (*Client, error) {
	client, err := New(baseURL, assignment.Token)
	if err != nil {
		return nil, err
	}

	client.runnerID = assignment.RunnerID
	return client, nil
}
