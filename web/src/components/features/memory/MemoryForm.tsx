import { type FormEvent, useState } from 'react';
import { AutoGrowTextarea } from '@/components/shared/form/AutoGrowTextarea';
import { ChoiceSelect } from '@/components/shared/form/ChoiceSelect';
import { FieldInput } from '@/components/shared/form/FieldInput';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { LineResponseDto, WriteMemoryRequestDto } from '@/lib/api';
import {
  KIND_OPTIONS,
  kindOf,
  MOST_MEMORY_BODY,
  type TeamMemory,
} from '@/lib/memory';

type MemoryFormProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  submitLabel: string;
  initial: TeamMemory | null;
  lines: readonly LineResponseDto[];
  pending: boolean;
  failed: boolean;
  onSave: (memory: WriteMemoryRequestDto) => void;
};

const pathsIn = (typed: string): string[] =>
  typed
    .split(',')
    .map((each) => each.trim())
    .filter(Boolean);

export function MemoryForm({
  open,
  onOpenChange,
  title,
  submitLabel,
  initial,
  lines,
  pending,
  failed,
  onSave,
}: MemoryFormProps) {
  const [kind, setKind] = useState(() => kindOf(initial?.kind ?? null));
  const [body, setBody] = useState(initial?.body ?? '');
  const [lineId, setLineId] = useState(initial?.lineId ?? null);
  const [stationId, setStationId] = useState(initial?.stationId ?? null);
  const [repository, setRepository] = useState(initial?.repository ?? null);
  const [paths, setPaths] = useState(() => initial?.paths.join(', ') ?? '');

  const line = lines.find((each) => each.id === lineId);
  const repositories = [
    ...new Set((line ? [line] : lines).flatMap((each) => each.repositories)),
  ];
  const unsaveable = !body.trim() || pending;

  const submit = (event: FormEvent) => {
    event.preventDefault();

    if (!unsaveable) {
      onSave({
        kind,
        body: body.trim(),
        lineId,
        stationId,
        repository,
        paths: repository ? pathsIn(paths) : [],
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="font-medium text-foreground text-sm">
            {title}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={submit} className="contents">
          <div className="flex flex-col gap-3">
            <AutoGrowTextarea
              autoFocus
              value={body}
              onChange={(event) => setBody(event.target.value)}
              placeholder="What the team should remember"
              aria-label="What the team should remember"
              maxLength={MOST_MEMORY_BODY}
              className="min-h-20 text-foreground text-sm leading-6"
            />

            <div className="flex flex-wrap gap-2">
              <ChoiceSelect
                label="Kind"
                choices={KIND_OPTIONS}
                value={kind}
                placeholder="Kind"
                onChange={(next) => setKind(kindOf(next))}
              />
              <ChoiceSelect
                label="Line"
                choices={lines.map((each) => ({
                  value: each.id,
                  label: each.name,
                }))}
                value={lineId}
                placeholder="The whole team"
                onChange={(next) => {
                  setLineId(next);
                  setStationId(null);
                  setRepository(null);
                }}
              />
              <ChoiceSelect
                label="Station"
                choices={(line?.stations ?? [])
                  .filter((each) => each.kind === 'work')
                  .map((each) => ({ value: each.id, label: each.name }))}
                value={stationId}
                placeholder="Every station"
                disabled={!line}
                onChange={setStationId}
              />
              <ChoiceSelect
                label="Repository"
                choices={repositories.map((each) => ({
                  value: each,
                  label: each,
                }))}
                value={repository}
                placeholder="Any repository"
                onChange={setRepository}
              />
            </div>

            <FieldInput
              value={paths}
              disabled={!repository}
              onChange={(event) => setPaths(event.target.value)}
              placeholder="Paths in the repository, separated by commas"
              aria-label="Paths"
              className="rounded-lg border border-border bg-muted/60"
            />
          </div>

          <DialogFooter className="items-center sm:justify-between">
            {failed ? (
              <p role="alert" className="text-destructive text-xs">
                It could not be saved. Try again.
              </p>
            ) : (
              <span />
            )}
            <Button type="submit" size="sm" disabled={unsaveable}>
              {submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
