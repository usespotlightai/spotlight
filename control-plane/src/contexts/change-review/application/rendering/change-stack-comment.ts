import type {
  StackCheckDto,
  StackCohortDto,
} from '@change-review/application/dto/change-stack.dto';

export interface CommentedStack {
  readonly cohorts: readonly StackCohortDto[];
  readonly check: StackCheckDto | null;
}

export const CHANGE_STACK_MARKER = '<!-- spotlight:change-stack -->';

const marked = (stack: CommentedStack, layerId: string): string => {
  if (stack.check?.status === 'waiting') {
    return ' · checking';
  }

  const checked = stack.check?.layers.find((each) => each.step === layerId);

  return checked && !checked.passed ? ' · does not build' : '';
};

export const ChangeStackComment = {
  of(stack: CommentedStack, link: string): string {
    const changes = stack.cohorts.filter((each) => each.kind === 'change');
    const incidental = stack.cohorts.filter((each) => each.kind !== 'change');
    const reason = stack.check?.reason ?? null;

    return [
      '### Change stack',
      `Review this pull request layer by layer, in the order it was built: **[open the change stack in Spotlight](${link})**`,
      ...changes.map((cohort) =>
        [
          `**${cohort.title}**`,
          ...cohort.layers.map(
            (layer, place) =>
              `${place + 1}. ${layer.title} (${layer.hunks.length} ${layer.hunks.length === 1 ? 'hunk' : 'hunks'})${marked(stack, layer.id)}`,
          ),
        ].join('\n'),
      ),
      incidental.length > 0
        ? `Incidental: ${incidental.map((each) => each.title).join(', ')}.`
        : null,
      stack.check
        ? `Each layer is checked on its own with \`${stack.check.command}\`.${reason ? ` ${reason}` : ''}`
        : null,
    ]
      .filter(Boolean)
      .join('\n\n');
  },
};
