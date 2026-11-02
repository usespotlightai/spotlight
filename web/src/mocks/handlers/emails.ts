import type { AddMyEmailData } from '@/lib/api';
import { sameAddress } from '@/lib/members';
import { hoursAgo } from '@/mocks/clock';
import { api, json, noContent, notFound, problem } from '@/mocks/http';
import { emailsWorld, SIGN_IN_EMAIL, userEmail } from '@/mocks/world/emails';

export const emailsHandlers = [
  api.get('/me/emails', () =>
    json({ signInEmail: SIGN_IN_EMAIL, additional: emailsWorld().additional }),
  ),

  api.post('/me/emails', async ({ request }) => {
    const { email } = (await request.json()) as AddMyEmailData['body'];
    const store = emailsWorld();

    if (sameAddress(email, SIGN_IN_EMAIL)) {
      return problem(
        422,
        `${email} is your sign-in email. It is not an additional email.`,
      );
    }

    const found = store.additional.find((each) =>
      sameAddress(each.email, email),
    );

    if (found?.status === 'verified') {
      return problem(409, `${email} is already in your emails.`);
    }

    const added = userEmail(email.trim().toLowerCase());

    store.additional = [
      ...store.additional.filter((each) => each !== found),
      added,
    ];
    return json(added);
  }),

  api.post('/me/emails/:userEmailId/resend', ({ params }) => {
    const found = emailsWorld().additional.find(
      (each) => each.id === params.userEmailId,
    );

    if (!found) {
      return notFound();
    }

    Object.assign(found, { status: 'pending', sentAt: hoursAgo(0) });
    return json(found);
  }),

  api.delete('/me/emails/:userEmailId', ({ params }) => {
    const store = emailsWorld();

    if (!store.additional.some((each) => each.id === params.userEmailId)) {
      return notFound();
    }

    store.additional = store.additional.filter(
      (each) => each.id !== params.userEmailId,
    );
    return noContent();
  }),

  api.post('/me/email-verifications/:token', () => {
    const found = emailsWorld().additional.find(
      (each) => each.status !== 'verified',
    );

    if (!found) {
      return notFound();
    }

    found.status = 'verified';
    return json(found);
  }),
];
