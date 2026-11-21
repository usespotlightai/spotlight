package session

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"maps"
	"slices"
	"strings"

	"usespotlight.ai/data-plane/egresskit/inject"
	"usespotlight.ai/data-plane/protocol"
)

func variableProblem(name string) string {
	switch {
	case name == "" || strings.ContainsAny(name, "=\x00"):
		return fmt.Sprintf("%q is not a name an environment variable can have", name)
	case protocol.SetByTheRunner(name):
		return fmt.Sprintf("the runner sets %s itself, so no secret may take its place", name)
	}
	return ""
}

func secretRefused(secret, reason string) error {
	return fmt.Errorf("Secret %s could not be put in the sandbox: %s", secret, reason)
}

type sandboxEnv struct {
	values   map[string]string
	redactor *inject.Redactor
}

func (o Options) sandboxEnv(ctx context.Context, run protocol.Run) (sandboxEnv, error) {
	if len(run.Spec.SandboxEnv) == 0 {
		return sandboxEnv{}, nil
	}

	secretOf := make(map[string]string, len(run.Spec.SandboxEnv))
	var refused []error
	for _, each := range run.Spec.SandboxEnv {
		if problem := variableProblem(each.Variable); problem != "" {
			refused = append(refused, secretRefused(each.Secret, problem))
			continue
		}
		secretOf[each.Variable] = each.Secret
	}
	if len(refused) > 0 {
		return sandboxEnv{}, errors.Join(refused...)
	}

	fetched, err := o.Journal.SandboxEnv(ctx, run.ID, run.Attempt)
	if err != nil {
		return sandboxEnv{}, err
	}

	for _, denied := range fetched.Denied {
		refused = append(refused, secretRefused(denied.Secret, denied.Reason))
	}

	values := make(map[string]string, len(fetched.Variables))
	standIns := make(map[string]string, len(fetched.Variables))
	for _, variable := range fetched.Variables {
		secret, asked := secretOf[variable.Name]
		if !asked {
			refused = append(refused, fmt.Errorf("Spotlight sent a value for %s, which the run did not ask for", variable.Name))
			continue
		}
		if strings.Contains(variable.Value, "\x00") {
			refused = append(refused, secretRefused(secret, "its value holds a NUL byte, which no environment variable can hold"))
			continue
		}
		values[variable.Name] = variable.Value
		standIns[secret] = variable.Value
	}
	if len(refused) > 0 {
		return sandboxEnv{}, errors.Join(refused...)
	}

	return sandboxEnv{values: values, redactor: inject.RedactorOf(standIns)}, nil
}

func (s sandboxEnv) fingerprint() string {
	if len(s.values) == 0 {
		return ""
	}
	hash := sha256.New()
	for _, name := range slices.Sorted(maps.Keys(s.values)) {
		fmt.Fprintf(hash, "%s=%s\x00", name, s.values[name])
	}
	return hex.EncodeToString(hash.Sum(nil))
}

func (s sandboxEnv) over(env map[string]string) map[string]string {
	with := make(map[string]string, len(s.values)+len(env))
	maps.Copy(with, s.values)
	maps.Copy(with, env)
	return with
}

func redactedEvent(redactor *inject.Redactor, event protocol.Event) protocol.Event {
	event.Message = redactor.Text(event.Message)
	event.Data = redactedJSON(redactor, event.Data)
	return event
}

func redactedJSON(redactor *inject.Redactor, data []byte) []byte {
	if len(data) == 0 || bytes.Equal(redactor.Bytes(data), data) {
		return data
	}
	if !json.Valid(data) {
		return redactor.Bytes(data)
	}

	decoder := json.NewDecoder(bytes.NewReader(data))
	decoder.UseNumber()
	var value any
	if decoder.Decode(&value) != nil {
		return redactor.Bytes(data)
	}

	var written bytes.Buffer
	encoder := json.NewEncoder(&written)
	encoder.SetEscapeHTML(false)
	if encoder.Encode(redactedValue(redactor, value)) != nil {
		return redactor.Bytes(data)
	}

	return bytes.TrimSuffix(written.Bytes(), []byte("\n"))
}

func redactedValue(redactor *inject.Redactor, value any) any {
	switch value := value.(type) {
	case string:
		return redactor.Text(value)
	case []any:
		for at, each := range value {
			value[at] = redactedValue(redactor, each)
		}
		return value
	case map[string]any:
		redacted := make(map[string]any, len(value))
		for key, each := range value {
			redacted[redactor.Text(key)] = redactedValue(redactor, each)
		}
		return redacted
	}
	return value
}

func redactedError(redactor *inject.Redactor, err error) error {
	if err == nil {
		return nil
	}
	if text := redactor.Text(err.Error()); text != err.Error() {
		return errors.New(text)
	}
	return err
}

type redactingJournal struct {
	Journal
	redactor *inject.Redactor
}

func (r redactingJournal) Complete(ctx context.Context, runID string, done protocol.Completion) error {
	done.Message = r.redactor.Text(done.Message)
	if done.Handover != nil {
		handover := *done.Handover
		handover.Next = r.redactor.Text(handover.Next)
		handover.Note = r.redactor.Text(handover.Note)
		handover.Suggest = r.redactor.Text(handover.Suggest)
		done.Handover = &handover
	}
	return r.Journal.Complete(ctx, runID, done)
}

func (r redactingJournal) AskPermission(
	ctx context.Context, runID string, asked protocol.PermissionRequest,
) (protocol.PermissionResponse, error) {
	asked.Title = r.redactor.Text(asked.Title)
	asked.Input = redactedJSON(r.redactor, asked.Input)
	return r.Journal.AskPermission(ctx, runID, asked)
}

func (r redactingJournal) Trace(ctx context.Context, runID, taskID string) (json.RawMessage, error) {
	return r.Journal.Trace(ctx, runID, r.redactor.Text(taskID))
}

func (r redactingJournal) History(ctx context.Context, runID string, request protocol.HistoryRequest) (json.RawMessage, error) {
	request.Station = r.redactor.Text(request.Station)
	request.Line = r.redactor.Text(request.Line)
	request.Fingerprint = r.redactor.Text(request.Fingerprint)
	request.Outcome = r.redactor.Text(request.Outcome)
	request.Since = r.redactor.Text(request.Since)
	return r.Journal.History(ctx, runID, request)
}

func (r redactingJournal) RecallMemory(ctx context.Context, runID, handle string) (json.RawMessage, error) {
	return r.Journal.RecallMemory(ctx, runID, r.redactor.Text(handle))
}

func (r redactingJournal) RecallMemories(ctx context.Context, runID, words string) (json.RawMessage, error) {
	return r.Journal.RecallMemories(ctx, runID, r.redactor.Text(words))
}

func (r redactingJournal) Remember(
	ctx context.Context, runID string, remembered protocol.RememberRequest,
) (json.RawMessage, error) {
	remembered.Body = r.redactor.Text(remembered.Body)
	return r.Journal.Remember(ctx, runID, remembered)
}

func (r redactingJournal) UseTool(ctx context.Context, runID, name string, input json.RawMessage) (json.RawMessage, error) {
	return r.Journal.UseTool(ctx, runID, name, redactedJSON(r.redactor, input))
}

func (r redactingJournal) GenerateChangeStack(ctx context.Context, runID, repository, diff, base string) error {
	return r.Journal.GenerateChangeStack(ctx, runID, repository, r.redactor.Text(diff), base)
}

func (r redactingJournal) ProposeCandidate(
	ctx context.Context, runID string, proposal protocol.CandidateProposal,
) (json.RawMessage, error) {
	proposal.Name = r.redactor.Text(proposal.Name)
	proposal.Hypothesis = r.redactor.Text(proposal.Hypothesis)
	proposal.Station = redactedJSON(r.redactor, proposal.Station)
	return r.Journal.ProposeCandidate(ctx, runID, proposal)
}

func (r redactingJournal) RecordCause(ctx context.Context, runID string, record protocol.CauseRecord) (json.RawMessage, error) {
	record.Cause = r.redactor.Text(record.Cause)
	record.Evidence = r.redactor.Text(record.Evidence)
	record.Suggestion = r.redactor.Text(record.Suggestion)
	return r.Journal.RecordCause(ctx, runID, record)
}

func (r redactingJournal) ReplyToReviewComment(ctx context.Context, runID string, reply protocol.ReviewCommentReply) error {
	reply.Body = r.redactor.Text(reply.Body)
	return r.Journal.ReplyToReviewComment(ctx, runID, reply)
}
