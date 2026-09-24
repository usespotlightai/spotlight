import { HttpException, HttpStatus } from '@nestjs/common';
import type {
  ConfigurationProblem,
  ProblemSeverity,
} from '@shared-kernel/domain/value-objects/configuration-problem.vo';

export interface FieldError {
  readonly path: string;
  readonly message: string;
  readonly severity: ProblemSeverity;
}

export interface Problem {
  readonly type: string;
  readonly title: string;
  readonly status: number;
  readonly detail: string;
  readonly errors?: readonly FieldError[];
  readonly currentVersion?: number;
}

const TITLES: Readonly<Record<number, [slug: string, title: string]>> = {
  [HttpStatus.BAD_REQUEST]: ['bad-request', 'The request is malformed'],
  [HttpStatus.UNAUTHORIZED]: ['unauthenticated', 'No valid credentials'],
  [HttpStatus.FORBIDDEN]: ['forbidden', 'Not allowed'],
  [HttpStatus.NOT_FOUND]: ['not-found', 'No such resource'],
  [HttpStatus.CONFLICT]: [
    'conflict',
    'The request conflicts with the resource',
  ],
  [HttpStatus.UNPROCESSABLE_ENTITY]: ['invalid', 'The request is not valid'],
  [HttpStatus.PRECONDITION_REQUIRED]: [
    'precondition-required',
    'The request must be conditional',
  ],
  [HttpStatus.BAD_GATEWAY]: ['refused-upstream', 'An upstream service refused'],
};

const problemType = (slug: string): string => `urn:spotlight:problem:${slug}`;

export const fieldErrorOf = (problem: ConfigurationProblem): FieldError => ({
  path: problem.field.rendered,
  message: problem.reason,
  severity: problem.severity,
});

export class ProblemException extends HttpException {
  constructor(readonly problem: Problem) {
    super(problem, problem.status);
  }

  static withStatus(status: number, detail: string): ProblemException {
    const [slug, title] =
      TITLES[status] ??
      (status >= HttpStatus.INTERNAL_SERVER_ERROR
        ? ['server-fault', 'Something went wrong on our side']
        : ['error', 'The request failed']);

    return new ProblemException({
      type: problemType(slug),
      title,
      status,
      detail,
    });
  }

  static invalid(
    kind: string,
    problems: readonly ConfigurationProblem[],
  ): ProblemException {
    return new ProblemException({
      type: problemType('invalid'),
      title: `The ${kind} is not valid`,
      status: HttpStatus.UNPROCESSABLE_ENTITY,
      detail: problems
        .map(fieldErrorOf)
        .map((each) =>
          each.path ? `${each.path}: ${each.message}` : each.message,
        )
        .join('\n'),
      errors: problems.map(fieldErrorOf),
    });
  }

  static movedOn(kind: string, currentVersion: number): ProblemException {
    return new ProblemException({
      type: problemType('moved-on'),
      title: `The ${kind} changed since it was read`,
      status: HttpStatus.CONFLICT,
      detail: `The ${kind} is at version ${currentVersion}; read it again and send that version as If-Match`,
      currentVersion,
    });
  }

  static taken(kind: string, address: string): ProblemException {
    return new ProblemException({
      type: problemType('already-exists'),
      title: `The ${kind} already exists`,
      status: HttpStatus.CONFLICT,
      detail: `There is already a ${kind} at ${address}; import it rather than creating it`,
    });
  }

  static inUse(kind: string, detail: string): ProblemException {
    return new ProblemException({
      type: problemType('in-use'),
      title: `The ${kind} is still in use`,
      status: HttpStatus.CONFLICT,
      detail,
    });
  }

  static forbidden(kind: string): ProblemException {
    return new ProblemException({
      type: problemType('forbidden'),
      title: `Not allowed to change the ${kind}`,
      status: HttpStatus.FORBIDDEN,
      detail: `You may read this ${kind}, but your role in its workspace, or your token’s scopes, do not let you change it`,
    });
  }

  static notFound(kind: string): ProblemException {
    return new ProblemException({
      type: problemType('not-found'),
      title: `No such ${kind}`,
      status: HttpStatus.NOT_FOUND,
      detail: `There is no ${kind} here that you may see`,
    });
  }

  static preconditionRequired(): ProblemException {
    return new ProblemException({
      type: problemType('precondition-required'),
      title: 'The request must say which version it changes',
      status: HttpStatus.PRECONDITION_REQUIRED,
      detail:
        'Send the ETag of the version you read as If-Match, so a change made since is not overwritten',
    });
  }

  static malformedPrecondition(held: string): ProblemException {
    return new ProblemException({
      type: problemType('malformed-if-match'),
      title: 'If-Match names no version this API issued',
      status: HttpStatus.BAD_REQUEST,
      detail: `If-Match must be one ETag, as in "3", not ${held}`,
    });
  }

  static idempotencyKeyRequired(): ProblemException {
    return new ProblemException({
      type: problemType('idempotency-key-required'),
      title: 'A create must carry an Idempotency-Key',
      status: HttpStatus.BAD_REQUEST,
      detail:
        'Send a unique Idempotency-Key of 1 to 255 visible characters, and the same one when retrying',
    });
  }

  static idempotencyKeyReused(): ProblemException {
    return new ProblemException({
      type: problemType('idempotency-key-reused'),
      title: 'The Idempotency-Key was used for a different request',
      status: HttpStatus.UNPROCESSABLE_ENTITY,
      detail:
        'A retry must repeat the original request exactly; use a new key for a new request',
    });
  }

  static unsupportedApiVersion(
    asked: string,
    supported: readonly string[],
  ): ProblemException {
    return new ProblemException({
      type: problemType('unsupported-api-version'),
      title: 'This API version is not served here',
      status: HttpStatus.BAD_REQUEST,
      detail: `Asked for ${asked}; this server serves ${supported.join(', ')}`,
    });
  }
}
