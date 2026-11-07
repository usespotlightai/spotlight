import { Global, Inject, Injectable, Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { contextBindings } from '@platform/bindings/context-bindings';
import { describe, expect, it } from 'vitest';

const BOUND = Symbol('BOUND');
const PUBLISHED = Symbol('PUBLISHED');

const BINDINGS = contextBindings([BOUND]);

@Module({
  providers: [
    { provide: BOUND, useValue: 'bound' },
    { provide: PUBLISHED, useValue: 'published' },
    ...BINDINGS.exposed,
  ],
  exports: [PUBLISHED, ...BINDINGS.exposedTokens],
})
class DownstreamModule {}

@Global()
@Module({
  imports: [DownstreamModule],
  providers: [...BINDINGS.bound],
  exports: [...BINDINGS.tokens],
})
class DownstreamBindingsModule {}

@Injectable()
class Upstream {
  constructor(@Inject(BOUND) readonly bound: string) {}
}

@Module({ providers: [Upstream], exports: [Upstream] })
class UpstreamModule {}

@Injectable()
class Reaching {
  constructor(@Inject(PUBLISHED) readonly published: string) {}
}

@Module({ providers: [Reaching] })
class ReachingModule {}

describe('contextBindings', () => {
  it('lets an upstream module inject a token bound downstream', async () => {
    const app = await Test.createTestingModule({
      imports: [UpstreamModule, DownstreamBindingsModule],
    }).compile();

    expect(app.get(Upstream).bound).toBe('bound');
  });

  it('keeps the rest of the downstream module out of reach', async () => {
    await expect(
      Test.createTestingModule({
        imports: [ReachingModule, DownstreamBindingsModule],
      }).compile(),
    ).rejects.toThrow(/PUBLISHED/);
  });
});
