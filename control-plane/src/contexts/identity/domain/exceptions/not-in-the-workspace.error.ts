export class NotInTheWorkspaceError extends Error {
  readonly violation = 'invalid' as const;

  constructor() {
    super(
      'This person is not a member of this workspace. Please invite them first.',
    );
    this.name = 'NotInTheWorkspaceError';
  }
}
