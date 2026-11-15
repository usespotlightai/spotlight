package protocol

// SetupRecordPath is where a warm sandbox records the setups it ran, so a sandbox started from its committed image
// skips the setups whose inputs did not change.
const SetupRecordPath = "/var/lib/spotlight/setups.json"

type SetupRecord struct {
	Checkouts map[string]string `json:"checkouts"`
	Complete  bool              `json:"complete"`
	Ran       bool              `json:"ran"`
}
