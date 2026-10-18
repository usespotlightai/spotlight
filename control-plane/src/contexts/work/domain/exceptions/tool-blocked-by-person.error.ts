export class ToolBlockedByPersonError extends Error {
  readonly kind = 'not-allowed' as const;

  constructor(tool: string, person: string) {
    super(
      `${tool} was not used, so nothing was sent: ${person || 'the person it acts as'} blocks it on calls made with their connection.`,
    );
    this.name = 'ToolBlockedByPersonError';
  }
}
