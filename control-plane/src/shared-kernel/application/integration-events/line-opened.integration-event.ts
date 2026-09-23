export const LINE_OPENED = 'work.line-opened.v1';

export type LineOpenedIntegrationEvent = {
  readonly kind: typeof LINE_OPENED;
  readonly lineId: string;
  readonly workspaceId: string;
  readonly teamId: string;
  readonly key: string;
};
