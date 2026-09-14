package acp

import "errors"

// A harness answers session/load for a session it does not hold with this code.
const CodeNotFound = -32002

type Failure struct {
	Method  string
	Code    int
	Message string
}

func (f *Failure) Error() string {
	return f.Method + ": " + f.Message
}

func Forgotten(err error) bool {
	var failure *Failure
	return errors.As(err, &failure) && failure.Code == CodeNotFound
}
