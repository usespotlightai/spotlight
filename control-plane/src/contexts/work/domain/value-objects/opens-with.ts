import type { LineRole } from '@work/domain/value-objects/line-role.vo';
import type { Mark } from '@work/domain/value-objects/mark.vo';

export interface OpensWith {
  readonly onto: LineRole;
  readonly at: string | null;
  readonly title: string;
  readonly description: string | null;
  readonly assignEmail: string | null;
  readonly marks: readonly Mark[];
}
