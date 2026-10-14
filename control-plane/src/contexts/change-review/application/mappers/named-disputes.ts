import type { DecisionDto } from '@change-review/application/dto/decision.dto';
import type { PeoplePort } from '@change-review/application/ports/people.port';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';

export const namedDisputes = async (
  decisions: readonly DecisionDto[],
  people: PeoplePort,
): Promise<DecisionDto[]> => {
  const who = [
    ...new Set(decisions.flatMap((each) => each.disputes.map((d) => d.by))),
  ];
  const names = new Map<string, string | null>();

  for (const by of who) {
    names.set(by, (await people.find(UserId.of(by)))?.name ?? null);
  }

  return decisions.map((each) => ({
    ...each,
    disputes: each.disputes.map((dispute) => ({
      ...dispute,
      byName: names.get(dispute.by) ?? null,
    })),
  }));
};
