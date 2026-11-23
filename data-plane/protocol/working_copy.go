package protocol

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
	// WorkingCopyRebasedVar is the archive the host did not open from, as the run starts from the current base instead.
	WorkingCopyRebasedVar = "SPOTLIGHT_WORKING_COPY_REBASED"
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
