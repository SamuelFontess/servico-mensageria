import { config } from '../../config';
import { sendEmail } from '../send';
import { renderTemplate } from '../template';
import type { ForgotPasswordPayload } from '../../queue/types';

function minutesUntil(isoDate: string): number {
  const diff = new Date(isoDate).getTime() - Date.now();
  return Math.max(0, Math.round(diff / 60_000));
}

export async function handleForgotPassword(payload: ForgotPasswordPayload): Promise<void> {
  const resetLink = `${config.frontendUrl}/reset-password?token=${payload.token}`;
  const expiresIn = String(minutesUntil(payload.expiresAt));

  const html = renderTemplate('forgot-password.html', {
    resetLink,
    expiresIn,
  });

  await sendEmail({
    to: payload.email,
    subject: 'Redefinição de senha',
    html,
  });
}
