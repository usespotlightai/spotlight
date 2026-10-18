package protocol

const (
	SeverityError   = "error"
	SeverityWarning = "warning"
)

type FieldError struct {
	Path     string `json:"path"`
	Message  string `json:"message"`
	Severity string `json:"severity"`
}

type FieldErrors struct {
	Errors []FieldError `json:"errors"`
}

func HasErrors(errors []FieldError) bool {
	for _, each := range errors {
		if each.Severity == SeverityError {
			return true
		}
	}

	return false
}
