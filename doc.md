# 🏦 Vessify Finance — Project Documentation

> **Personal Finance Transaction Extractor**  
> A production-grade, secure, multi-tenant modular monolith built with **Hono.js** + **Next.js**

---

## 📋 Table of Contents

1. [Project Overview](#1-project-overview)
2. [Tech Stack](#2-tech-stack)
3. [System Architecture](#3-system-architecture)
4. [How It Was Built — Module by Module](#4-how-it-was-built)
5. [Database Schema](#5-database-schema)
6. [API Reference](#6-api-reference)
7. [Smart Parser — The Core Engine](#7-smart-parser)
8. [Security Design](#8-security-design)
9. [Running the Project](#9-running-the-project)
10. [Loom Video Script](#10-loom-video-script)

---

## 1. Project Overview

Vessify Finance is a **full-stack web application** that lets authenticated users paste raw bank statement text and automatically extract structured transaction data using intelligent text parsing.

### Key Features

| Feature | Description |
|---|---|
| 🔐 **Secure Auth** | Email/password authentication via Better Auth with HTTP-only cookie sessions |
| 🏢 **Multi-tenancy** | Each user gets a personal "organization" — transactions are fully isolated |
| 🧠 **Smart Parser** | 3-strategy parser extracts dates, amounts, descriptions from messy bank text |
| 📊 **Dashboard** | Real-time transaction history with cursor-based pagination |
| 🐳 **Docker Ready** | One-command `docker compose up` deployment |
| ✅ **Tested** | Unit tests for parser + integration tests for auth and data isolation |

---

## 2. Tech Stack

### Backend
| Tool | Purpose | Why It Was Chosen |
|---|---|---|
| **Hono.js** | HTTP framework | Ultra-lightweight, edge-ready, has Node.js adapter; 5x faster than Express |
| **TypeScript** | Language | Type safety across the entire API surface |
| **Prisma** | ORM | Type-safe database queries, auto-generated client, easy migrations |
| **PostgreSQL** | Database | Production-grade relational DB, great index support |
| **Better Auth** | Auth library | Handles sessions, organizations, password hashing out-of-the-box |
| **Zod** | Validation | Runtime schema validation for env vars, request bodies, and query params |
| **Pino** | Logging | Structured JSON logging; extremely fast |
| **Vitest** | Testing | Modern test runner compatible with TypeScript/ESM |

### Frontend
| Tool | Purpose |
|---|---|
| **Next.js 16** | React framework with App Router |
| **React 19** | UI library |
| **Better Auth (client)** | Frontend auth state management + session hooks |
| **shadcn/ui** | Pre-built accessible UI components |
| **Tailwind CSS v4** | Utility-first styling |
| **Sonner** | Toast notifications |

### Infrastructure
| Tool | Purpose |
|---|---|
| **Docker + Docker Compose** | Containerization of all 3 services |
| **Node.js** | Backend runtime |

---

## 3. System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Client Browser                               │
│                    Next.js App (Port 3000)                          │
│   ┌─────────────┐  ┌──────────────────────┐  ┌─────────────────┐  │
│   │  /login     │  │  / (Dashboard)       │  │  /register      │  │
│   │  Auth Form  │  │  Extractor + Table   │  │  Register Form  │  │
│   └─────────────┘  └──────────────────────┘  └─────────────────┘  │
└────────────────────────────┬────────────────────────────────────────┘
                             │ HTTP (CORS-restricted)
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     Hono.js API Server (Port 3001)                  │
│                                                                     │
│  Global Middleware Stack:                                           │
│  ┌──────────┐  ┌──────────────┐  ┌────────────────┐               │
│  │   CORS   │→ │ Request Log  │→ │  Rate Limiter  │               │
│  └──────────┘  └──────────────┘  └────────────────┘               │
│                                                                     │
│  Route Modules:                                                     │
│  ┌─────────────────┐  ┌──────────────────────┐  ┌──────────────┐  │
│  │ /api/auth/*     │  │ /api/transactions/*  │  │ /api/health  │  │
│  │ Better Auth     │  │ authGuard middleware  │  │ uptime check │  │
│  │ (registration,  │  │ extract / list / get │  └──────────────┘  │
│  │  login,         │  │                      │                     │
│  │  session,       │  │  ┌────────────────┐  │                     │
│  │  organization)  │  │  │ TransactionSvc │  │                     │
│  └─────────────────┘  │  │  └─ Parser     │  │                     │
│                        │  └────────────────┘  │                     │
│                        └──────────────────────┘                     │
└────────────────────────────┬────────────────────────────────────────┘
                             │ Prisma ORM
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    PostgreSQL Database (Port 5432)                  │
│                                                                     │
│   users  sessions  accounts  organizations  members  transactions  │
└─────────────────────────────────────────────────────────────────────┘
```

### Request Flow (Transaction Extraction)

```
User pastes text → POST /api/transactions/extract
    ↓
[authGuard] → validates Bearer token / cookie session
    ↓
[rateLimiter] → 30 req/min per user
    ↓
[Zod validation] → text: min 1, max 5000 chars
    ↓
[TransactionService.extractAndSaveTransaction()]
    ↓
[TransactionParser.parseTransaction()] → tries 3 strategies
    ├── Strategy 1: Labelled  (Date: ..., Description: ..., Amount: ...)
    ├── Strategy 2: Arrow     (12/11/2025 → ₹1,250 debited)
    └── Strategy 3: Inline    (txn123 2025-12-10 Amazon ₹2999 Dr Bal 14171)
    ↓
Best result selected by confidence score (0–1)
    ↓
Confidence < 0.45 → ValidationError thrown
    ↓
prisma.transaction.create() → scoped to userId + organizationId
    ↓
201 Created → { success: true, data: { transaction, parsed } }
```

---

## 4. How It Was Built

### Step 1 — Project Scaffolding

The project is a **modular monolith** — both frontend and backend live in the same repository but are completely separate services:

```
assignment/
├── backend/          ← Hono.js API server
├── frontend/         ← Next.js dashboard
├── docker-compose.yml
└── .env.example
```

### Step 2 — Infrastructure Layer (Backend)

Before writing any feature code, the infrastructure was set up:

**`backend/src/infrastructure/`**
```
config/
  └── env.ts          ← Zod schema validates ALL env vars at startup (fail-fast)
database/
  └── prisma.ts       ← Singleton Prisma client
logger/
  └── index.ts        ← Pino structured logger + per-module child loggers
middleware/
  ├── request-logger.ts  ← Logs every request with duration
  ├── rate-limiter.ts    ← In-memory sliding window rate limiter
  └── error-handler.ts   ← Global error handler maps typed errors → HTTP codes
```

> **Design Decision:** Validating env vars at startup with Zod means the app crashes immediately with a helpful message if `DATABASE_URL` or `BETTER_AUTH_SECRET` is missing — instead of failing silently at runtime.

### Step 3 — Database Schema (Prisma)

The schema was designed around two key concerns:
1. **Better Auth requires specific tables** — `user`, `session`, `account`, `verification`, `organization`, `member`, `invitation`
2. **Our domain model** — `transaction` table with dual-key isolation

```prisma
model transaction {
  // ...fields...
  userId         String    ← who owns this
  organizationId String    ← which tenant owns this

  @@index([organizationId, createdAt(sort: Desc)])  ← fast org-scoped queries
  @@index([userId, createdAt(sort: Desc)])
}
```

### Step 4 — Auth Module

```
backend/src/modules/auth/
├── auth.config.ts      ← Better Auth configuration
├── auth.middleware.ts  ← authGuard + getAuthContext helpers
├── auth.routes.ts      ← Mounts Better Auth handler + /api/me endpoint
└── index.ts
```

**Key design:** When a user registers, a `databaseHook` in `auth.config.ts` automatically creates a personal `organization` and `member` record. All subsequent transactions are scoped to that organization's ID.

### Step 5 — Transaction Module

```
backend/src/modules/transactions/
├── transaction.parser.ts   ← The smart text parser (3 strategies)
├── transaction.service.ts  ← Business logic layer
├── transaction.routes.ts   ← HTTP route handlers
└── index.ts
```

Three layers, each with a single responsibility:
- **Routes** → validate HTTP input, call service, format response
- **Service** → business rules, confidence threshold, database writes
- **Parser** → pure text extraction, no side effects

### Step 6 — Frontend

```
frontend/src/
├── app/
│   ├── page.tsx          ← Dashboard (protected, redirects if no session)
│   ├── login/page.tsx    ← Login form
│   └── register/page.tsx ← Registration form
├── components/
│   ├── transaction-extractor.tsx  ← Paste & extract UI
│   └── transaction-table.tsx      ← Paginated history table
└── lib/
    ├── auth-client.ts    ← Better Auth client config
    └── api.ts            ← Typed API wrapper functions
```

### Step 7 — Docker Compose

Three services wired together:
```yaml
postgres  (port 5432)  ← healthcheck ensures ready before backend starts
backend   (port 3001)  ← depends_on: postgres (healthy)
frontend  (port 3000)  ← depends_on: backend
```

---

## 5. Database Schema

### Entity Relationship

```
users ──────────┬──── sessions
                ├──── accounts
                ├──── members ──── organizations ──── transactions
                └──── transactions
```

### Tables

| Table | Managed By | Purpose |
|---|---|---|
| `users` | Better Auth | User accounts |
| `sessions` | Better Auth | Active login sessions |
| `accounts` | Better Auth | OAuth/credential providers |
| `verifications` | Better Auth | Email verification tokens |
| `organizations` | Better Auth + us | Tenant/workspace per user |
| `members` | Better Auth + us | User ↔ Organization membership |
| `invitations` | Better Auth | Org invite tracking |
| `transactions` | Our code | Extracted financial transactions |

### Transaction Table Fields

| Field | Type | Description |
|---|---|---|
| `id` | `cuid()` | Unique identifier |
| `date` | `DateTime` | Transaction date from the text |
| `description` | `String` | Merchant or transaction description |
| `amount` | `Float` | Transaction amount (always positive) |
| `type` | `String` | `"DEBIT"` or `"CREDIT"` |
| `balance` | `Float?` | Account balance after transaction |
| `category` | `String?` | Auto-inferred category (Food, Transport, etc.) |
| `reference` | `String?` | Bank reference/transaction ID |
| `confidence` | `Float` | Parser confidence score (0.0 – 1.0) |
| `rawText` | `String` | Original text that was submitted |
| `userId` | `String` | FK → users |
| `organizationId` | `String` | FK → organizations |

---

## 6. API Reference

### Authentication Endpoints (managed by Better Auth)

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/auth/sign-up/email` | Register new user |
| `POST` | `/api/auth/sign-in/email` | Login, returns session cookie |
| `POST` | `/api/auth/sign-out` | Invalidate session |
| `GET` | `/api/auth/session` | Get current session |
| `GET` | `/api/me` | Get current user profile |

### Transaction Endpoints (all require auth)

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/transactions/extract` | Parse text and save transaction |
| `GET` | `/api/transactions` | List transactions (cursor pagination) |
| `GET` | `/api/transactions/:id` | Get single transaction |

#### `POST /api/transactions/extract`

**Request:**
```json
{
  "text": "Date: 11 Dec 2025\nDescription: STARBUCKS COFFEE MUMBAI\nAmount: -420.00\nBalance after transaction: 18420.50"
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "transaction": {
      "id": "cm...",
      "date": "2025-12-11T00:00:00.000Z",
      "description": "STARBUCKS COFFEE MUMBAI",
      "amount": 420.00,
      "type": "DEBIT",
      "balance": 18420.50,
      "category": "Food & Dining",
      "reference": null,
      "confidence": 0.70,
      "createdAt": "2026-06-19T..."
    },
    "parsed": {}
  }
}
```

#### `GET /api/transactions?limit=20&cursor=cm...`

**Response (200):**
```json
{
  "success": true,
  "data": {
    "transactions": [],
    "pagination": {
      "hasMore": true,
      "nextCursor": "cm_xyz"
    }
  }
}
```

### Health Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | Basic uptime check |
| `GET` | `/api/health/db` | Database connectivity check |

---

## 7. Smart Parser

The parser (`transaction.parser.ts`) is the **core intelligence** of the app. It handles messy real-world bank statement formats.

### How It Works

```
Raw text input
    ↓
normalizeText()
  • Unify line endings (\r\n → \n)
  • Remove currency symbols (₹, Rs., INR)
  • Remove thousands separators (18,420 → 18420)
    ↓
Run 3 strategies in parallel
    ↓
Collect all results that returned non-null
    ↓
Sort by confidence score (descending)
    ↓
Return best result (or null if all strategies failed)
```

### Strategy 1: Labelled Format
Handles structured bank SMS/emails with labeled fields:
```
Date: 11 Dec 2025
Description: STARBUCKS COFFEE MUMBAI
Amount: -420.00
Balance after transaction: 18,420.50
```

### Strategy 2: Arrow Format
Handles notification-style text with `→` separators:
```
Uber Ride * Airport Drop
12/11/2025 → ₹1,250.00 debited
Available Balance → ₹17,170.50
```

### Strategy 3: Inline/Messy Format
Handles single-line dense formats often seen in exports:
```
txn123 2025-12-10 Amazon.in Order #403-1234567 ₹2,999.00 Dr Bal 14171.50 Shopping
```

### Confidence Scoring

| Field Extracted | Score Added |
|---|---|
| Date | +0.25 |
| Description | +0.20 |
| Amount | +0.25 |
| Balance | +0.15 |
| Reference | +0.10 |
| Category | +0.05 |
| **Max total** | **1.00** |

> Transactions below **45% confidence** are rejected with a descriptive error.

### Category Auto-Inference

Keywords are matched case-insensitively against the description:

| Category | Keywords |
|---|---|
| Food & Dining | starbucks, zomato, swiggy, restaurant, cafe, pizza... |
| Transportation | uber, ola, lyft, taxi, metro, petrol, fuel... |
| Shopping | amazon, flipkart, myntra, mall, store... |
| Entertainment | netflix, spotify, cinema, hotstar, disney... |
| Bills & Utilities | electricity, internet, broadband, recharge... |
| Travel | hotel, flight, irctc, makemytrip... |
| Finance | upi, neft, imps, transfer, emi, loan... |

---

## 8. Security Design

### Authentication
- Passwords are **bcrypt-hashed** by Better Auth — never stored in plaintext
- Sessions stored as **HTTP-only cookies** (XSS-safe)
- Session tokens expire after **7 days**; refreshed every 24 hours
- `BETTER_AUTH_SECRET` must be ≥ 32 characters (validated at startup)

### Multi-Tenant Data Isolation
Every database query for transactions **always filters by both `userId` AND `organizationId`**:

```typescript
prisma.transaction.findMany({
  where: {
    organizationId: auth.organizationId,  // ← tenant fence
    userId: auth.userId,                  // ← user fence
  }
});
```

This means even if an attacker forges a request with a different org ID, the `userId` check catches it — and vice versa.

### Rate Limiting
- **Global API limit:** 100 req/min per IP (unauthenticated), per user (authenticated)
- **Extract endpoint specific:** 30 req/min (stricter, as parsing is compute-heavy)
- In-memory sliding window — no external Redis required for dev

### Input Validation
- All route inputs validated with **Zod schemas** before any logic runs
- Text input capped at **5,000 characters** to prevent abuse
- Query params coerced and range-checked (limit: 1–100)

### CORS
- Only the configured `FRONTEND_URL` is allowed as an origin
- `credentials: true` for cookie-based auth
- Exposed headers: `X-Request-Id`, `X-RateLimit-*`

---

## 9. Running the Project

### Prerequisites
- Docker + Docker Compose installed
- OR: Node.js 20+, PostgreSQL

### Option A: Docker (Recommended)

```bash
# 1. Clone the repository
git clone <repo-url>
cd assignment

# 2. Copy environment file
cp .env.example .env
# Edit .env and set BETTER_AUTH_SECRET (must be 32+ chars)

# 3. Start all services
docker compose up --build

# 4. Run database migrations (first time only)
docker compose exec backend npx prisma migrate deploy
```

Access:
- **Frontend:** http://localhost:3000
- **Backend API:** http://localhost:3001
- **Health check:** http://localhost:3001/api/health

### Option B: Local Development

```bash
# Terminal 1 — Start PostgreSQL
docker compose up postgres

# Terminal 2 — Backend
cd backend
cp .env.example .env    # Fill in DATABASE_URL etc.
npm install
npm run db:migrate      # Run Prisma migrations
npm run dev             # Starts on port 3001

# Terminal 3 — Frontend
cd frontend
cp .env.example .env.local  # Set NEXT_PUBLIC_API_URL=http://localhost:3001
npm install
npm run dev             # Starts on port 3000
```

### Running Tests

```bash
cd backend
npm test              # Run all tests once
npm run test:watch    # Watch mode
```

Test files:
- `tests/parser.test.ts` — Unit tests for all 3 parser strategies + confidence scoring
- `tests/auth.test.ts` — Auth flow integration tests
- `tests/isolation.test.ts` — Multi-tenant data isolation tests

### Environment Variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `BETTER_AUTH_SECRET` | ✅ | 32+ char secret for session signing |
| `BETTER_AUTH_URL` | ✅ | Backend URL (e.g. http://localhost:3001) |
| `FRONTEND_URL` | ✅ | Frontend URL for CORS (e.g. http://localhost:3000) |
| `PORT` | ❌ | Server port (default: 3001) |
| `RATE_LIMIT_MAX` | ❌ | Max requests per window (default: 100) |
| `RATE_LIMIT_WINDOW_MS` | ❌ | Rate limit window in ms (default: 60000) |

---

## 10. Loom Video Script

> 🎬 **Use this as your recording guide. Estimated time: 8–12 minutes.**

---

### Scene 1 — Intro (0:00 – 0:45)

> *"Hey! I'm going to walk you through Vessify Finance — a full-stack personal finance transaction extractor I built as a production-grade assignment.*
>
> *The problem it solves is simple: bank statement texts are messy. They come in different formats, with currency symbols, different date formats, abbreviations — and extracting structured data from them manually is painful.*
>
> *Vessify takes any raw bank statement text, parses it intelligently, and stores it as clean, structured data — tied to your secure account."*

---

### Scene 2 — Architecture Overview (0:45 – 2:00)

Show the architecture diagram from Section 3.

> *"The project is a modular monolith — frontend and backend in the same repo, deployed as separate services.*
>
> *The backend is built on **Hono.js** — which is like Express but much faster and modern. It runs on Node.js. The frontend is **Next.js 16** with React 19.*
>
> *Everything goes through PostgreSQL, and auth is handled by **Better Auth** — which gives us sessions, organizations, and password hashing out of the box.*
>
> *All three services — PostgreSQL, backend, frontend — are containerized with Docker Compose."*

---

### Scene 3 — Folder Structure (2:00 – 3:00)

Open the file tree in VS Code.

> *"The backend follows a layered architecture:*
> - `infrastructure/` — config validation, database, logger, middleware
> - `modules/auth/` — Better Auth setup + auth guard middleware
> - `modules/transactions/` — the routes, service, and parser
> - `shared/` — types, errors, constants
>
> *Each module has a clean boundary — routes don't touch the database, the service doesn't know about HTTP headers."*

---

### Scene 4 — The Smart Parser (3:00 – 5:30)

Open `backend/src/modules/transactions/transaction.parser.ts`

> *"This is the heart of the app — the transaction parser. The challenge is that bank statements come in completely different formats.*
>
> *We solve this with a **multi-strategy approach**:*
> 1. Labelled format — like `Date: 11 Dec 2025, Description: ..., Amount: -420`
> 2. Arrow format — like `12/11/2025 → ₹1,250 debited`
> 3. Inline format — one dense line with everything smashed together*
>
> *All 3 strategies run on every input. Each one returns a confidence score from 0 to 1 based on how many fields it successfully extracted. We pick the winner — the highest confidence result.*
>
> *If confidence is below 45%, we reject the input with a clear error message. And then we run category inference — matching keywords like 'uber', 'netflix', 'amazon' to categories."*

---

### Scene 5 — Security: Auth + Data Isolation (5:30 – 7:00)

Open `backend/src/modules/auth/auth.config.ts`

> *"When a user registers, Better Auth automatically creates a personal **organization** for them — using a database lifecycle hook.*
>
> *Every transaction is then scoped to BOTH the user ID and the organization ID. So even if someone modifies an API request and sends a different org ID — the user ID check catches them."*

Show the `transaction.findMany` with dual `where` filter in `transaction.service.ts`.

> *"CORS is configured to only allow our frontend URL. Sessions are HTTP-only cookies — XSS-proof. The extract endpoint has a stricter rate limit of 30 requests per minute."*

---

### Scene 6 — Live Demo (7:00 – 9:30)

Start the app. Navigate to http://localhost:3000

1. **Register** a new account at `/register`
2. **Login** → gets redirected to dashboard automatically
3. **Paste Format 1** (Labelled):
   ```
   Date: 11 Dec 2025
   Description: STARBUCKS COFFEE MUMBAI
   Amount: -420.00
   Balance after transaction: 18420.50
   ```
   → Show extracted card: category "Food & Dining", confidence 70%, DEBIT ₹420

4. **Paste Format 2** (Arrow):
   ```
   Uber Ride * Airport Drop
   12/11/2025 → 1250.00 debited
   Available Balance → 17170.50
   ```
   → Show extracted: Transportation, DEBIT ₹1250

5. **Paste Format 3** (Inline):
   ```
   txn123 2025-12-10 Amazon.in Order #403-1234567 2999.00 Dr Bal 14171.50 Shopping
   ```
   → Show extracted with reference ID

6. Show the **Transaction History** table populated with all 3
7. Visit http://localhost:3001/api/health/db to show health check

---

### Scene 7 — Tests (9:30 – 10:30)

```bash
cd backend && npm test
```

> *"The test suite has three files:*
> - **parser.test.ts** — unit tests for each of the 3 strategies with real bank statement examples
> - **auth.test.ts** — integration tests for registration and login flows
> - **isolation.test.ts** — verifies that User A cannot see User B's transactions, even when trying directly"*

---

### Scene 8 — Wrap-up (10:30 – 11:00)

> *"To summarize what we built:*
> - A **Hono.js** API with modular architecture, typed throughout with TypeScript
> - **Better Auth** for session management and multi-tenancy
> - **Prisma + PostgreSQL** with dual-key data isolation
> - A **3-strategy smart parser** with confidence scoring
> - A **Next.js 16** dashboard with real-time extraction and paginated history
> - Fully **Dockerized** for one-command deployment*
>
> *The code is clean, well-commented, and tested. Thanks for watching!"*

---

*Document generated: 2026-06-19 | Project: Vessify Finance Transaction Extractor*
