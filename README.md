# email-worker

Serviço de mensageria responsável por consumir jobs da fila Redis (BullMQ), enviar e-mails transacionais e emitir eventos em tempo real via WebSocket.

---

## Visão geral

O Driver backend publica jobs numa fila Redis gerenciada pelo BullMQ. Este serviço consome esses jobs de forma assíncrona, processa o envio de e-mail e notifica os clientes conectados sobre o resultado via WebSocket.

```
Driver Backend
  └── publishEmailJob('family_invite' | 'forgot_password', payload)
          │
          ▼ BullMQ (Redis)
email-worker
  ├── Worker BullMQ → processa job → envia e-mail (Resend ou SMTP)
  ├── WebSocket Server → emite email:status (sent | failed) para clientes
  └── HTTP Server → GET /health · POST /admin/message
```

---

## Funcionalidades

### Tipos de job consumidos

| Job | Descrição |
|---|---|
| `family_invite` | Envia e-mail de convite para um membro ingressar em uma família |
| `forgot_password` | Envia e-mail com link de redefinição de senha |
| `broadcast_message` | (futuro) Emite mensagem via WebSocket sem envio de e-mail |

### Eventos WebSocket emitidos

| Evento | Quando |
|---|---|
| `email:status` | Após envio ou falha definitiva de qualquer e-mail |
| `message` | Quando o admin envia uma mensagem via `POST /admin/message` |

### Rotas HTTP

| Método | Rota | Auth | Descrição |
|---|---|---|---|
| `GET` | `/health` | Pública | Status do serviço |
| `POST` | `/admin/message` | `X-Admin-Key` | Envia mensagem broadcast para todos os clientes WebSocket |

---

## Arquitetura

```
email-worker/
├── src/
│   ├── index.ts                   # Entry point — orquestra HTTP, WS e Worker
│   ├── config.ts                  # Lê e valida variáveis de ambiente
│   ├── logger.ts                  # Logger estruturado em JSON
│   ├── queue/
│   │   ├── types.ts               # Tipos dos payloads de cada job
│   │   └── worker.ts              # BullMQ Worker: dispatch, eventos, broadcast
│   ├── email/
│   │   ├── send.ts                # Abstração de envio: Resend ou SMTP
│   │   ├── template.ts            # Renderizador de templates HTML
│   │   └── handlers/
│   │       ├── familyInvite.ts    # Monta e envia e-mail de convite
│   │       └── forgotPassword.ts  # Monta e envia e-mail de reset
│   ├── websocket/
│   │   ├── server.ts              # WebSocket Server (compartilha http.Server)
│   │   └── broadcast.ts           # Função broadcast tipada
│   └── http/
│       ├── server.ts              # Express + http.Server
│       ├── middleware/
│       │   └── adminAuth.ts       # Valida header X-Admin-Key
│       └── routes/
│           └── admin.ts           # POST /admin/message
└── templates/
    ├── family-invite.html         # Template HTML do convite
    └── forgot-password.html       # Template HTML de reset de senha
```

---

## Fila e retry

O BullMQ gerencia retry automaticamente. Configuração aplicada a cada job:

| Parâmetro | Valor |
|---|---|
| Tentativas máximas | 3 |
| Estratégia de backoff | Exponencial |
| Delay inicial | 2 segundos |
| Jobs concluídos mantidos | 100 |
| Jobs falhos mantidos | 500 |

Se um job falhar nas 3 tentativas, vai para a fila `failed` do BullMQ e um evento `email:status` com `status: "failed"` é emitido via WebSocket.

---

## WebSocket

O servidor WebSocket compartilha a mesma porta do servidor HTTP (Railway-compatible). Os clientes se conectam via:

```
ws://localhost:PORT         # local
wss://seu-servico.railway.app  # produção
```

### Evento `email:status`

Emitido após cada job de e-mail ser concluído ou falhar definitivamente.

```json
{
  "event": "email:status",
  "jobId": "1",
  "type": "family_invite",
  "status": "sent",
  "error": "mensagem genérica (apenas em status: failed)"
}
```

| Campo | Tipo | Descrição |
|---|---|---|
| `event` | `string` | Sempre `"email:status"` |
| `jobId` | `string` | ID do job BullMQ |
| `type` | `string` | `family_invite` ou `forgot_password` |
| `status` | `string` | `"sent"` ou `"failed"` |
| `error` | `string?` | Presente apenas em `failed`. Mensagem genérica, sem tokens |

### Evento `message`

Emitido quando o admin envia uma mensagem via `POST /admin/message` ou quando um job `broadcast_message` é processado.

```json
{
  "event": "message",
  "id": "uuid-v4",
  "type": "announcement",
  "content": "Texto da mensagem",
  "createdAt": "2026-02-25T10:00:00.000Z",
  "target": "broadcast"
}
```

| Campo | Tipo | Descrição |
|---|---|---|
| `event` | `string` | Sempre `"message"` |
| `id` | `string` | UUID único da mensagem |
| `type` | `string?` | Categoria da mensagem (ex: `announcement`, `notification`) |
| `content` | `string` | Conteúdo da mensagem |
| `createdAt` | `string` | ISO 8601 |
| `target` | `string?` | `"broadcast"` ou identificador de canal (futuro) |

### Heartbeat

O servidor envia `ping` a cada `WS_HEARTBEAT_INTERVAL_MS` (padrão: 30s). Conexões que não respondem com `pong` são encerradas automaticamente.

---

## API admin

### `POST /admin/message`

Envia uma mensagem de broadcast para todos os clientes WebSocket conectados.

**Header obrigatório:**
```
X-Admin-Key: sua-chave-admin
```

**Body:**
```json
{
  "content": "Texto da mensagem",
  "type": "announcement",
  "target": "broadcast"
}
```

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `content` | `string` | Sim | Texto da mensagem |
| `type` | `string` | Não | Categoria da mensagem |
| `target` | `string` | Não | Padrão: `"broadcast"` |

**Resposta 200:**
```json
{
  "id": "uuid-v4",
  "createdAt": "2026-02-25T10:00:00.000Z"
}
```

**Exemplo com curl:**
```bash
curl -X POST https://seu-servico.railway.app/admin/message \
  -H "Content-Type: application/json" \
  -H "X-Admin-Key: sua-chave-admin" \
  -d '{"type": "announcement", "content": "Manutenção programada às 22h"}'
```

---

## Variáveis de ambiente

Copie `.env.example` para `.env` e preencha os valores.

| Variável | Obrigatória | Padrão | Descrição |
|---|---|---|---|
| `REDIS_URL` | Sim | — | URL de conexão com o Redis (ex: `redis://localhost:6379`) |
| `ADMIN_API_KEY` | Sim | — | Chave para autenticar chamadas ao `POST /admin/message` |
| `EMAIL_PROVIDER` | Não | `resend` | Provedor de e-mail: `resend` ou `smtp` |
| `RESEND_API_KEY` | Se provider=resend | — | Chave de API do Resend |
| `RESEND_FROM` | Se provider=resend | — | E-mail remetente (ex: `noreply@dominio.com`) |
| `SMTP_HOST` | Se provider=smtp | — | Host do servidor SMTP |
| `SMTP_PORT` | Se provider=smtp | `587` | Porta SMTP |
| `SMTP_USER` | Se provider=smtp | — | Usuário SMTP |
| `SMTP_PASS` | Se provider=smtp | — | Senha SMTP |
| `SMTP_FROM` | Se provider=smtp | — | E-mail remetente |
| `FRONTEND_URL` | Não | `http://localhost:3001` | URL base do frontend (usada para construir links nos e-mails) |
| `PORT` | Não | `3002` | Porta do servidor HTTP + WebSocket |
| `WS_HEARTBEAT_INTERVAL_MS` | Não | `30000` | Intervalo do ping WebSocket em ms |

---

## Rodando localmente

### Pré-requisitos

- Node.js 20+
- Redis rodando localmente (`redis://localhost:6379`)
- Conta no [Resend](https://resend.com) (ou servidor SMTP)

### Instalação

```bash
git clone https://github.com/seu-usuario/email-worker.git
cd email-worker
npm install
cp .env.example .env
# Preencha as variáveis no .env
```

### Desenvolvimento

```bash
npm run dev
```

### Build e produção

```bash
npm run build
npm start
```

### Verificar se está rodando

```bash
# Health check
curl http://localhost:3002/health

# Testar WebSocket (necessário wscat: npm i -g wscat)
wscat -c ws://localhost:3002

# Testar envio de mensagem admin
curl -X POST http://localhost:3002/admin/message \
  -H "Content-Type: application/json" \
  -H "X-Admin-Key: sua-chave" \
  -d '{"content": "Teste"}'
```

---

## Payloads dos jobs (contrato com o Driver)

O Driver backend publica jobs via BullMQ. Os payloads devem seguir este contrato:

### `family_invite`

```typescript
{
  invitationId: string;   // ID do FamilyMember
  familyId: string;
  familyName: string | null;
  invitedById: string;
  invitedUserId: string;
  invitedEmail: string;   // destinatário do e-mail
  inviterName: string;    // nome exibido no e-mail
  inviterEmail: string;
}
```

### `forgot_password`

```typescript
{
  userId: string;
  email: string;          // destinatário do e-mail
  token: string;          // token raw — o worker constrói o link completo
  expiresAt: string;      // ISO 8601
}
```

### `broadcast_message` (futuro)

```typescript
{
  type?: string;
  content: string;
  target?: 'broadcast' | string;
}
```

---

## Stack

| Tecnologia | Uso |
|---|---|
| Node.js + TypeScript | Runtime e linguagem |
| BullMQ | Consumo de fila Redis |
| ioredis | Conexão com Redis |
| ws | Servidor WebSocket |
| Express | Servidor HTTP (health + admin) |
| Resend / Nodemailer | Envio de e-mails |
