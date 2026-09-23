export const LINE_RETIRED = 'work.line-retired.v1';

export type LineRetiredIntegrationEvent = {
  readonly kind: typeof LINE_RETIRED;
  readonly lineId: string;
  readonly workspaceId: string;
  readonly teamId: string;
  readonly key: string;
};
