import { type FormEvent, useState } from 'react';
import { RepositorySelect } from '@/components/board/RepositorySelect';
import { AutoGrowTextarea } from '@/components/common/form/AutoGrowTextarea';
import { MarkdownEditor } from '@/components/common/form/MarkdownEditor';
import { Breadcrumbs } from '@/components/layout/Breadcrumbs';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { useLastRepository } from '@/hooks/useLastRepository';
import type { NewTask } from '@/lib/task';

type NewTaskDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lineName: string;
  stationName: string;
  onCreate: (task: NewTask) => void;
};

export function NewTaskDialog({
  open,
  onOpenChange,
  lineName,
  stationName,
  onCreate,
}: NewTaskDialogProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [lastRepository, rememberRepository] = useLastRepository();
  const [repository, setRepository] = useState(lastRepository);
  const [more, setMore] = useState(false);
  const [round, setRound] = useState(0);

  const forget = () => {
    setTitle('');
    setDescription('');
    setRepository(lastRepository);
    setRound((each) => each + 1);
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!title.trim()) {
      return;
    }

    rememberRepository(repository);

    onCreate({
      title: title.trim(),
      description: description.trim(),
      repository: repository || null,
    });

    if (more) {
      forget();
    } else {
      onOpenChange(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      onOpenChangeComplete={(settled) => !settled && forget()}
    >
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex min-w-0 items-center gap-1.5 font-medium text-muted-foreground text-xs">
            <Breadcrumbs
              segments={[
                { label: lineName },
                { label: stationName },
                { label: 'New task' },
              ]}
            />
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={submit} className="contents">
          <div className="flex max-h-[60vh] flex-col gap-3 overflow-y-auto">
            <AutoGrowTextarea
              autoFocus
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Task title"
              aria-label="Task title"
              maxLength={200}
              className="font-medium text-base text-foreground leading-6"
            />

            <MarkdownEditor
              key={round}
              initialValue=""
              onChange={setDescription}
              placeholder="Add description…"
              ariaLabel="Task description"
              className="min-h-24 border-none bg-transparent p-0"
              placeholderClassName="top-0 left-0"
            />
            <div className="-ml-2 flex">
              <RepositorySelect value={repository} onChange={setRepository} />
            </div>
          </div>

          <DialogFooter className="items-center sm:justify-between">
            <label
              htmlFor="create-more"
              className="flex select-none items-center gap-2 text-muted-foreground text-xs"
            >
              <Switch
                id="create-more"
                checked={more}
                onCheckedChange={setMore}
              />
              Create more
            </label>

            <Button type="submit" size="sm" disabled={!title.trim()}>
              Create task
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
