package protocol

import (
	"slices"
	"strings"
)

var RunnerSetVariables = []string{
	"ALL_PROXY",
	"COLORTERM",
	"CURL_CA_BUNDLE",
	"GIT_SSL_CAINFO",
	"HOME",
	"HTTPS_PROXY",
	"HTTP_PROXY",
	"LOGNAME",
	"NODE_EXTRA_CA_CERTS",
	"NODE_USE_ENV_PROXY",
	"NO_PROXY",
	"PATH",
	"REQUESTS_CA_BUNDLE",
	"SHELL",
	"SSL_CERT_DIR",
	"SSL_CERT_FILE",
	"TERM",
	"USER",
}

const RunnerVariablePrefix = "SPOTLIGHT_"

func SetByTheRunner(variable string) bool {
	upper := strings.ToUpper(variable)
	return slices.Contains(RunnerSetVariables, upper) || strings.HasPrefix(upper, RunnerVariablePrefix)
}
