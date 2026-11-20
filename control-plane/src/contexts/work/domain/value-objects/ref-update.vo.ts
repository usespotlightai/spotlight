import { Branch } from '@work/domain/value-objects/branch.vo';

const HEADS = 'refs/heads/';
const NO_OBJECT = /^0+$/;

export class RefUpdate {
  private constructor(
    readonly ref: string,
    readonly deletes: boolean,
  ) {}

  static of(input: { ref: string; to: string }): RefUpdate {
    return new RefUpdate(input.ref, NO_OBJECT.test(input.to));
  }

  get branch(): Branch | null {
    return this.ref.startsWith(HEADS) && this.ref.length > HEADS.length
      ? Branch.of(this.ref.slice(HEADS.length))
      : null;
  }
}
