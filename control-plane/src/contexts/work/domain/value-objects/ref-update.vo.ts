import { Branch } from '@work/domain/value-objects/branch.vo';

const HEADS = 'refs/heads/';
const NO_OBJECT = /^0+$/;

export class RefUpdate {
  private constructor(
    readonly ref: string,
    readonly from: string,
    readonly to: string,
    readonly rewrites: boolean,
  ) {}

  static of(input: {
    ref: string;
    from: string;
    to: string;
    rewrites?: boolean;
  }): RefUpdate {
    return new RefUpdate(
      input.ref,
      input.from,
      input.to,
      input.rewrites ?? true,
    );
  }

  get deletes(): boolean {
    return NO_OBJECT.test(this.to);
  }

  get creates(): boolean {
    return NO_OBJECT.test(this.from);
  }

  get branch(): Branch | null {
    return this.ref.startsWith(HEADS) && this.ref.length > HEADS.length
      ? Branch.of(this.ref.slice(HEADS.length))
      : null;
  }
}
