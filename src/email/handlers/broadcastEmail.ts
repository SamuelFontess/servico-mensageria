import { sendEmail } from '../send';
import { renderTemplate } from '../template';
import { logger } from '../../logger';
import type { BroadcastEmailPayload } from '../../queue/types';

export async function handleBroadcastEmail(payload: BroadcastEmailPayload): Promise<void> {
  logger.info('Handling broadcast email', { to: payload.to });

  const html = renderTemplate('broadcast.html', {
    title: payload.title,
    message: payload.message,
  });

  await sendEmail({
    to: payload.to,
    subject: payload.subject,
    html,
  });
}
