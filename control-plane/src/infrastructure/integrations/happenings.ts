import type { Happened } from '@application/ports/webhook-source.port';
import type { DeclaredHappening } from '@domain/entities/declared-happening.entity';
import { UpstreamRefusedError } from '@domain/exceptions/upstream-refused.error';
import { Concerns } from '@domain/value-objects/concerns.vo';
import { Mark } from '@domain/value-objects/mark.vo';
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
 * Reads the words a set of events raises off one delivery or poll response.
 * Shared by every trigger, so `forEach`, `when`, marks, and `opens` mean the
 * same whether a webhook delivered the body or a poll fetched it.
 */
export const readEvents = (
  events: readonly EventIR[],
  declaring: (happening: string) => DeclaredHappening | null,
  against: Bindings,
  ourOwn: (against: Bindings) => boolean,
): Happened[] => {
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
            raised.push(raiseFrom(event.raise, declared, per, ourOwn(per)));
          }
        }
      }

      continue;
    }

    if (holds(event.when, against)) {
      raised.push(raiseFrom(event.raise, declared, against, ourOwn(against)));
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
  const concerns = Concerns.of({
    branch: raise.branch ? reads(raise.branch, against) : null,
    marks: raise.marks.map((mark) => {
      const read = reads(mark.value, against);

      return read ? Mark.of(mark.kind.value, read) : null;
    }),
  });

  if (!concerns) {
    throw new UpstreamRefusedError(
      `reading a ${declared.happening.value}`,
      'it names neither a branch nor anything this line knows a task by',
    );
  }

  const title = raise.opens ? reads(raise.opens.title, against) : null;

  return {
    happening: declared.happening,
    told: declared.told,
    spoken: declared.spoken,
    state: 'raised',
    concerns,
    said: null,
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
          }
        : null,
  };
};
