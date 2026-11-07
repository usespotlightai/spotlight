import { Injectable } from '@nestjs/common';
import { inCodePointOrder } from '@platform/ordering/code-point-order';

export interface ApiConvention {
  readonly title: string;
  readonly text: string;
}

@Injectable()
export class ApiConventions {
  private readonly registered: ApiConvention[] = [];

  register(conventions: readonly ApiConvention[]): void {
    this.registered.push(...conventions);
  }

  get all(): readonly ApiConvention[] {
    return [...this.registered].sort((one, other) =>
      inCodePointOrder(one.title, other.title),
    );
  }
}
