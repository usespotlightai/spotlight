package prepare

import (
	"testing"
	"time"
)

func SetRetryDelays(t testing.TB, delays ...time.Duration) {
	t.Helper()

	previous := retryDelays
	retryDelays = delays
	t.Cleanup(func() { retryDelays = previous })
}
