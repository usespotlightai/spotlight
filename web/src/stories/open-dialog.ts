import type { Script } from '@/stories/ScriptedApplication';

export const openDialog =
  (button: string): Script =>
  async (screen, user) => {
    await user.click(
      await screen.findByRole('button', { name: button }, { timeout: 5_000 }),
    );
    await screen.findByRole('dialog');
  };
