import { InvalidActionError } from '@integrations/domain/exceptions/invalid-action.error';
import {
  Action,
  type ActionFields,
} from '@integrations/domain/value-objects/action.vo';
import { describe, expect, it } from 'vitest';

const fields = (over: Partial<ActionFields> = {}): ActionFields => ({
  name: 'post',
  fromNetwork: false,
  waitsSeconds: null,
  uploads: null,
  auth: { oauth2: false, secrets: false },
  headers: [],
  url: 'https://api.example.com',
  ...over,
});

const problems = (over: Partial<ActionFields>) =>
  Action.problemsOf(fields(over)).map((each) => [
    each.at.rendered,
    each.because,
  ]);

describe('Action', () => {
  it('has a wait only when sent from the network', () => {
    expect(problems({ waitsSeconds: 10 })).toEqual([
      [
        'timeoutSeconds',
        expect.stringMatching(/Only an action sent from the network/),
      ],
    ]);
    expect(problems({ waitsSeconds: 10, fromNetwork: true })).toEqual([]);
  });

  it('sends from the network only what egress can send', () => {
    expect(
      problems({
        fromNetwork: true,
        uploads: { sendsBody: false },
        auth: { oauth2: true, secrets: true },
        headers: ['Host'],
        url: 'http://api.example.com',
      }).map(([at]) => at),
    ).toEqual([
      'uploads',
      'request.auth',
      'request.headers.Host',
      'request.url',
    ]);
  });

  it('sends the bytes of a file as the body of the request that sends it', () => {
    expect(problems({ uploads: { sendsBody: true } })).toEqual([
      ['uploads.send.body', expect.stringMatching(/Please remove body/)],
    ]);
  });

  it('refuses to be made with a problem', () => {
    expect(() => Action.of(fields({ waitsSeconds: 10 }))).toThrow(
      InvalidActionError,
    );
    expect(() => Action.of(fields({ name: 'Post Now' }))).toThrow(
      /lowercase words joined by dashes/,
    );
  });

  it('says whether it uploads files', () => {
    expect(Action.of(fields({ uploads: { sendsBody: false } })).uploads).toBe(
      true,
    );
    expect(Action.of(fields()).uploads).toBe(false);
  });
});
