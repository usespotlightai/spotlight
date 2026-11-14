import { HttpException, HttpStatus } from '@nestjs/common';
import type { ForbiddenAct } from '@shared-kernel/application/dto/resource-outcomes.dto';
import type {
  ConfigurationProblem,
  ProblemSeverity,
} from '@shared-kernel/domain/value-objects/configuration-problem.vo';

const SERVER_ERROR: number = HttpStatus.INTERNAL_SERVER_ERROR;

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
  readonly permission?: ForbiddenAct;
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
  [HttpStatus.BAD_GATEWAY]: ['upstream-error', 'An upstream service failed'],
  [HttpStatus.SERVICE_UNAVAILABLE]: ['unavailable', 'The service is busy'],
};

const problemType = (slug: string): string => `urn:spotlight:problem:${slug}`;

export const fieldErrorOf = (problem: ConfigurationProblem): FieldError => ({
  path: problem.field.rendered,
  message: problem.reason,
  severity: problem.severity,
});

export interface ForbiddenRequest {
  readonly kind: string;
  readonly act: ForbiddenAct;
}

export class ProblemException extends HttpException {
  constructor(
    readonly problem: Problem,
    readonly forbiddenRequest: ForbiddenRequest | null = null,
  ) {
    super(problem, problem.status);
  }

  static of(problem: {
    readonly slug: string;
    readonly title: string;
    readonly status: number;
    readonly detail: string;
  }): ProblemException {
    return new ProblemException({
      type: problemType(problem.slug),
      title: problem.title,
      status: problem.status,
      detail: problem.detail,
    });
  }

  static withStatus(status: number, detail: string): ProblemException {
    const [slug, title] =
      TITLES[status] ??
      (status >= SERVER_ERROR
        ? ['internal-error', 'The server failed']
        : ['error', 'The request failed']);

    return ProblemException.of({ slug, title, status, detail });
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

  static versionConflict(
    kind: string,
    currentVersion: number,
  ): ProblemException {
    return new ProblemException({
      type: problemType('version-conflict'),
      title: `The ${kind} changed since it was read`,
      status: HttpStatus.CONFLICT,
      detail: `The ${kind} changed since you read it. Please send the current version as If-Match. Current version: ${currentVersion}`,
      currentVersion,
    });
  }

  static alreadyExists(kind: string, address: string): ProblemException {
    return new ProblemException({
      type: problemType('already-exists'),
      title: `The ${kind} already exists`,
      status: HttpStatus.CONFLICT,
      detail: `A ${kind} already exists at ${address}. Please import it instead.`,
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

  static forbidden(kind: string, act: ForbiddenAct): ProblemException {
    return new ProblemException(
      {
        type: problemType('forbidden'),
        title: `Not allowed to ${act}`,
        status: HttpStatus.FORBIDDEN,
        detail: `You may not ${act} this ${kind}.`,
        permission: act,
      },
      { kind, act },
    );
  }

  static notFound(
    kind: string,
    detail = `${kind.charAt(0).toUpperCase()}${kind.slice(1)} not found.`,
  ): ProblemException {
    return new ProblemException({
      type: problemType('not-found'),
      title: `No such ${kind}`,
      status: HttpStatus.NOT_FOUND,
      detail,
    });
  }

  static preconditionRequired(): ProblemException {
    return new ProblemException({
      type: problemType('precondition-required'),
      title: 'The request must say which version it changes',
      status: HttpStatus.PRECONDITION_REQUIRED,
      detail:
        'If-Match is missing. Please send the ETag of the version you read.',
    });
  }

  static malformedPrecondition(received: string): ProblemException {
    return new ProblemException({
      type: problemType('malformed-if-match'),
      title: 'If-Match names no version this API issued',
      status: HttpStatus.BAD_REQUEST,
      detail: `If-Match must be one ETag, such as "3". Received: ${received}`,
    });
  }

  static idempotencyKeyRequired(): ProblemException {
    return new ProblemException({
      type: problemType('idempotency-key-required'),
      title: 'A create must carry an Idempotency-Key',
      status: HttpStatus.BAD_REQUEST,
      detail:
        'Idempotency-Key is missing. Please send a unique key of 1 to 255 visible characters.',
    });
  }

  static idempotencyKeyReused(): ProblemException {
    return new ProblemException({
      type: problemType('idempotency-key-reused'),
      title: 'The Idempotency-Key was used for a different request',
      status: HttpStatus.UNPROCESSABLE_ENTITY,
      detail:
        'A retry must repeat the original request exactly. Please use a new key for a new request.',
    });
  }

  static unsupportedApiVersion(
    requested: string,
    supported: readonly string[],
  ): ProblemException {
    return new ProblemException({
      type: problemType('unsupported-api-version'),
      title: 'This API version is not served here',
      status: HttpStatus.BAD_REQUEST,
      detail: `API version ${requested} is not supported. Supported versions: ${supported.join(', ')}`,
    });
  }
}
