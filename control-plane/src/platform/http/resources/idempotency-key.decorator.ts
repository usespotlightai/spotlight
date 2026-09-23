import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import { ProblemException } from '@platform/http/resources/problem.exception';
import {
  headerIn,
  IDEMPOTENCY_KEY_HEADER,
  type RequestHeaders,
} from '@platform/http/resources/resource-headers';
import { IdempotencyKey } from '@shared-kernel/domain/value-objects/idempotency-key.vo';

export const IdempotencyKeyHeader = createParamDecorator(
  (_data: unknown, context: ExecutionContext): string => {
    const { headers } = context
      .switchToHttp()
      .getRequest<{ headers: RequestHeaders }>();

    try {
      return IdempotencyKey.of(headerIn(headers, IDEMPOTENCY_KEY_HEADER) ?? '')
        .value;
    } catch {
      throw ProblemException.idempotencyKeyRequired();
    }
  },
);
