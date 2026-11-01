export const OUTBOUND_LIMITS = Symbol('OUTBOUND_LIMITS');

export interface OutboundLimitsPort {
  readonly perSecond: number;

  take(workspaceId: string): Promise<boolean>;
}
