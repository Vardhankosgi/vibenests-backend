# VibeNests Express Backend (TypeScript)

This is a minimal Express + TypeScript backend scaffold tailored to the PRD for VibeNests.

Quick start:

1. Copy `.env.example` to `.env` and update `DATABASE_URL` and `JWT_SECRET`.

2. Install dependencies:

```bash
cd backend-express
npm install
```

3. Run in development:

```bash
npm run dev
```

Notes:
- Uses TypeORM with `synchronize: true` for quick dev setup. For production, use migrations instead.
- Auth uses JWT; refresh tokens and payment gateway integrations are left as stubs to implement next.
