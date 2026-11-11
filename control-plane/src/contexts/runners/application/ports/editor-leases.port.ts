export const EDITOR_LEASES = Symbol('EDITOR_LEASES');

interface EditorLease {
  readonly sandboxId: string;
  readonly holder: string;
}

export interface EditorLeasesPort {
  hold(workspaceId: string, key: string): Promise<EditorLease>;
}
