import { createHash } from 'node:crypto';
import type { WebhookSignaturePort } from '@application/ports/webhook-signature.port';
import type {
  Delivered,
  Happened,
  HappeningDeclaration,
  Noticed,
  WebhookHeaders,
  WebhookSourcePort,
} from '@application/ports/webhook-source.port';
import { UpstreamRefusedError } from '@domain/exceptions/upstream-refused.error';
import type { WorkspaceConnections } from '@domain/repositories/workspace.repository';
import { Concerns } from '@domain/value-objects/concerns.vo';
import { GitHubInstallation } from '@domain/value-objects/github-installation.vo';
import { Happening } from '@domain/value-objects/happening.vo';
import { Mark } from '@domain/value-objects/mark.vo';
import { PullRequestUrl } from '@domain/value-objects/pull-request-url.vo';
import { Said } from '@domain/value-objects/said.vo';
import type { WorkspaceId } from '@domain/value-objects/workspace-id.vo';
import { WebhookSource } from '@infrastructure/webhooks/webhook-source.decorator';

/** The little of GitHub's delivery that Spotlight reads. */
interface Delivery {
  readonly action?: unknown;
  readonly installation?: { readonly id?: unknown };
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
  readonly ref?: unknown;
  readonly repository?: {
    readonly full_name?: unknown;
    readonly default_branch?: unknown;
  };
  readonly commits?: readonly {
    readonly added?: readonly unknown[];
    readonly removed?: readonly unknown[];
    readonly modified?: readonly unknown[];
  }[];
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

const remarked = (remark: Remark | undefined): Said | null =>
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

/** GitHub numbers an installation, and sends it on every App delivery. */
const named = (value: unknown): GitHubInstallation | null =>
  typeof value === 'number' || typeof value === 'string'
    ? GitHubInstallation.of(String(value))
    : null;

const byUs = (delivered: Delivery): boolean =>
  delivered.sender?.type === 'Bot' ||
  delivered.comment?.user?.type === 'Bot' ||
  delivered.review?.user?.type === 'Bot';

const headed = (headers: WebhookHeaders, name: string): string | undefined => {
  const value = headers[name];

  return Array.isArray(value) ? value[0] : value;
};

const raised = (input: {
  key: string;
  label: string;
  told: string;
  spoken?: boolean;
}): HappeningDeclaration => ({
  happening: Happening.of(input.key),
  label: input.label,
  told: input.told,
  spoken: input.spoken ?? false,
});

/** Where a workspace keeps what it tells Spotlight about itself. */
const UNDER = '.spotlight/';

/** Everything the reading below can raise, and nothing it cannot. */
const MERGED = raised({
  key: 'github.pull_request.merged',
  label: 'Pull request merged',
  told: 'The pull request was merged.',
});

const COMMENTED = raised({
  key: 'github.pull_request.commented',
  label: 'Pull request commented on',
  told: 'The pull request was commented on.',
  spoken: true,
});

const CHANGES_REQUESTED = raised({
  key: 'github.pull_request.changes-requested',
  label: 'Changes requested',
  told: 'Changes were requested on the pull request.',
  spoken: true,
});

const CHECKS_FAILED = raised({
  key: 'github.checks.failed',
  label: 'Checks failed',
  told: 'The checks failed on the pull request.',
});

const CLOSED_UNMERGED = raised({
  key: 'github.pull_request.closed-unmerged',
  label: 'Pull request closed unmerged',
  told: 'The pull request was closed without being merged.',
});

@WebhookSource()
export class GitHubSource implements WebhookSourcePort {
  readonly key = 'github';

  readonly happenings: readonly HappeningDeclaration[] = [
    MERGED,
    COMMENTED,
    CHANGES_REQUESTED,
    CHECKS_FAILED,
    CLOSED_UNMERGED,
  ];

  constructor(
    private readonly signature: WebhookSignaturePort,
    private readonly workspaces: WorkspaceConnections,
  ) {}

  async verifies(delivered: Delivered): Promise<boolean> {
    return (
      delivered.raw !== null &&
      this.signature.signs(
        delivered.raw,
        headed(delivered.headers, 'x-hub-signature-256'),
      )
    );
  }

  delivery(delivered: Delivered): string {
    // GitHub names every delivery. The hash is for nothing in particular:
    // without one, the same word twice would be worked twice.
    return (
      headed(delivered.headers, 'x-github-delivery') ??
      createHash('sha256')
        .update(delivered.raw ?? Buffer.from(''))
        .digest('hex')
    );
  }

  async routes(delivered: Delivered): Promise<WorkspaceId | null> {
    const installation = named(
      ((delivered.body ?? {}) as Delivery).installation?.id,
    );

    return installation
      ? this.workspaces.withConnection(this.key, installation.value)
      : null;
  }

  /**
   * What a delivery said about the workspace rather than about a task: a
   * configuration file that moved, or the installation itself going away.
   */
  noticed(delivered: Delivered): readonly Noticed[] {
    const event = headed(delivered.headers, 'x-github-event');
    const body = (delivered.body ?? {}) as Delivery;
    const repository = text(body.repository?.full_name);
    const branch = text(body.repository?.default_branch);

    // Uninstalled, or every repository taken off it, which reaches Spotlight
    // the same way and leaves it able to read nothing either way.
    if (event === 'installation' && body.action === 'deleted') {
      const installation = named(body.installation?.id);

      return installation
        ? [
            {
              kind: 'connection-ended',
              source: this.key,
              externalId: installation.value,
            },
          ]
        : [];
    }

    if (
      event !== 'push' ||
      !repository ||
      !branch ||
      body.ref !== `refs/heads/${branch}`
    ) {
      return [];
    }

    const touched = (body.commits ?? []).some((commit) =>
      [
        ...(commit.added ?? []),
        ...(commit.removed ?? []),
        ...(commit.modified ?? []),
      ].some((path) => typeof path === 'string' && path.startsWith(UNDER)),
    );

    return touched ? [{ kind: 'configuration-touched', repository }] : [];
  }

  async read(delivered: Delivered): Promise<readonly Happened[]> {
    const event = headed(delivered.headers, 'x-github-event');
    const body = (delivered.body ?? {}) as Delivery;
    const happening = this.happening(event, body);

    if (!happening) {
      return [];
    }

    return [this.happened(event, happening, body)];
  }

  private happened(
    event: string | undefined,
    raising: HappeningDeclaration,
    delivered: Delivery,
  ): Happened {
    const opened =
      text(delivered.pull_request?.html_url) ??
      text(delivered.issue?.pull_request?.html_url) ??
      text(delivered.check_suite?.pull_requests?.[0]?.html_url);

    const concerns = Concerns.of({
      branch:
        text(delivered.pull_request?.head?.ref) ??
        text(delivered.check_suite?.head_branch),
      marks: opened ? [Mark.pullRequest(PullRequestUrl.of(opened))] : [],
    });

    // Refused rather than dropped, so the host sends it again.
    if (!concerns) {
      throw new UpstreamRefusedError(
        `reading a ${event} delivery`,
        'it names neither a branch nor a pull request',
      );
    }

    return {
      happening: raising.happening,
      told: raising.told,
      spoken: raising.spoken,
      // Everything GitHub raises here happens once. Nothing it says clears
      // itself again later, the way an alert does.
      state: 'raised',
      concerns,
      said: remarked(delivered.comment) ?? remarked(delivered.review),
      ourOwn: byUs(delivered),
      // GitHub answers work that already has a task; it opens none of its own.
      opens: null,
    };
  }

  private happening(
    event: string | undefined,
    delivered: Delivery,
  ): HappeningDeclaration | null {
    if (event === 'pull_request' && delivered.action === 'closed') {
      // Closed and merged are separate facts.
      return delivered.pull_request?.merged === true ? MERGED : CLOSED_UNMERGED;
    }

    if (event === 'pull_request_review') {
      return delivered.review?.state === 'changes_requested'
        ? CHANGES_REQUESTED
        : delivered.action === 'submitted'
          ? COMMENTED
          : null;
    }

    if (
      (event === 'issue_comment' || event === 'pull_request_review_comment') &&
      delivered.action === 'created'
    ) {
      return COMMENTED;
    }

    if (event === 'check_suite' && delivered.action === 'completed') {
      return delivered.check_suite?.conclusion === 'failure'
        ? CHECKS_FAILED
        : null;
    }

    return null;
  }
}
