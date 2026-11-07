import { RunPolicy } from '@work/domain/value-objects/run-policy.vo';
import type { RunSubject } from '@work/domain/value-objects/run-subject.vo';

const TASK = RunPolicy.of({
  holdsTurn: true,
  gated: true,
  actsBeyondItself: true,
  asks: 'requester',
  listed: true,
  exclusive: true,
});

const CHAT = RunPolicy.of({
  holdsTurn: false,
  gated: false,
  actsBeyondItself: true,
  asks: 'requester',
  listed: true,
  exclusive: true,
});

const ISOLATED = RunPolicy.of({
  holdsTurn: false,
  gated: false,
  actsBeyondItself: false,
  asks: 'recorded',
  listed: false,
  exclusive: false,
});

const RAW = RunPolicy.of({
  holdsTurn: false,
  gated: false,
  actsBeyondItself: true,
  asks: 'requester',
  listed: true,
  exclusive: false,
});

export const policyOf = (subject: RunSubject | null): RunPolicy =>
  subject
    ? subject.match<RunPolicy>({
        task: () => TASK,
        chat: () => CHAT,
        replay: () => ISOLATED,
        search: () => ISOLATED,
      })
    : RAW;
