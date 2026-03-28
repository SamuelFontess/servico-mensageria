import { config } from '../../config';
import { sendEmail } from '../send';
import { renderTemplate } from '../template';
import type { ForgotPasswordPayload } from '../../queue/types';

export async function handleForgotPassword(payload: ForgotPasswordPayload): Promise<void> {
  if (new Date(payload.expiresAt).getTime() <= Date.now()) {
    throw new Error(`Password reset token already expired for ${payload.email} (expiresAt: ${payload.expiresAt})`);
  }

  const remaining = Math.max(1, Math.round((new Date(payload.expiresAt).getTime() - Date.now()) / 60_000));

  const resetLink = `${config.frontendUrl}/reset-password?token=${payload.token}`;
  const expiresIn = String(remaining);

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
