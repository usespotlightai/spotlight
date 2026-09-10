import type { Happened } from '@application/ports/webhook-source.port';
import type { DeclaredHappening } from '@domain/entities/declared-happening.entity';
import { UpstreamRefusedError } from '@domain/exceptions/upstream-refused.error';
import { Concerns } from '@domain/value-objects/concerns.vo';
import { Mark } from '@domain/value-objects/mark.vo';
import { Said } from '@domain/value-objects/said.vo';
import {
  type Bindings,
  bound,
  holds,
  reads,
  value,
} from '@infrastructure/integrations/expression';
import type {
  EventIR,
  RaiseIR,
} from '@infrastructure/integrations/integration.compile';

/**
 * A word matched, with the bindings it matched against, so a caller may fill
 * them out — reading what a delivery only names — before the word is raised.
 */
const identity = async (
  _event: EventIR,
  against: Bindings,
): Promise<Bindings> => against;

/**
 * Reads the words a set of events raises off one delivery or poll response.
 * Shared by every trigger, so `forEach`, `when`, marks, and `opens` mean the
 * same whether a webhook delivered the body or a poll fetched it.
 *
 * Where a matched event has more to fetch than the delivery carried — an email
 * behind a user id, say — `enrich` gets a chance to add it to the bindings
 * before the word is raised. Triggers that cannot fetch (a poll) leave it out.
 */
export const readEvents = async (
  events: readonly EventIR[],
  declaring: (happening: string) => DeclaredHappening | null,
  against: Bindings,
  ourOwn: (against: Bindings) => boolean,
  enrich: (event: EventIR, against: Bindings) => Promise<Bindings> = identity,
): Promise<Happened[]> => {
  const raised: Happened[] = [];

  for (const event of events) {
    const declared = declaring(event.raise.happening);

    if (!declared) {
      continue;
    }

    if (event.forEach) {
      const list = value(event.forEach, against);

      if (Array.isArray(list)) {
        for (const item of list) {
          const per = { ...against, item: bound(item) };

          if (holds(event.when, per)) {
            const filled = await enrich(event, per);
            raised.push(
              raiseFrom(event.raise, declared, filled, ourOwn(filled)),
            );
          }
        }
      }

      continue;
    }

    if (holds(event.when, against)) {
      const filled = await enrich(event, against);
      raised.push(raiseFrom(event.raise, declared, filled, ourOwn(filled)));
    }
  }

  return raised;
};

const raiseFrom = (
  raise: RaiseIR,
  declared: DeclaredHappening,
  against: Bindings,
  ourOwn: boolean,
): Happened => {
  // Every mark the delivery yields, each kept with whether a task is found by
  // it. Concerns — which task the word is about — is built from the finding
  // marks alone; the opened task still wears them all, ambient ones included.
  const marked = raise.marks
    .map((mark) => {
      const read = reads(mark.value, against);

      return read
        ? { mark: Mark.of(mark.kind.value, read), finds: mark.finds }
        : null;
    })
    .filter((each): each is { mark: Mark; finds: boolean } => each !== null);

  const marks = marked.map((each) => each.mark);

  const concerns = Concerns.of({
    branch: raise.branch ? reads(raise.branch, against) : null,
    marks: marked.filter((each) => each.finds).map((each) => each.mark),
  });

  if (!concerns) {
    throw new UpstreamRefusedError(
      `reading a ${declared.happening.value}`,
      'it names neither a branch nor anything this line knows a task by',
    );
  }

  const title = raise.opens ? reads(raise.opens.title, against) : null;
  const said = raise.say ? Said.of({ body: reads(raise.say, against) }) : null;

  return {
    happening: declared.happening,
    told: declared.told,
    spoken: declared.spoken,
    state: 'raised',
    concerns,
    said,
    ourOwn,
    opens:
      declared.opensOnto && raise.opens && title
        ? {
            onto: declared.opensOnto,
            at: declared.opensAt?.value ?? null,
            title,
            description: raise.opens.description
              ? reads(raise.opens.description, against)
              : null,
            assignEmail: raise.opens.assignBy
              ? reads(raise.opens.assignBy.email, against)
              : null,
            marks,
          }
        : null,
  };
};
