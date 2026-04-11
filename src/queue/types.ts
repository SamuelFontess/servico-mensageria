export type EmailJobType = 'family_invite' | 'family_invite_register' | 'forgot_password' | 'manual_email' | 'broadcast_email';

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

export type FamilyInviteRegisterPayload = {
  invitationId: string;
  familyId: string;
  familyName: string | null;
  invitedById: string;
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

export type ManualEmailPayload = {
  to: string;
  subject: string;
  html: string;
};

export type BroadcastMessagePayload = {
  type?: string;
  content: string;
  target?: 'broadcast' | string;
};

export type BroadcastEmailPayload = {
  to: string;
  subject: string;
  title: string;
  message: string;
};
