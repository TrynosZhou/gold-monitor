# Gold Monitor

Tracks gold from stone delivery through milling, receipt by the manager,
sale, and owner confirmation. Every stage is reconciled against the one before it.

Roles: FETCHER (stone deliveries), MILLER (crushing runs), MANAGER (gold receipts and payouts), OWNER (read-only dashboard and payout confirmation).

Stack: Angular 18 (standalone), Node.js + Express 5, TypeORM, PostgreSQL, JWT.

## Quick start

### 1. Database
    docker compose up -d

(or create a Postgres database called `gold_monitor` with user `gold` / password `gold`)

### 2. Backend
    cd backend
    cp .env.example .env        # then set JWT_SECRET
    npm install
    npm run seed                # creates the four users
    npm run dev                 # API on http://localhost:3000

### 3. Frontend
    cd frontend
    npm install
    npm start                   # app on http://localhost:4200

Log in with `fetcher`, `miller`, `manager`, or `owner` and the password `ChangeMe123!`.
Change these passwords before real use.

## Reconciliation rule
produced >= received >= sold >= confirmed by owner. The period is balanced when all four match within 1 mg.

## Before production
- Replace `synchronize` with TypeORM migrations.
- Serve over HTTPS and use a long random JWT_SECRET.
- Add rate limiting on /api/auth/login.
- Schedule pg_dump backups.
