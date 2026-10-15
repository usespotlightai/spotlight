package trust

import (
	"fmt"
	"net/http"
	"os"
	"strings"

	"usespotlight.ai/data-plane/protocol"
)

type Workload struct {
	Trust     string
	TokenFile string
}

// Authorize reads the token file on each call. Platforms rotate a projected workload token in place.
func (w Workload) Authorize(request *http.Request) error {
	issued, err := os.ReadFile(w.TokenFile)
	if err != nil {
		return fmt.Errorf("read the workload token: %w", err)
	}

	token := strings.TrimSpace(string(issued))
	if token == "" {
		return fmt.Errorf("the workload token at %s is empty", w.TokenFile)
	}

	request.Header.Set("Authorization", "Bearer "+token)
	request.Header.Set(protocol.TrustHeader, w.Trust)

	return nil
}
