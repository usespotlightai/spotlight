import type {
  StackCheckDto,
  StackCohortDto,
} from '@change-review/application/dto/change-stack.dto';

export interface AnnouncedStack {
  readonly cohorts: readonly StackCohortDto[];
  readonly check: StackCheckDto | null;
}

export const CHANGE_STACK_MARKER = '<!-- spotlight:change-stack -->';

const marked = (stack: AnnouncedStack, layerId: string): string => {
  if (stack.check?.state === 'waiting') {
    return ' · checking';
  }

  const checked = stack.check?.layers.find((each) => each.step === layerId);

  return checked && !checked.passed ? ' · does not build' : '';
};

export const ChangeStackComment = {
  of(stack: AnnouncedStack, link: string): string {
    const changes = stack.cohorts.filter((each) => each.kind === 'change');
    const setAside = stack.cohorts.filter((each) => each.kind !== 'change');
    const reason = stack.check?.reason ?? null;

    return [
      '### Change stack',
      `Review this pull request layer by layer, in the order it was built: **[open the change stack in Spotlight](${link})**`,
      ...changes.map((cohort) =>
        [
          `**${cohort.title}**`,
          ...cohort.layers.map(
            (layer, place) =>
              `${place + 1}. ${layer.title} (${layer.ranges.length} ${layer.ranges.length === 1 ? 'change' : 'changes'})${marked(stack, layer.id)}`,
          ),
        ].join('\n'),
      ),
      setAside.length > 0
        ? `Set aside as incidental: ${setAside.map((each) => each.title).join(', ')}.`
        : null,
      stack.check
        ? `Each layer is checked on its own with \`${stack.check.command}\`.${reason ? ` ${reason}` : ''}`
        : null,
    ]
      .filter(Boolean)
      .join('\n\n');
  },
};
