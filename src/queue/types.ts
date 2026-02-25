export type EmailJobType = 'family_invite' | 'forgot_password' | 'broadcast_message';

export type FamilyInvitePayload = {
  invitationId: string;
  familyId: string;
  familyName: string | null;
  invitedById: string;
  invitedUserId: string;
  invitedEmail: string;
  inviterName: string;
  inviterEmail: string;
};

export type ForgotPasswordPayload = {
  userId: string;
  email: string;
  token: string;      // raw hex token — worker constrói o link
  expiresAt: string;  // ISO 8601
};

export type BroadcastMessagePayload = {
  type?: string;
  content: string;
  target?: 'broadcast' | string;
};
