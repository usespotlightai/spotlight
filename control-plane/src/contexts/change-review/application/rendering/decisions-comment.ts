import type {
  DecisionDto,
  TaskDecisionsDto,
} from '@change-review/application/dto/decision.dto';
import type { Repository } from '@shared-kernel/domain/value-objects/repository.vo';

export const DECISIONS_MARKER = '<!-- spotlight:decisions -->';

const LABELS: Record<DecisionDto['kind'], string> = {
  deviation: 'Deviation',
  limitation: 'Limitation',
  assumption: 'Assumption',
  'trade-off': 'Trade-off',
  'rejected-approach': 'Rejected approach',
};

const inRepository = (path: string, repository: Repository): string => {
  const [checkout, ...within] = path.split('/');

  return checkout === repository.name && within.length > 0
    ? within.join('/')
    : path;
};

const describeDecision = (
  decision: DecisionDto,
  repository: Repository,
): string =>
  [
    `**${LABELS[decision.kind]}** · ${decision.title}`,
    decision.why,
    decision.alternatives.length > 0
      ? `Weighed and set aside: ${decision.alternatives.join('; ')}.`
      : null,
    decision.paths
      .map((path) => `\`${inRepository(path, repository)}\``)
      .join(', '),
    ...decision.disputes.map(
      (dispute) =>
        `> Disputed by ${dispute.byName ?? 'a reviewer'} on \`${inRepository(dispute.path, repository)}\`: ${dispute.reason}`,
    ),
  ]
    .filter(Boolean)
    .join('\n');

export const DecisionsComment = {
  of(found: TaskDecisionsDto, repository: Repository, link: string): string {
    return [
      '### Decisions the agent made',
      `The agent recorded these while it built this pull request, each from its own reasoning: **[read them with that reasoning in Spotlight](${link})**`,
      ...found.decisions.map((each) => describeDecision(each, repository)),
    ].join('\n\n');
  },
};
