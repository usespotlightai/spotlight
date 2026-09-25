import { HarnessPills } from '@/components/features/runners/HarnessPills';
import type { HostImageResponseDto } from '@/lib/api';
import { type NamedHarness, refusal, shortDigest } from '@/lib/runner';

type HostImageRowProps = {
  image: HostImageResponseDto;
  harnesses: readonly NamedHarness[];
};

export function HostImageRow({ image, harnesses }: HostImageRowProps) {
  const digest = shortDigest(image.digest);

  return (
    <li className="flex min-w-0 flex-col gap-1.5">
      <div className="flex min-w-0 items-center gap-2">
        <span
          className="truncate font-mono text-foreground text-xs"
          title={image.digest ?? image.image}
        >
          {image.image}
        </span>

        {image.usual && (
          <span className="shrink-0 rounded-full border border-border px-1.5 font-medium text-[0.6875rem] text-muted-foreground">
            Default
          </span>
        )}
      </div>

      {image.refused ? (
        <p className="text-destructive text-xs">{refusal(image.refused)}</p>
      ) : (
        <HarnessPills harnesses={harnesses} />
      )}

      {(image.release || digest) && (
        <p className="flex min-w-0 gap-1 text-muted-foreground text-xs tabular-nums">
          {image.release && (
            <span className="shrink-0">Runner {image.release}</span>
          )}
          {image.release && digest && <span aria-hidden>·</span>}
          {digest && <span className="truncate font-mono">{digest}</span>}
        </p>
      )}
    </li>
  );
}
