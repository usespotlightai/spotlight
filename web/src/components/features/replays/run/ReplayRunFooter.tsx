import { ComposerFooter } from '@/components/shared/ComposerFooter';

export function ReplayRunFooter() {
  return (
    <ComposerFooter>
      <p className="text-center text-muted-foreground text-xs">
        A replay runs on its own. Nobody can talk to it, and nothing it does
        reaches the task.
      </p>
    </ComposerFooter>
  );
}
