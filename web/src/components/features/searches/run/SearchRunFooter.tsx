import { ComposerFooter } from '@/components/shared/ComposerFooter';

export function SearchRunFooter() {
  return (
    <ComposerFooter>
      <p className="text-center text-muted-foreground text-xs">
        A search’s agent runs on its own. Nobody can talk to it, and it changes
        nothing but the candidates it proposes.
      </p>
    </ComposerFooter>
  );
}
