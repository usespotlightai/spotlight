import { UpstreamError } from '@shared-kernel/application/errors/upstream.error';

export class OutboundLimitReachedError extends UpstreamError {
  constructor(readonly perSecond: number) {
    super(
      'calling a service',
      `this workspace sends more than ${perSecond} requests each second to other services`,
    );
    this.name = 'OutboundLimitReachedError';
  }
}
