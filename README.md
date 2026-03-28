# email-worker

Serviço de mensageria responsável por consumir jobs das filas Redis (BullMQ), enviar e-mails transacionais e emitir eventos em tempo real via WebSocket.

---

## Visão geral

O Driver backend publica jobs em filas Redis gerenciadas pelo BullMQ. Este serviço consome esses jobs de forma assíncrona: a fila `email` processa envios de e-mail, e a fila `broadcast` entrega mensagens em tempo real via WebSocket.

```
Driver Backend
  ├── publishEmailJob('family_invite' | 'forgot_password', payload) → fila: email
  └── publishBroadcastJob('broadcast_message', payload)             → fila: broadcast
          │
          ▼ BullMQ (Redis)
email-worker
  ├── EmailWorker     → fila 'email'     → envia e-mail (Brevo) → emite email:status via WS
  ├── BroadcastWorker → fila 'broadcast' → emite message via WS (sem envio de e-mail)
  ├── WebSocket Server → requer ?token=<ADMIN_API_KEY> na URL de conexão
  └── HTTP Server
        ├── GET  /health              (pública)
        ├── POST /admin/message       (Header X-Admin-Key)
        └── GET  /admin/queues        (Basic Auth — Bull Board UI)
```

---

## Funcionalidades

### Filas consumidas

| Fila | Job | Descrição |
|---|---|---|
| `email` | `family_invite` | Envia e-mail de convite para um membro ingressar em uma família |
| `email` | `forgot_password` | Envia e-mail com link de redefinição de senha |
| `broadcast` | `broadcast_message` | Emite mensagem via WebSocket para todos os clientes conectados |

> **Importante:** o job `broadcast_message` deve ser publicado na fila `broadcast`, não na fila `email`.

### Eventos WebSocket emitidos

| Evento | Quando |
|---|---|
| `email:status` | Após envio ou falha definitiva de qualquer e-mail |
| `message` | Quando o admin envia via `POST /admin/message` ou ao processar `broadcast_message` |

### Rotas HTTP

| Método | Rota | Auth | Descrição |
|---|---|---|---|
| `GET` | `/health` | Pública | Status do serviço |
| `POST` | `/admin/message` | Header `X-Admin-Key` | Envia mensagem broadcast para todos os clientes WebSocket |
| `GET` | `/admin/queues` | Basic Auth | Bull Board — dashboard visual das filas BullMQ |

---

## Arquitetura

```
email-worker/
├── src/
│   ├── index.ts                   # Entry point — orquestra HTTP, WS e Workers
│   ├── config.ts                  # Lê e valida variáveis de ambiente
│   ├── logger.ts                  # Logger estruturado em JSON
│   ├── redis.ts                   # Helper createRedisConnection (ioredis)
│   ├── queue/
│   │   ├── types.ts               # Tipos dos payloads de cada job
│   │   ├── worker.ts              # BullMQ Worker da fila 'email'
│   │   └── broadcastWorker.ts     # BullMQ Worker da fila 'broadcast'
│   ├── email/
│   │   ├── send.ts                # Envio de e-mail via Brevo HTTP API
│   │   ├── template.ts            # Renderizador de templates HTML
│   │   └── handlers/
│   │       ├── familyInvite.ts    # Monta e envia e-mail de convite
│   │       └── forgotPassword.ts  # Monta e envia e-mail de reset
│   ├── websocket/
│   │   ├── server.ts              # WebSocket Server com autenticação por token
│   │   └── broadcast.ts           # Função broadcast tipada
│   └── http/
│       ├── server.ts              # Express + http.Server
│       ├── bullBoard.ts           # Configura Bull Board com IP allowlist
│       ├── middleware/
│       │   └── adminAuth.ts       # Valida header X-Admin-Key / Basic Auth
│       └── routes/
│           └── admin.ts           # POST /admin/message
└── templates/
    ├── family-invite.html         # Template HTML do convite
    └── forgot-password.html       # Template HTML de reset de senha
```

---

## Fila e retry

A configuração de retry (tentativas, backoff) deve ser definida pelo **produtor** ao enfileirar o job. O worker não impõe uma política própria.

Recomendação para o Driver backend:

```typescript
await emailQueue.add('family_invite', payload, {
  attempts: 3,
  backoff: { type: 'exponential', delay: 2000 },
  removeOnComplete: 100,
  removeOnFail: 500,
});
```

Se um job falhar em todas as tentativas, vai para a fila `failed` do BullMQ e um evento `email:status` com `status: "failed"` é emitido via WebSocket.

---

## WebSocket

O servidor WebSocket compartilha a mesma porta do servidor HTTP. Os clientes **devem** passar o token de autenticação na URL de conexão:

```
ws://localhost:3002?token=<ADMIN_API_KEY>           # local
wss://seu-worker.exemplo.com?token=<ADMIN_API_KEY>  # produção
```

Conexões sem token ou com token inválido recebem `close(4401, 'Unauthorized')` e o evento é registrado em log com o IP de origem.

### Evento `email:status`

Emitido após cada job de e-mail ser concluído ou falhar definitivamente.

```json
{
  "event": "email:status",
  "jobId": "1",
  "type": "family_invite",
  "status": "sent",
  "email": "destinatario@exemplo.com"
}
```

| Campo | Tipo | Descrição |
|---|---|---|
| `event` | `string` | Sempre `"email:status"` |
| `jobId` | `string` | ID do job BullMQ |
| `type` | `string` | `family_invite` ou `forgot_password` |
| `status` | `string` | `"sent"` ou `"failed"` |
| `email` | `string?` | Presente em `sent`. Endereço de destino |
| `error` | `string?` | Presente em `failed`. Mensagem genérica |

### Evento `message`

Emitido ao processar um job `broadcast_message` ou via `POST /admin/message`.

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

### Heartbeat

O servidor envia `ping` a cada `WS_HEARTBEAT_INTERVAL_MS` (padrão: 30s). Conexões que não respondem com `pong` são encerradas automaticamente.

---

## Bull Board

Dashboard web em `/admin/queues` com visualização em tempo real das filas `email` e `broadcast`:

- Jobs pendentes, ativos, concluídos e falhos
- Payload e histórico de tentativas de cada job
- Reprocessamento de jobs falhos com um clique

**Acesso:** qualquer username (ex: `admin`) + `ADMIN_API_KEY` como senha.

**Restrição por IP (opcional):** defina `BULL_BOARD_ALLOWED_IPS` para limitar quais IPs podem acessar a dashboard. Se vazia, qualquer IP com credenciais válidas pode acessar.

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

**Resposta 200:**
```json
{
  "id": "uuid-v4",
  "createdAt": "2026-02-25T10:00:00.000Z"
}
```

**Exemplo com curl:**
```bash
curl -X POST https://seu-worker.exemplo.com/admin/message \
  -H "Content-Type: application/json" \
  -H "X-Admin-Key: sua-chave-admin" \
  -d '{"type": "announcement", "content": "Manutenção programada às 22h"}'
```

---

## Variáveis de ambiente

| Variável | Obrigatória | Padrão | Descrição |
|---|---|---|---|
| `REDIS_URL` | Sim | — | URL de conexão com o Redis (ex: `redis://localhost:6379`) |
| `ADMIN_API_KEY` | Sim | — | Chave para autenticar `POST /admin/message`, Basic Auth do Bull Board e conexões WebSocket |
| `BREVO_API_KEY` | Sim | — | Chave de API do Brevo (Settings → API Keys) |
| `BREVO_FROM` | Sim | — | E-mail remetente verificado no Brevo |
| `BREVO_FROM_NAME` | Não | `Driver App` | Nome exibido no remetente |
| `FRONTEND_URL` | Sim | — | URL base do frontend (usada para construir links nos e-mails) |
| `PORT` | Não | `3002` | Porta do servidor HTTP + WebSocket |
| `WS_HEARTBEAT_INTERVAL_MS` | Não | `30000` | Intervalo do ping WebSocket em ms |
| `BULL_BOARD_ALLOWED_IPS` | Não | `""` | IPs separados por vírgula autorizados a acessar `/admin/queues`. Se vazio, sem restrição de IP |

---

## Provedor de e-mail

O serviço usa exclusivamente o **Brevo** para envio de e-mails via HTTP API (porta 443).

**Pré-requisitos:**
1. Crie uma conta em [brevo.com](https://brevo.com)
2. Vá em **Settings → Senders & IPs → Senders** e verifique o e-mail remetente
3. Vá em **Settings → API Keys** e crie uma API Key

**Limite do plano gratuito:** 300 emails/dia.

---

## Deploy com Docker Compose

O serviço possui seu próprio `docker-compose.yml` independente do projeto-driver. Isso permite deploys e restarts sem afetar os outros serviços.

**Pré-requisito:** a rede `driver_net` deve existir (criada pelo docker-compose do projeto-driver).

```bash
# Na pasta do email-worker no servidor:
cp .env.example .env
# Preencha as variáveis no .env

docker compose up -d
```

O Watchtower incluso no compose monitora apenas o container `driver_email_worker` (escopo isolado), sem interferir no Watchtower do projeto-driver.

---

## Rodando localmente

**Pré-requisitos:** Node.js 22+, Redis rodando localmente.

```bash
git clone https://github.com/SamuelFontess/servico-mensageria.git
cd servico-mensageria
npm install
cp .env.example .env
# Preencha as variáveis no .env
```

```bash
npm run dev    # desenvolvimento
npm run build  # build TypeScript
npm start      # produção
```

```bash
# Health check
curl http://localhost:3002/health

# Testar WebSocket (necessário wscat: npm i -g wscat)
wscat -c "ws://localhost:3002?token=sua-chave-admin"

# Testar envio de mensagem admin
curl -X POST http://localhost:3002/admin/message \
  -H "Content-Type: application/json" \
  -H "X-Admin-Key: sua-chave-admin" \
  -d '{"content": "Teste"}'
```

---

## Payloads dos jobs (contrato com o Driver)

### Fila `email` — job `family_invite`

```typescript
{
  invitationId: string;
  familyId: string;
  familyName: string | null;
  invitedById: string;
  invitedUserId: string;
  invitedEmail: string;
  inviterName: string;
  inviterEmail: string;
}
```

### Fila `email` — job `forgot_password`

```typescript
{
  userId: string;
  email: string;
  token: string;       // token raw — o worker constrói o link completo
  expiresAt: string;   // ISO 8601 — jobs com token já expirado são rejeitados imediatamente
}
```

### Fila `broadcast` — job `broadcast_message`

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
| Node.js 22 + TypeScript | Runtime e linguagem |
| BullMQ | Consumo de filas Redis |
| ioredis | Conexão com Redis |
| ws | Servidor WebSocket |
| Express | Servidor HTTP |
| Brevo HTTP API | Envio de e-mails transacionais |
