import type {
  Happened,
  RepositoryEventsPort,
} from '@application/ports/repository-events.port';
import { UpstreamRefusedError } from '@domain/exceptions/upstream-refused.error';
import { Concerns } from '@domain/value-objects/concerns.vo';
import type { Happening } from '@domain/value-objects/happening.vo';
import { Said } from '@domain/value-objects/said.vo';
import { Injectable } from '@nestjs/common';

/** The little of GitHub's delivery that Spotlight reads. */
interface Delivery {
  readonly action?: unknown;
  readonly pull_request?: Pull;
  readonly issue?: { readonly pull_request?: { readonly html_url?: unknown } };
  readonly comment?: Remark;
  readonly review?: Remark & { readonly state?: unknown };
  readonly check_suite?: {
    readonly conclusion?: unknown;
    readonly head_branch?: unknown;
    readonly pull_requests?: readonly { readonly html_url?: unknown }[];
  };
  readonly sender?: { readonly type?: unknown };
}

interface Pull {
  readonly merged?: unknown;
  readonly html_url?: unknown;
  readonly head?: { readonly ref?: unknown };
}

interface Remark {
  readonly node_id?: unknown;
  readonly body?: unknown;
  readonly user?: { readonly type?: unknown };
  readonly path?: unknown;
  readonly line?: unknown;
  readonly original_line?: unknown;
  readonly start_line?: unknown;
  readonly original_start_line?: unknown;
}

const text = (value: unknown): string | null =>
  typeof value === 'string' && value.trim().length > 0 ? value : null;

/** A run's own comment is not news: acting on it would start another run. */
const at = (value: unknown): number | null =>
  typeof value === 'number' && Number.isInteger(value) ? value : null;

const spoken = (remark: Remark | undefined): Said | null =>
  remark
    ? Said.of({
        body: text(remark.body),
        path: text(remark.path),
        from:
          at(remark.start_line) ?? at(remark.line) ?? at(remark.original_line),
        to:
          at(remark.start_line) !== null
            ? (at(remark.line) ?? at(remark.original_line))
            : null,
        remark: text(remark.node_id),
      })
    : null;

const byUs = (delivered: Delivery): boolean =>
  delivered.sender?.type === 'Bot' ||
  delivered.comment?.user?.type === 'Bot' ||
  delivered.review?.user?.type === 'Bot';

@Injectable()
export class GitHubRepositoryEvents implements RepositoryEventsPort {
  read(event: string | undefined, payload: unknown): Happened | null {
    const delivered = (payload ?? {}) as Delivery;
    const happening = this.happening(event, delivered);

    if (!happening) {
      return null;
    }

    const concerns = Concerns.of({
      branch:
        text(delivered.pull_request?.head?.ref) ??
        text(delivered.check_suite?.head_branch),
      pullRequest:
        text(delivered.pull_request?.html_url) ??
        text(delivered.issue?.pull_request?.html_url) ??
        text(delivered.check_suite?.pull_requests?.[0]?.html_url),
    });

    // Refused rather than dropped, so the host sends it again.
    if (!concerns) {
      throw new UpstreamRefusedError(
        `reading a ${event} delivery`,
        'it names neither a branch nor a pull request',
      );
    }

    return {
      happening,
      concerns,
      said: spoken(delivered.comment) ?? spoken(delivered.review),
      ourOwn: byUs(delivered),
    };
  }

  private happening(
    event: string | undefined,
    delivered: Delivery,
  ): Happening | null {
    if (event === 'pull_request' && delivered.action === 'closed') {
      // Closed and merged are separate facts.
      return delivered.pull_request?.merged === true
        ? 'merged'
        : 'closed-unmerged';
    }

    if (event === 'pull_request_review') {
      return delivered.review?.state === 'changes_requested'
        ? 'changes-requested'
        : delivered.action === 'submitted'
          ? 'commented'
          : null;
    }

    if (
      (event === 'issue_comment' || event === 'pull_request_review_comment') &&
      delivered.action === 'created'
    ) {
      return 'commented';
    }

    if (event === 'check_suite' && delivered.action === 'completed') {
      return delivered.check_suite?.conclusion === 'failure'
        ? 'checks-failed'
        : null;
    }

    return null;
  }
}
