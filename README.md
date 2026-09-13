# Galla — Salon & Parlour Management SaaS

A multi-tenant, subscription-based SaaS platform designed to streamline salon and beauty parlour shop operations: inventory intake, stock tracking, order and service lifecycles (advance bookings, conversions, refunds), service/package management, and role-gated analytics.

> **Status:** Project Structure & Scaffold Complete. Ready for feature implementation.

---

## 🛠 Tech Stack

- **Framework:** [Next.js](https://nextjs.org/) (App Router, TypeScript)
- **Database & ORM:** MongoDB Atlas with [Mongoose](https://mongoosejs.com/) (connection-cached pattern for serverless/Vercel)
- **Authentication:** [NextAuth.js / Auth.js](https://authjs.dev/) (Credentials provider with bcrypt password hashing, JWT session strategy)
- **Realtime:** [Pusher Channels](https://pusher.com/channels) (`pusher` server + `pusher-js` client for tenant-scoped realtime events)
- **Validation:** [Zod](https://zod.dev/) for strict schema validation at API boundaries
- **Styling & Components:** [Tailwind CSS v4](https://tailwindcss.com/) + [shadcn/ui](https://ui.shadcn.com/)
- **Deployment Target:** [Vercel](https://vercel.com/)

---

## 📂 Project Structure

Organized for a scalable multi-tenant SaaS architecture:

```text
├── src/
│   ├── app/
│   │   ├── (auth)/                 # Authentication route group
│   │   │   ├── login/page.tsx      # Sign-in page
│   │   │   ├── register/page.tsx   # Workspace + Owner registration
│   │   │   └── layout.tsx          # Centered auth container layout
│   │   ├── (dashboard)/            # Authenticated tenant app route group
│   │   │   ├── dashboard/page.tsx  # Post-login salon dashboard placeholder
│   │   │   └── layout.tsx          # Dashboard layout (nav sidebar + tenant header)
│   │   ├── api/
│   │   │   ├── auth/
│   │   │   │   ├── [...nextauth]/  # NextAuth catch-all API route
│   │   │   │   └── register/       # Tenant + Owner registration API
│   │   │   ├── realtime/
│   │   │   │   └── auth/           # Pusher private channel auth endpoint
│   │   │   └── tenants/            # Tenant management API placeholder
│   │   ├── layout.tsx              # Root HTML layout with SessionProvider
│   │   ├── page.tsx                # Marketing / landing page
│   │   └── globals.css             # Tailwind + shadcn CSS tokens
│   ├── components/
│   │   ├── auth/                   # Login & registration forms
│   │   ├── dashboard/              # Header, sidebar, and workspace widgets
│   │   ├── shared/                 # Providers (SessionProvider, etc.)
│   │   └── ui/                     # shadcn/ui components (Button, Card, Input, etc.)
│   ├── lib/
│   │   ├── auth/
│   │   │   └── auth.ts             # NextAuth configuration & Credentials provider
│   │   ├── db/
│   │   │   ├── mongodb.ts          # Serverless Mongoose connection pooling & caching
│   │   │   └── models/             # Mongoose schemas
│   │   │       ├── tenant.model.ts # Multi-tenant isolation model
│   │   │       ├── user.model.ts   # User model referencing Tenant
│   │   │       └── index.ts
│   │   ├── realtime/               # Pusher realtime engine
│   │   │   ├── pusher-server.ts    # Server SDK + triggerTenantEvent helper
│   │   │   ├── pusher-client.ts    # Client SDK + useTenantSubscription hook
│   │   │   └── index.ts
│   │   ├── validations/            # Zod input validation schemas
│   │   │   └── auth.ts
│   │   └── utils.ts                # Styling utilities (cn helper)
│   ├── types/
│   │   └── next-auth.d.ts          # Augmented session & JWT types (tenantId, role)
│   ├── auth.ts                     # NextAuth root export helper
│   └── middleware.ts               # Edge session protection & route redirection
├── .aria/                          # ARIA developer memory & system invariants
├── .env.example                    # Environment variable template
├── components.json                 # shadcn/ui configuration
├── next.config.ts                  # Next.js configuration
├── package.json
├── tsconfig.json
└── README.md
```

## ⚡ Quickstart for Teammates

For any team member cloning this repo on their PC (Windows, macOS, or Linux):

```bash
# 1. Clone the repository
git clone https://github.com/Fourier-Tech/Galla.git
cd Galla

# 2. Install dependencies
npm install

# 3. Run the automated workspace setup
# (Auto-creates .env.local from .env.example and generates a cryptographically secure AUTH_SECRET)
npm run setup

# 4. Open .env.local and add your MONGODB_URI and Pusher keys

# 5. Start the development server
npm run dev
```

---

## 🚀 Manual Getting Started Steps

### 1. Prerequisites
- **Node.js**: v18.18+ (Node v20 or v22 recommended)
- **MongoDB Atlas**: A MongoDB connection string
- **Pusher**: A Pusher Channels app (App ID, Key, Secret, Cluster)

### 2. Install Dependencies
```bash
npm install
```

### 3. Configure Environment Variables
Copy `.env.example` to `.env.local`:
```bash
cp .env.example .env.local
```

Update `.env.local` with your MongoDB URI, Auth secret, and Pusher keys:
```env
MONGODB_URI="mongodb+srv://<username>:<password>@<cluster>.mongodb.net/galla?retryWrites=true&w=majority"
AUTH_SECRET="your-generated-32-character-secret"
NEXTAUTH_SECRET="your-generated-32-character-secret"
NEXTAUTH_URL="http://localhost:3000"

# Pusher Channels
PUSHER_APP_ID="your_pusher_app_id"
PUSHER_SECRET="your_pusher_secret"
NEXT_PUBLIC_PUSHER_KEY="your_pusher_key"
NEXT_PUBLIC_PUSHER_CLUSTER="ap2"
```

To generate a secure secret:
```bash
npx auth secret
# or
openssl rand -base64 32
```

### 4. Run the Development Server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser:
- **Landing Page**: `/`
- **Create Salon Workspace**: `/register`
- **Sign In**: `/login`
- **Dashboard**: `/dashboard` (protected)

---

## 🔒 Multi-Tenant Architecture Pattern

1. **Workspace Creation:** When a shop owner registers at `/register`, a dedicated `Tenant` record is generated with a unique slug alongside the owner's `User` record containing the referenced `tenantId`.
2. **Session Context:** Upon login via `NextAuth`, the JWT and session payload include `tenantId`, `role`, and user identifiers.
3. **Database Caching:** `src/lib/db/mongodb.ts` implements global connection caching to prevent connection starvation or re-connection overhead in serverless environments like Vercel.
4. **Realtime Isolation:** Realtime updates use tenant-prefixed channels (`tenant-${tenantId}` or `private-tenant-${tenantId}`) so shops never see each other's live events.
5. **Data Isolation:** All subsequent domain entities (orders, inventory, packages) enforce immutable `tenantId` indexing and filtering.
