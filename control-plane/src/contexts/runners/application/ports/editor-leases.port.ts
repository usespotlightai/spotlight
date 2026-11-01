export const EDITOR_LEASES = Symbol('EDITOR_LEASES');

export interface EditorLease {
  readonly sandboxId: string;
  readonly holder: string;
}

export interface EditorLeasesPort {
  hold(workspaceId: string, key: string): Promise<EditorLease>;
}
