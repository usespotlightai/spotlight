import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import type {
  Delivered,
  Happened,
  HappeningDeclaration,
  WebhookHeaders,
  WebhookSourcePort,
} from '@application/ports/webhook-source.port';
import type { DeclaredHappening } from '@domain/entities/declared-happening.entity';
import { UpstreamRefusedError } from '@domain/exceptions/upstream-refused.error';
import { Concerns } from '@domain/value-objects/concerns.vo';
import { Mark } from '@domain/value-objects/mark.vo';
import type { WorkspaceId } from '@domain/value-objects/workspace-id.vo';
import { bound, holds, reads } from '@infrastructure/integrations/expression';
import type {
  HappeningRules,
  ReadableIntegration,
} from '@infrastructure/integrations/integration.compile';

const headed = (headers: WebhookHeaders, name: string): string | undefined => {
  const value = headers[name.toLowerCase()];

  return Array.isArray(value) ? value[0] : value;
};

/**
 * A host Spotlight was told about rather than written for. What it can say is
 * the integration's; how to tell its deliveries apart is written beside it in
 * expressions, which are this layer's.
 */
export class DeclaredSource implements WebhookSourcePort {
  constructor(
    private readonly readable: ReadableIntegration,
    private readonly workspaceId: WorkspaceId,
    /** What the workspace set for the secret the file names, if anything. */
    private readonly secret: string | null,
  ) {}

  get key(): string {
    return this.readable.integration.source.value;
  }

  get happenings(): readonly HappeningDeclaration[] {
    return this.readable.integration.declares.map((each) => ({
      happening: each.happening,
      label: each.label,
      told: each.told,
      spoken: each.spoken,
    }));
  }

  verifies(delivered: Delivered): boolean {
    const signing = this.readable.integration.signing;

    // A secret nobody has set is not a signature that passes: an integration
    // half configured takes nobody's word for what happened.
    if (this.secret === null || delivered.raw === null) {
      return false;
    }

    const given = headed(delivered.headers, signing.header);

    if (!given) {
      return false;
    }

    const expected = Buffer.from(
      signing.prefix +
        createHmac('sha256', this.secret)
          .update(delivered.raw)
          .digest(signing.encoding),
    );
    const sent = Buffer.from(given);

    // Compared byte for byte in constant time, so a wrong signature gives
    // nothing away about how far along it went wrong.
    return expected.length === sent.length && timingSafeEqual(expected, sent);
  }

  delivery(delivered: Delivered): string {
    const named =
      this.readable.delivery &&
      reads(this.readable.delivery, this.bindings(delivered));

    // A host that names nothing is still not to be worked twice, so the
    // delivery is named after what it said.
    return (
      named ??
      createHash('sha256')
        .update(delivered.raw ?? Buffer.from(''))
        .digest('hex')
    );
  }

  /** The door it arrived at said whose it was; nothing is looked up. */
  async routes(): Promise<WorkspaceId | null> {
    return this.workspaceId;
  }

  read(delivered: Delivered): readonly Happened[] {
    const against = this.bindings(delivered);
    const raised: Happened[] = [];

    for (const rule of this.readable.rules) {
      const declared = this.declaring(rule.happening);

      if (declared && holds(rule.when, against)) {
        raised.push(this.happened(declared, rule, against));
      }
    }

    return raised;
  }

  private declaring(happening: string): DeclaredHappening | null {
    return (
      this.readable.integration.declares.find(
        (each) => each.happening.value === happening,
      ) ?? null
    );
  }

  private happened(
    declared: DeclaredHappening,
    rule: HappeningRules,
    against: Record<string, unknown>,
  ): Happened {
    const concerns = Concerns.of({
      branch: rule.branch ? reads(rule.branch, against) : null,
      marks: rule.marks.map((mark) => {
        const value = reads(mark.value, against);

        return value ? Mark.of(mark.kind.value, value) : null;
      }),
    });

    // Refused rather than dropped, so the host sends it again. A rule that
    // matched but read no handle is a rule that matched too widely.
    if (!concerns) {
      throw new UpstreamRefusedError(
        `reading a ${declared.happening.value} delivery`,
        'it names neither a branch nor anything this line knows a task by',
      );
    }

    const title = rule.opens ? reads(rule.opens.title, against) : null;

    return {
      happening: declared.happening,
      told: declared.told,
      spoken: declared.spoken,
      // A declared source reports what happened. Nothing it says clears
      // itself again later, the way an alert does.
      state: 'raised',
      concerns,
      said: null,
      // Spotlight reaches a host it was merely told about through nothing of
      // its own, so nothing arriving from one is its own doing.
      ourOwn: false,
      // No title read, no opening to describe: the line falls back to the mark.
      opens: title
        ? {
            title,
            description:
              rule.opens?.description != null
                ? reads(rule.opens.description, against)
                : null,
          }
        : null,
    };
  }

  private bindings(delivered: Delivered): Record<string, unknown> {
    return {
      body: bound(delivered.body ?? {}),
      headers: bound(delivered.headers ?? {}),
    };
  }
}
