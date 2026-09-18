export const SECRET: unique symbol = Symbol.for('spotlight.secret');

export interface Secret {
  readonly [SECRET]: true;
}

export const isSecret = (value: unknown): value is Secret =>
  typeof value === 'object' && value !== null && SECRET in value;
