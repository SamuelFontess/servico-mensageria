import { config } from '../../config';
import { sendEmail } from '../send';
import { renderTemplate } from '../template';
import { logger } from '../../logger';
import type { FamilyInviteRegisterPayload } from '../../queue/types';

export async function handleFamilyInviteRegister(payload: FamilyInviteRegisterPayload): Promise<void> {
  logger.info('Handling family invite register', {
    invitationId: payload.invitationId,
    invitedById: payload.invitedById,
  });

  const registerLink = `${config.frontendUrl}/register?email=${encodeURIComponent(payload.invitedEmail)}&invitationId=${payload.invitationId}`;
  const familyName = payload.familyName ?? 'a família';

  const html = renderTemplate('family-invite-register.html', {
    inviterName: payload.inviterName,
    familyName,
    registerLink,
  });

  await sendEmail({
    to: payload.invitedEmail,
    subject: `${payload.inviterName} convidou você para ${familyName}`,
    html,
  });
}
