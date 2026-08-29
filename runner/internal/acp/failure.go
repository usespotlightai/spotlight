package acp

import "errors"

// CodeNotFound is what a harness answers when asked for a session it does not
// hold. It is worth telling apart from every other refusal: a run whose
// session has gone still has its work to do, and can do it in a new one.
const CodeNotFound = -32002

// Failure is an error the harness answered with, kept whole so the caller can
// tell one refusal from another.
type Failure struct {
	Method  string
	Code    int
	Message string
}

func (f *Failure) Error() string {
	return f.Method + ": " + f.Message
}

// Forgotten says whether an error is the harness not knowing a session.
func Forgotten(err error) bool {
	var failure *Failure
	return errors.As(err, &failure) && failure.Code == CodeNotFound
}
