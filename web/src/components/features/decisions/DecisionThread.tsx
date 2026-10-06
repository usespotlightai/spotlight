import { useState } from 'react';
import { Link } from 'react-router';
import { ReplyBox } from '@/components/features/review/ReplyBox';
import { ThreadEntry } from '@/components/features/review/ThreadEntry';
import { PersonAvatar } from '@/components/shared/avatar/PersonAvatar';
import { Logo } from '@/components/shared/icons';
import { Pill } from '@/components/shared/Pill';
import type { Decision } from '@/lib/decision';
import type { Disputing } from '@/lib/decisions-context';
import { since } from '@/lib/since';

type DecisionThreadProps = {
  decision: Decision;
  path: string;
  reasoningAt: string | null;
  disputing: Disputing;
};

export function DecisionThread({
  decision,
  path,
  reasoningAt,
  disputing,
}: DecisionThreadProps) {
  const [replying, setReplying] = useState(false);
  const disputes = decision.disputes.filter((each) => each.path === path);

  return (
    <section
      aria-label={`Decision: ${decision.title}`}
      className="flex flex-col gap-3 rounded-lg border-[0.5px] border-border bg-card p-3 font-sans shadow-xs"
    >
      <ol className="flex flex-col">
        <ThreadEntry
          avatar={<Logo className="size-5 rounded" aria-hidden />}
          author="Spotlight"
          meta={<Pill className="px-1.5 py-0">Decision</Pill>}
        >
          <p className="font-medium text-foreground text-sm leading-5">
            {decision.title}
          </p>
          <p className="whitespace-pre-wrap break-words text-foreground text-sm leading-5">
            {decision.why}
          </p>

          {reasoningAt && (
            <Link
              to={reasoningAt}
              target="_blank"
              rel="noreferrer"
              className="self-start text-muted-foreground text-sm leading-5 underline-offset-2 outline-none hover:text-foreground hover:underline focus-visible:underline"
            >
              Detailed reasoning steps
            </Link>
          )}
        </ThreadEntry>

        {disputes.map((each) => {
          const author = each.byName ?? 'A reviewer';

          return (
            <ThreadEntry
              key={each.id}
              first={false}
              avatar={<PersonAvatar person={{ name: author, image: null }} />}
              author={author}
              meta={<span className="text-faint">{since(each.at)}</span>}
            >
              <p
                data-slot="dispute"
                className="whitespace-pre-wrap break-words text-foreground text-sm leading-5"
              >
                {each.reason}
              </p>
            </ThreadEntry>
          );
        })}
      </ol>

      <ReplyBox
        label={`Reply to “${decision.title}”`}
        open={replying}
        onOpenChange={setReplying}
        pending={disputing.pending}
        onSubmit={(reason) =>
          void disputing
            .dispute(decision.id, path, reason)
            .then(() => setReplying(false))
            .catch(() => undefined)
        }
      />
    </section>
  );
}
