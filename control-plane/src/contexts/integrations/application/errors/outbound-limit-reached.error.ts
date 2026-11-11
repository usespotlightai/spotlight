import { outboundLimitReason } from '@integrations/domain/value-objects/hook-failure.vo';
import { UpstreamError } from '@shared-kernel/application/errors/upstream.error';

export const OUTBOUND_CALL = 'calling a service';

export class OutboundLimitReachedError extends UpstreamError {
  constructor(readonly perSecond: number) {
    super(OUTBOUND_CALL, outboundLimitReason(perSecond));
    this.name = 'OutboundLimitReachedError';
  }
}
