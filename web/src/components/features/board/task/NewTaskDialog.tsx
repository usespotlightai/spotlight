import { type FormEvent, useRef, useState } from 'react';
import { AttachButton } from '@/components/shared/attachment/AttachButton';
import { PendingAttachments } from '@/components/shared/attachment/PendingAttachments';
import { AutoGrowTextarea } from '@/components/shared/form/AutoGrowTextarea';
import { MarkdownEditor } from '@/components/shared/form/MarkdownEditor';
import { Breadcrumbs } from '@/components/shell/layout/Breadcrumbs';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { useAttachments } from '@/hooks/useAttachments';
import type { NewTask } from '@/lib/task';

type NewTaskDialogProps = {
  slug: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lineName: string;
  stationName: string;
  onCreate: (task: NewTask) => void;
};

export function NewTaskDialog({
  slug,
  open,
  onOpenChange,
  lineName,
  stationName,
  onCreate,
}: NewTaskDialogProps) {
  const [title, setTitle] = useState('');
  const description = useRef('');
  const [more, setMore] = useState(false);
  const [round, setRound] = useState(0);
  const draft = useAttachments(slug);

  const uncreatable = !title.trim() || draft.uploading;

  const reset = () => {
    setTitle('');
    description.current = '';
    draft.clear();
    setRound((each) => each + 1);
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (uncreatable) {
      return;
    }

    onCreate({
      title: title.trim(),
      description: description.current.trim(),
      attachments: draft.ids,
    });

    if (more) {
      reset();
    } else {
      onOpenChange(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      onOpenChangeComplete={(open) => !open && reset()}
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

        <form onSubmit={submit} {...draft.handlers} className="contents">
          <ScrollArea
            className="max-h-[60vh]"
            contentClassName="flex flex-col gap-3"
          >
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
              onChange={(written) => {
                description.current = written;
              }}
              placeholder="Add description…"
              ariaLabel="Task description"
              className="min-h-24 border-none bg-transparent p-0"
              placeholderClassName="top-0 left-0"
            />

            <PendingAttachments
              attachments={draft.attachments}
              onRemove={draft.remove}
            />
          </ScrollArea>

          <DialogFooter className="items-center sm:justify-between">
            <AttachButton
              onAttach={draft.add}
              className="rounded-full border-border text-muted-foreground"
            />

            <div className="flex items-center gap-3">
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

              <Button type="submit" size="sm" disabled={uncreatable}>
                Create task
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
