import type {
  HarnessReview,
  HarnessReviewPort,
  ReviewNote,
} from '@configuration/application/ports/harness-review.port';
import type { ParsedProfile } from '@configuration/domain/aggregates/harness-profile.aggregate';
import { HarnessProfileShapeMapper } from '@configuration/infrastructure/acl/harness-profile-shape.mapper';
import { FieldPath } from '@shared-kernel/domain/value-objects/field-path.vo';
import type { HarnessNote } from '@work/application/contracts/harness-profile.contract';
import type { HarnessProfileReviewPort } from '@work/application/ports/harness-profile-review.port';

const fieldOf = (parsed: ParsedProfile, note: HarnessNote): FieldPath => {
  switch (note.about) {
    case 'rule': {
      const written = parsed.settings.rules.find(
        (each) =>
          each.decision === note.rule.decision &&
          each.kind === note.rule.kind &&
          each.pattern === note.rule.pattern,
      );

      return FieldPath.of(
        written
          ? ['permissions', written.decision, written.at]
          : ['permissions', note.rule.decision],
      );
    }
    case 'native':
      return FieldPath.of(['native', note.harness, ...note.path]);
    case 'mcp-servers':
      return FieldPath.of(['mcpServers']);
  }
};

export class HarnessReviewOfWork implements HarnessReviewPort {
  constructor(private readonly harnesses: HarnessProfileReviewPort) {}

  review(parsed: ParsedProfile): HarnessReview {
    const reviewed = this.harnesses.review(
      HarnessProfileShapeMapper.toShape(parsed),
    );
    const noted = (note: HarnessNote): ReviewNote => ({
      at: fieldOf(parsed, note),
      reason: note.reason,
    });

    return {
      problems: reviewed.problems.map(noted),
      warnings: reviewed.warnings.map(noted),
    };
  }
}
