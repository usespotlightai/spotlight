export class OutboundRefusedError extends Error {
  readonly violation = 'not-allowed' as const;

  constructor(host: string, reason: string) {
    super(`Outbound call to ${host} refused. ${reason}`);
    this.name = 'OutboundRefusedError';
  }
}
