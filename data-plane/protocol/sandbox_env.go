package protocol

import (
	"regexp"
	"slices"
	"strings"
	"unicode"
)

const EnvironmentVariableNamePattern = `^[A-Za-z_][A-Za-z0-9_]*$`

var environmentVariableName = regexp.MustCompile(EnvironmentVariableNamePattern)

func IsEnvironmentVariableName(name string) bool {
	return environmentVariableName.MatchString(name)
}

var RunnerVariables = []string{
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

const SandboxValueMinLength = 8

func FitsSandbox(value string) bool {
	if strings.Contains(value, "\x00") {
		return false
	}
	length := 0
	for _, r := range value {
		if !unicode.IsSpace(r) {
			length++
		}
	}
	return length >= SandboxValueMinLength
}

func IsRunnerVariable(variable string) bool {
	upper := strings.ToUpper(variable)
	return slices.Contains(RunnerVariables, upper) || strings.HasPrefix(upper, RunnerVariablePrefix)
}
