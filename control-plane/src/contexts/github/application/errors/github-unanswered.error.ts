import { UpstreamError } from '@shared-kernel/application/errors/upstream.error';

export class GitHubUnansweredError extends UpstreamError {
  constructor(
    request: string,
    readonly cause: unknown,
  ) {
    super(request, 'GitHub sent no answer');
    this.name = 'GitHubUnansweredError';
  }
}
