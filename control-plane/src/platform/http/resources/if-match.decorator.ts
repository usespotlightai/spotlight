import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import { ProblemException } from '@platform/http/resources/problem.exception';
import {
  headerIn,
  IF_MATCH_HEADER,
  type RequestHeaders,
  versionIn,
} from '@platform/http/resources/resource-headers';

export const IfMatch = createParamDecorator(
  (_data: unknown, context: ExecutionContext): number => {
    const { headers } = context
      .switchToHttp()
      .getRequest<{ headers: RequestHeaders }>();
    const held = headerIn(headers, IF_MATCH_HEADER);

    if (held === undefined) {
      throw ProblemException.preconditionRequired();
    }

    const version = versionIn(held);

    if (version === null) {
      throw ProblemException.malformedPrecondition(held);
    }

    return version;
  },
);
