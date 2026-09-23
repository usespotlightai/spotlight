import type {
  FieldPath,
  FieldSegment,
} from '@shared-kernel/domain/value-objects/field-path.vo';

const BARE = /^[A-Za-z_][A-Za-z0-9_-]*$/;

const rendered = (segment: FieldSegment, first: boolean): string => {
  if (typeof segment === 'number') {
    return `[${segment}]`;
  }

  if (BARE.test(segment)) {
    return first ? segment : `.${segment}`;
  }

  return `[${JSON.stringify(segment)}]`;
};

export const attributePath = (field: FieldPath): string =>
  field.segments
    .map((each, position) => rendered(each, position === 0))
    .join('');
