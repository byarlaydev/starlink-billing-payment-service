# Starlink Bill Payment Service

> **Disclaimer**: This is an independent third-party billing assistance service. It is NOT affiliated with, endorsed by, or operated by Starlink or SpaceX.

## Overview

A production-ready Facebook Messenger chatbot application that assists customers with Starlink billing payments through AI-powered automation.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Nginx (Reverse Proxy)                 │
├─────────────────────────┬───────────────────────────────┤
│   Next.js Frontend      │     NestJS Backend API        │
│   (Admin Dashboard)     │     (REST API + Webhooks)     │
├─────────────────────────┴───────────────────────────────┤
│                    PostgreSQL + Redis                     │
├─────────────────────────────────────────────────────────┤
│  External Services                                      │
│  • Facebook Messenger Platform API                      │
│  • Google Gemini AI API                                 │
│  • Telegram Bot API                                     │
└─────────────────────────────────────────────────────────┘
```

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Frontend | Next.js 14 + React 18 + Tailwind CSS |
| Backend | NestJS 10 + TypeScript |
| Database | PostgreSQL 16 |
| ORM | Prisma 5 |
| Cache/Queue | Redis 7 + BullMQ |
| AI | Google Gemini API |
| Messaging | Facebook Messenger Platform |
| Notifications | Telegram Bot API |
| Auth | JWT + Passport.js |
| Deployment | Docker + Nginx |
| CI/CD | GitHub Actions |

## Quick Start

### Prerequisites

- Node.js 20+
- Docker & Docker Compose
- PostgreSQL 16 (or use Docker)
- Redis 7 (or use Docker)

### 1. Clone and Setup

```bash
cp .env.example .env
# Edit .env with your credentials
```

### 2. Start with Docker Compose

```bash
docker compose up -d
```

### 3. Local Development

```bash
# Start infrastructure
docker compose up postgres redis -d

# Backend
cd backend
npm install
npx prisma migrate dev
npx prisma db seed
npm run start:dev

# Frontend
cd frontend
npm install
npm run dev
```

### 4. Access

- Frontend: http://localhost:3000
- Backend API: http://localhost:3001/api/v1
- API Docs: http://localhost:3001/api/docs
- Default Admin: admin@example.com / admin123456

## Project Structure

```
├── backend/                    # NestJS Backend
│   ├── prisma/
│   │   ├── schema.prisma      # Database schema
│   │   └── seed.ts            # Seed data
│   └── src/
│       ├── ai/                # AI provider abstraction
│       │   ├── interfaces/    # AIProvider interface
│       │   ├── providers/     # Gemini, OpenAI, etc.
│       │   └── prompts/       # System prompts
│       ├── common/            # Shared utilities
│       ├── config/            # Prisma, config
│       └── modules/
│           ├── auth/          # Authentication
│           ├── billing/       # Billing requests
│           ├── customers/     # Customer management
│           ├── health/        # Health checks
│           ├── messenger/     # Facebook Messenger
│           ├── ocr/           # OCR processing
│           ├── payment-proofs/# Payment proof uploads
│           ├── queue/         # Background jobs
│           ├── settings/      # System settings
│           └── telegram/      # Telegram notifications
├── frontend/                   # Next.js Frontend
│   └── src/
│       ├── app/               # Pages & layouts
│       ├── components/        # UI components
│       └── lib/               # Utilities & API client
├── nginx/                      # Nginx configuration
├── docker-compose.yml          # Docker orchestration
└── .github/workflows/          # CI/CD pipelines
```

## API Endpoints

### Authentication
- `POST /api/v1/auth/login` - Admin login
- `POST /api/v1/auth/refresh` - Refresh token
- `GET /api/v1/auth/profile` - Get profile

### Billing
- `GET /api/v1/billing` - List requests (with filters)
- `GET /api/v1/billing/stats` - Request statistics
- `GET /api/v1/billing/analytics` - Analytics data
- `GET /api/v1/billing/:id` - Get request details
- `PUT /api/v1/billing/:id/status` - Update status

### Payment Proofs
- `POST /api/v1/payment-proofs/upload/:billingRequestId` - Upload proof
- `GET /api/v1/payment-proofs/:id` - Get proof details
- `GET /api/v1/payment-proofs/:id/file` - Download file

### OCR
- `POST /api/v1/ocr/process/:paymentProofId` - Process OCR
- `GET /api/v1/ocr/manual-review` - Manual review queue
- `GET /api/v1/ocr/confidence-distribution` - Confidence stats

### Settings
- `GET /api/v1/settings` - All settings
- `GET /api/v1/settings/:category` - Category settings
- `PUT /api/v1/settings/:category` - Update settings

### Messenger
- `GET /messenger/webhook` - Webhook verification
- `POST /messenger/webhook` - Webhook events

### Health
- `GET /health` - Health check

## Database Schema

Key tables:
- `customers` - Customer profiles
- `messenger_conversations` - Chat history
- `billing_requests` - Billing submissions
- `payment_proofs` - Uploaded payment files
- `ocr_results` - Extracted OCR data
- `ai_responses` - AI interaction logs
- `telegram_notifications` - Notification history
- `settings` - System configuration
- `admin_users` - Admin accounts
- `activity_logs` - Audit trail
- `webhook_events` - Idempotency tracking
- `prompt_versions` - AI prompt versioning

## Security Features

- JWT authentication with refresh tokens
- Role-based access control (SUPER_ADMIN, ADMIN, OPERATOR, VIEWER)
- AES-256-GCM encryption for sensitive settings
- Rate limiting per endpoint
- Webhook event idempotency
- File upload validation
- CORS configuration
- Helmet.js security headers
- Audit logging for all actions
- GDPR data export/delete support

## AI Provider Abstraction

The system uses an `AIProvider` interface making it easy to swap AI engines:

```typescript
interface AIProvider {
  chat(messages: ChatMessage[]): Promise<ChatResponse>;
  extractPaymentProof(buffer: Buffer, mimeType: string): Promise<OCRResult>;
  detectIntent(message: string, context?: string[]): Promise<IntentResult>;
  analyzeDocument(buffer: Buffer, mimeType: string, prompt: string): Promise<...>;
}
```

Default: Google Gemini. Add OpenAI, Anthropic, or other providers by implementing the interface.

## Background Jobs

- **OCR Queue**: Payment proof processing
- **Notification Queue**: Telegram notifications
- **AI Queue**: Summaries, validation
- **Backup Queue**: Database backups

## Environment Variables

See `.env.example` for all configuration options.

## License

Private - All rights reserved.
