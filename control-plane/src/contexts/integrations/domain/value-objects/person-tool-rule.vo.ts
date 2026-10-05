import { InvalidIntegrationPartError } from '@integrations/domain/exceptions/invalid-integration-part.error';

export const PERSON_TOOL_RULES = [
  'allowed',
  'needs-approval',
  'blocked',
] as const;

export type PersonToolRuleName = (typeof PERSON_TOOL_RULES)[number];

const isRule = (name: string): name is PersonToolRuleName =>
  (PERSON_TOOL_RULES as readonly string[]).includes(name);

export class PersonToolRule {
  private constructor(readonly name: PersonToolRuleName) {}

  static of(name: string): PersonToolRule {
    if (!isRule(name)) {
      throw new InvalidIntegrationPartError(
        'tool rule',
        `is one of ${PERSON_TOOL_RULES.join(', ')}`,
      );
    }

    return new PersonToolRule(name);
  }

  static allowed(): PersonToolRule {
    return new PersonToolRule('allowed');
  }

  get allows(): boolean {
    return this.name === 'allowed';
  }

  equals(other: PersonToolRule): boolean {
    return this.name === other.name;
  }
}
