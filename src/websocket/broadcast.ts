import WebSocket from 'ws';

export type EmailStatusEvent = {
  event: 'email:status';
  jobId: string;
  type: 'family_invite' | 'family_invite_register' | 'forgot_password' | 'manual_email' | 'broadcast_email';
  status: 'sent' | 'failed';
  userId?: string;
  email?: string;
  error?: string;
};

export type MessageEvent = {
  event: 'message';
  id: string;
  type?: string;
  content: string;
  createdAt: string;
  target?: 'broadcast' | string;
};

export type BroadcastPayload = EmailStatusEvent | MessageEvent;

export function broadcast(wss: WebSocket.Server, data: BroadcastPayload): void {
  const message = JSON.stringify(data);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}
