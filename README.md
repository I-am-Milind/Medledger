<<<<<<< HEAD
# MedLedger

Role-secure cross-hospital medical platform monorepo:

- `apps/web`: React + Vite frontend
- `apps/api`: Node.js + Express backend
- Firebase Auth + Firestore

## Implemented

### Authentication and Authorization

- Roles: `patient`, `doctor`, `admin`
- Every API route uses:
  - identity verification (`auth.middleware.ts`)
  - role verification (`role.middleware.ts`)
- Deny-by-default route policy
- User bootstrap endpoint with Firestore `users` role mapping
- Request signer middleware (`x-request-signature` response header)

### Frontend Security Behavior

- Role-first access flow (`patient` or `doctor`) with dedicated auth pages
- Login / registration (email + password)
- Session restore after refresh (`onAuthStateChanged + /auth/session`)
- Protected routes + role-based redirects
- Auto logout on token failure (401 interceptor behavior in API client)
- No role UI leakage: role-gated routes and role-specific navigation

### Patient Domain (Data Owner)

- Patient profile:
  - demographics
  - contact
  - blood group
  - allergies
  - profile image (base64)
  - hereditary family structure array
- Global unique patient identifier generation (`MLP-YYYY-XXXXXXXX`)
- QR code generation from identifier
- QR preview, download, and print
- Patient-controlled doctor access request approval/denial

### Doctor Domain

- Doctor profile:
  - specialization
  - qualification
  - license
  - verification docs (base64)
  - approval status
- Admin approval mandatory for doctor access workflows
- Doctor dashboard:
  - patient search by UID/email/phone/identifier
  - access request workflow (waiting/approved/denied)
  - quick summary lookup
  - create visit
  - add prescription
  - upload reports (base64)
  - set treatment status
- Hospital isolation guard:
  - doctor cannot update visits outside their hospital

### Admin Domain

- Doctor application queue
- Approve/deny doctor applications

### UI Theme (Applied)

- Primary `#1E88E5`
- Secondary `#26A69A`
- Background `#F5F9FF`
- Text `#0D1B2A`

Mobile-first and responsive layout implemented.

## Firestore Collections

- `users`
- `patients`
- `doctor_profiles`
- `access_requests`
- `visits`

## Setup

0. Use Node.js `20.19+` (or `22.12+`).

1. Install dependencies:

```bash
npm install
```

2. Configure env files:

- `apps/web/.env`
- `apps/api/.env`

3. Firebase Console setup:

- Authentication -> Sign-in method:
  - enable Email/Password
- Authentication -> Settings -> Authorized domains:
  - add `localhost`
  - add `127.0.0.1`

If signup/login returns HTTP `400` from `identitytoolkit.googleapis.com`, verify the above first.
Typical root causes are disabled providers or missing authorized domain.

Verification flow implemented:
- Email verification required after registration before dashboard access

4. For admin access, set `ADMIN_EMAILS` in `apps/api/.env`:

```env
ADMIN_EMAILS=admin1@example.com,admin2@example.com
```

## Run

```bash
npm run dev
```

- Web: `http://localhost:5173`
- API: `http://localhost:8080`

## Validation Status

- `npm run typecheck` passes
- `npm run lint` passes
- `npm run build` passes

## Notes

- API requires Firebase credentials via Application Default Credentials or service account env values.
- For local development, set `FIREBASE_CLIENT_EMAIL` and `FIREBASE_PRIVATE_KEY` in `apps/api/.env` to avoid backend `500` on `/auth/session` or `/auth/bootstrap`.
- Current Node in this environment is `20.17.0`; Vite `7.3.1` warns and recommends `20.19+` (or `22.12+`).
=======
# Medledger
>>>>>>> 72f37638730d762aabe2775249899a0fddcb6881
