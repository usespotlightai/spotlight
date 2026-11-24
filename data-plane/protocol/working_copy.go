package protocol

import "regexp"

// When its pool or trust keeps working copies in a store of its hosts, the host opens the sandbox's workspace from
// that store with its working copy hook, and the runner saves each archive as a snapshot that the host makes,
// instead of uploading a tar.
const (
	// WorkingCopyStoreVar names the store the host keeps the workspace in; unset when the runner archives tars.
	WorkingCopyStoreVar = "SPOTLIGHT_WORKING_COPY_STORE"
	// WorkingCopyRestoredVar is the archive the host opened the workspace from.
	WorkingCopyRestoredVar = "SPOTLIGHT_WORKING_COPY_RESTORED"
	// WorkingCopyBaseVar is the base snapshot the workspace descends from, unset for one that started without a base.
	WorkingCopyBaseVar = "SPOTLIGHT_WORKING_COPY_BASE"
	// WorkingCopyRebaseVar is the archive the run rebases from: the host opened the workspace from the store's current
	// base instead, as the control plane said.
	WorkingCopyRebaseVar = "SPOTLIGHT_WORKING_COPY_REBASE"
)

// SandboxWorkspace is the workspace of a sandbox, where the host mounts the working copy.
const SandboxWorkspace = "/workspace"

// The host serves the sandbox on a socket in this directory, which it mounts into the sandbox.
const (
	SandboxHostDir    = "/spotlight/host"
	SandboxHostSocket = SandboxHostDir + "/host.sock"
)

// The runner asks the host to make the snapshot of an archive the control plane granted.
const HostSnapshotPath = "/working-copy/snapshots"

type HostSnapshotRequest struct {
	Snapshot string `json:"snapshot"`
}

// spotlightSnapshot is the name of a snapshot Spotlight grants: spotlight- and the archive's id, as the control plane
// shapes archive ids (WorkingCopyArchiveId). No such name holds a slash, a dot or a space.
var spotlightSnapshot = regexp.MustCompile(`^spotlight-[A-Za-z0-9_-]{1,64}$`)

// IsSpotlightSnapshot says whether name is the name of a snapshot of an archive that Spotlight grants.
func IsSpotlightSnapshot(name string) bool {
	return spotlightSnapshot.MatchString(name)
}
