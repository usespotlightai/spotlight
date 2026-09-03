import { createHmac } from 'node:crypto';
import { UpstreamRefusedError } from '@domain/exceptions/upstream-refused.error';
import { Mark } from '@domain/value-objects/mark.vo';
import { TaskId } from '@domain/value-objects/task-id.vo';
import { WorkspaceId } from '@domain/value-objects/workspace-id.vo';
import { DeclaredSource } from '@infrastructure/integrations/declared.source';
import {
  compileIntegration,
  type ReadableIntegration,
} from '@infrastructure/integrations/integration.compile';
import { describe, expect, it } from 'vitest';

const SECRET = 'whsec_linear';
const WORKSPACE = WorkspaceId.of('ws_1');

/**
 * An integration as somebody would actually write it, and the only place
 * Linear is named anywhere in this repository.
 */
const LINEAR = `
version: 1
source: linear
name: Linear

verify:
  scheme: hmac-sha256
  header: linear-signature
  secret: LINEAR_WEBHOOK_SECRET

delivery: \${{ headers["linear-delivery"] }}

happenings:
  - happening: linear.issue.completed
    label: Issue completed
    told: The issue was moved to Done.
    when: \${{ body.type == "Issue" && body.data.state.name == "Done" }}
    concerns:
      marks:
        - kind: linear.issue
          value: \${{ body.data.identifier }}

  - happening: linear.issue.commented
    label: Issue commented on
    told: Somebody commented on the issue.
    spoken: true
    when: \${{ body.type == "Comment" }}
    concerns:
      branch: \${{ body.data.issue.branchName }}
      marks:
        - kind: linear.issue
          value: \${{ body.data.issue.identifier }}
`;

const compiled = (text = LINEAR): ReadableIntegration => {
  const read = compileIntegration('.spotlight/integrations/linear.yml', text);

  if (!read.ok) {
    throw new Error(
      `fixture will not compile: ${read.problems.map((each) => `${each.at} ${each.reason}`).join(', ')}`,
    );
  }

  return read.readable;
};

const source = (secret: string | null = SECRET, text = LINEAR) =>
  new DeclaredSource(compiled(text), WORKSPACE, secret);

const raw = (body: unknown) => Buffer.from(JSON.stringify(body));

const signed = (body: unknown, secret = SECRET) =>
  createHmac('sha256', secret).update(raw(body)).digest('hex');

const delivered = (body: unknown, headers: Record<string, string> = {}) => ({
  headers: { 'linear-signature': signed(body), ...headers },
  body,
  raw: raw(body),
});

const completed = {
  type: 'Issue',
  action: 'update',
  data: { identifier: 'ENG-42', state: { name: 'Done' } },
};

const commented = {
  type: 'Comment',
  data: {
    body: 'Looks done to me.',
    issue: { identifier: 'ENG-42', branchName: 'spotlight/task_1' },
  },
};

describe('a source declared in a file', () => {
  it('is addressed by the name the file gives it', () => {
    expect(source().key).toBe('linear');
  });

  it('declares every word the file says it raises', () => {
    expect(source().happenings.map((each) => each.happening.value)).toEqual([
      'linear.issue.completed',
      'linear.issue.commented',
    ]);
    expect(source().happenings[0]?.label).toBe('Issue completed');
  });

  it('says which of them are a person speaking', () => {
    expect(source().happenings.map((each) => each.spoken)).toEqual([
      false,
      true,
    ]);
  });

  describe('verifying', () => {
    it('takes a delivery the host signed', () => {
      expect(source().verifies(delivered(completed))).toBe(true);
    });

    it('refuses one signed with another secret', () => {
      expect(
        source().verifies({
          ...delivered(completed),
          headers: { 'linear-signature': signed(completed, 'wrong') },
        }),
      ).toBe(false);
    });

    it('refuses one carrying no signature at all', () => {
      expect(source().verifies({ ...delivered(completed), headers: {} })).toBe(
        false,
      );
    });

    // An integration half configured takes nobody's word for what happened.
    it('refuses everything where the workspace has set no secret', () => {
      expect(source(null).verifies(delivered(completed))).toBe(false);
    });

    it('refuses one whose body never reached us whole', () => {
      expect(source().verifies({ ...delivered(completed), raw: null })).toBe(
        false,
      );
    });

    it('reads the signature header however the host capitalised it', () => {
      expect(
        source().verifies({
          ...delivered(completed),
          headers: { 'linear-signature': signed(completed) },
        }),
      ).toBe(true);
    });
  });

  describe('naming a delivery', () => {
    it('calls it what the host called it', () => {
      expect(
        source().delivery(delivered(completed, { 'linear-delivery': 'd_1' })),
      ).toBe('d_1');
    });

    // Without one, the same word twice would be worked twice.
    it('falls back to the body, so an unnamed one is still the same one', () => {
      const once = source().delivery(delivered(completed));
      const again = source().delivery(delivered(completed));

      expect(once).toBe(again);
      expect(once).toHaveLength(64);
    });
  });

  describe('reading', () => {
    it('raises the word whose rule holds', () => {
      const [read, ...rest] = source().read(delivered(completed));

      expect(rest).toHaveLength(0);
      expect(read?.happening.value).toBe('linear.issue.completed');
      expect(read?.told).toBe('The issue was moved to Done.');
    });

    it('finds the task by the handle the file names', () => {
      const [read] = source().read(delivered(completed));

      expect(read?.concerns.marks).toEqual([Mark.of('linear.issue', 'ENG-42')]);
    });

    it('finds it by the branch where the file names one', () => {
      const [read] = source().read(delivered(commented));

      expect(read?.concerns.taskId).toEqual(TaskId.of('task_1'));
      expect(read?.concerns.marks).toEqual([Mark.of('linear.issue', 'ENG-42')]);
    });

    it('tells one word from another by its rule alone', () => {
      expect(
        source()
          .read(delivered(commented))
          .map((each) => each.happening.value),
      ).toEqual(['linear.issue.commented']);
    });

    // A host sends every event it has; most say nothing anyone asked about.
    it('says nothing of a delivery no rule holds for', () => {
      expect(source().read(delivered({ type: 'Project', data: {} }))).toEqual(
        [],
      );
    });

    it('says nothing of a delivery shaped nothing like the rules', () => {
      expect(source().read(delivered({ hello: 'world' }))).toEqual([]);
    });

    // A rule that matched but read no handle matched too widely.
    it('refuses one it matched but could find no task from', () => {
      expect(() =>
        source().read(
          delivered({ type: 'Issue', data: { state: { name: 'Done' } } }),
        ),
      ).toThrow(UpstreamRefusedError);
    });

    it('routes everything to the workspace whose file it is', async () => {
      expect(await source().routes()).toEqual(WORKSPACE);
    });
  });
});
