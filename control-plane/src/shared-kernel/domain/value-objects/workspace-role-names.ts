// The names of the roles that a person can have in a workspace. The identity context decides what each role may do. The shared kernel only names them, so that the platform and the integration events use the same names as identity.
export const WORKSPACE_ROLE_NAMES = ['owner', 'admin', 'member'] as const;

export type WorkspaceRoleName = (typeof WORKSPACE_ROLE_NAMES)[number];
