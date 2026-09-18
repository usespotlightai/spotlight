export const DIFF_THEME = {
  light: 'github-light',
  dark: 'github-dark',
} as const;

export const DIFF_THEMES = [DIFF_THEME.light, DIFF_THEME.dark];

const tint = (base: string, light: number, dark: number) =>
  `light-dark(color-mix(in lab, transparent ${light}%, var(${base})), color-mix(in lab, transparent ${dark}%, var(${base})))`;

const annotationOn = (lineType: string, base: string) =>
  ` [data-line-type="${lineType}"] + [data-line-annotation] { --diffs-annotation-bg: ${tint(base, 88, 80)} !important; }` +
  ` [data-line-type="${lineType}"] + [data-gutter-buffer="annotation"] { --diffs-annotation-bg: ${tint(base, 91, 85)} !important; position: relative; }` +
  ` [data-line-type="${lineType}"] + [data-gutter-buffer="annotation"]::before { content: ""; position: absolute; top: 0; left: 0; width: 4px; min-width: 0; max-width: 4px; padding: 0; height: 100%; contain: strict; background-color: var(${base}); }`;

const ANNOTATIONS =
  ' [data-line-annotation][data-selected-line], [data-gutter-buffer="annotation"][data-selected-line] { --diffs-computed-selected-line-bg: var(--diffs-computed-diff-line-bg) !important; }' +
  annotationOn('change-addition', '--diffs-addition-base') +
  annotationOn('change-deletion', '--diffs-deletion-base');

const LINE_NUMBERS = ' [data-line-number-content] { min-width: 4ch; }';

const GUTTER_UTILITY =
  ' [data-gutter-utility-slot] { left: 0 !important; right: 0 !important; justify-content: flex-end !important; z-index: 3; pointer-events: none; }';

export const diffOptions = (flush: boolean, gutter = false) =>
  ({
    diffStyle: 'unified',
    disableFileHeader: true,
    hunkSeparators: 'simple',
    overflow: 'wrap',
    theme: DIFF_THEME,
    unsafeCSS: `:host { color-scheme: inherit; font-size: 11px; line-height: 1.5; --diffs-selection-base: var(--primary);${
      flush ? ' --diffs-gap-block: 0; --diffs-bg: transparent;' : ''
    } }${LINE_NUMBERS}${ANNOTATIONS}${gutter ? GUTTER_UTILITY : ''}`,
  }) as const;
