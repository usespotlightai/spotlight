export class NotInTheWorkspaceError extends Error {
  readonly violation = 'invalid' as const;

  constructor() {
    super(
      'Sorry, this person is not a member of this workspace. Please invite them first.',
    );
    this.name = 'NotInTheWorkspaceError';
  }
}
