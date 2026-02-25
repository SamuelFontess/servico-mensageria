import { config } from '../../config';
import { sendEmail } from '../send';
import { renderTemplate } from '../template';
import type { FamilyInvitePayload } from '../../queue/types';

export async function handleFamilyInvite(payload: FamilyInvitePayload): Promise<void> {
  const acceptLink = `${config.frontendUrl}/dashboard/family/invite?invitationId=${payload.invitationId}`;
  const familyName = payload.familyName ?? 'a família';

  const html = renderTemplate('family-invite.html', {
    inviterName: payload.inviterName,
    familyName,
    acceptLink,
  });

  await sendEmail({
    to: payload.invitedEmail,
    subject: `${payload.inviterName} convidou você para ${familyName}`,
    html,
  });
}
