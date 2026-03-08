# Courtly — Pickleball Venue Booking Platform

A backend API for a two-sided marketplace where **players** book pickleball courts and **venue owners** list their facilities and manage payments.

---

## Table of Contents

- [Overview](#overview)
- [User Roles](#user-roles)
- [Core Features](#core-features)
- [Tech Stack](#tech-stack)
- [Data Models](#data-models)
- [API Modules](#api-modules)
- [Booking Flow](#booking-flow)
- [Payment Architecture](#payment-architecture)
- [Project Structure](#project-structure)
- [Roadmap](#roadmap)
- [Environment Variables](#environment-variables)

---

## Overview

Courtly connects pickleball players with venues. Players discover courts, check real-time availability, and book time slots. Venue owners manage their courts, set pricing, configure accepted payment methods, and track earnings — all through one platform.

---

## User Roles

| Role | Description |
|---|---|
| `PLAYER` | Browses venues, books courts, pays, leaves reviews |
| `VENUE_OWNER` | Lists venues, adds courts, sets pricing & payment methods, manages bookings |
| `ADMIN` | Platform administration, dispute resolution, payouts |

---

## Core Features

### Players
- Sign up / log in (email + OAuth)
- Browse and search venues by location, amenities, price
- View court availability in real time
- Book time slots (single session or recurring)
- Pay online (credit card via Stripe) or select venue-supported methods (cash, Venmo, Zelle, etc.)
- View booking history and upcoming sessions
- Cancel bookings (subject to venue's cancellation policy)
- Leave ratings and reviews for venues

### Venue Owners
- Register and verify venue (name, address, photos, amenities)
- Add courts with details (surface type, indoor/outdoor, max players, hourly rate)
- Set weekly availability schedules per court
- Block out dates (maintenance, private events)
- Configure accepted payment methods per venue
- Set cancellation and refund policies
- View and manage all incoming bookings
- View earnings dashboard

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | NestJS (TypeScript) |
| Auth | Supabase Auth (email, OAuth, magic link) |
| Database | Supabase (managed PostgreSQL) |
| DB Client | `@supabase/supabase-js` (service role) |
| JWT Validation | `passport-jwt` verifying Supabase-signed JWTs |
| Payments | Stripe Connect (split payments) |
| File Storage | Supabase Storage (venue/court images) |
| Caching | Redis (slot locking) |
| Email | Supabase Auth emails + SendGrid for app emails |
| Validation | `class-validator` + `class-transformer` |
| API Docs | Swagger (`@nestjs/swagger`) |

## Supabase + NestJS Architecture

Supabase handles all **identity** concerns. NestJS handles all **business logic**.

```
Client (mobile/web)
  │
  ├── POST supabase.auth.signUp()      ← directly to Supabase Auth
  ├── POST supabase.auth.signInWithPassword()
  │         └── returns { access_token (JWT), refresh_token }
  │
  └── All API calls → NestJS with Bearer <supabase_jwt>
        │
        └── NestJS JwtStrategy validates JWT using SUPABASE_JWT_SECRET
              └── Extracts sub (user ID) → looks up profiles table for role
                    └── Attaches { id, email, role } to request
```

**Key points:**
- NestJS **never** issues its own JWTs — Supabase does
- NestJS validates Supabase JWTs using `passport-jwt` + `SUPABASE_JWT_SECRET`
- NestJS uses the **service role key** (`@supabase/supabase-js`) for all DB writes, bypassing RLS
- User roles (`PLAYER` | `VENUE_OWNER` | `ADMIN`) live in a custom `profiles` table, not in Supabase Auth metadata
- Supabase Storage replaces AWS S3 for image uploads

---

## Data Models

### auth.users (managed by Supabase — do not create manually)
```
id          UUID    PK  ← this is the user's identity across the whole app
email       string
created_at  timestamp
```

### profiles (custom table — mirrors auth.users, extends with app data)
```
id                UUID        PK  FK → auth.users.id  (same UUID)
role              enum        PLAYER | VENUE_OWNER | ADMIN
firstName         string
lastName          string
phone             string?
avatarUrl         string?
stripeCustomerId  string?     (players — for Stripe charging)
createdAt         timestamp
```
> Created automatically via a Supabase **database trigger** on `auth.users` insert.

### Venue
```
id                   UUID      PK
ownerId              UUID      FK → User
name                 string
description          string
address              string
city                 string
state                string
lat                  float
lng                  float
amenities            string[]  (parking, restrooms, pro-shop, lights, etc.)
imageUrls            string[]
status               enum      PENDING | ACTIVE | SUSPENDED
cancellationPolicy   string
stripeAccountId      string?   (Stripe Connect — for payouts)
createdAt            timestamp
```

### Court
```
id           UUID      PK
venueId      UUID      FK → Venue
name         string    (e.g. "Court 1")
surface      enum      CONCRETE | ASPHALT | WOOD | SPORT_TILE
isIndoor     boolean
maxPlayers   int       (typically 4)
hourlyRate   decimal
currency     string    (default: USD)
imageUrls    string[]
isActive     boolean
```

### Schedule (weekly recurring availability per court)
```
id             UUID   PK
courtId        UUID   FK → Court
dayOfWeek      enum   MON | TUE | WED | THU | FRI | SAT | SUN
openTime       time   (e.g. 07:00)
closeTime      time   (e.g. 22:00)
slotDuration   int    (minutes — e.g. 60 or 90)
```

### Booking
```
id              UUID       PK
playerId        UUID       FK → User
courtId         UUID       FK → Court
startTime       timestamp
endTime         timestamp
totalPrice      decimal
status          enum       PENDING | CONFIRMED | CANCELLED | COMPLETED | NO_SHOW
paymentStatus   enum       UNPAID | PAID | REFUNDED | PARTIAL_REFUND
paymentMethod   string     (stripe | cash | venmo | zelle | etc.)
notes           string?
createdAt       timestamp
```

### Payment
```
id                      UUID      PK
bookingId               UUID      FK → Booking
amount                  decimal
currency                string
method                  string
stripePaymentIntentId   string?
stripeTransferAmount    decimal?  (amount routed to venue after platform fee)
status                  enum      PENDING | SUCCEEDED | FAILED | REFUNDED
platformFeePercent      decimal   (e.g. 0.05 for 5%)
createdAt               timestamp
```

### VenuePaymentMethod
```
id        UUID     PK
venueId   UUID     FK → Venue
method    string   (cash | venmo | zelle | stripe | etc.)
details   string?  (e.g. Venmo handle, Zelle phone number)
isActive  boolean
```

### Review
```
id          UUID      PK
playerId    UUID      FK → User
venueId     UUID      FK → Venue
bookingId   UUID      FK → Booking  (one review per completed booking)
rating      int       (1–5)
comment     string?
createdAt   timestamp
```

### BlockedDate
```
id        UUID   PK
courtId   UUID   FK → Court
date      date
reason    string?
```

---

## API Modules

```
src/
├── auth/        # JWT strategy, guards, role decorators (NO register/login — Supabase handles those)
├── users/       # Profile CRUD (read/update profiles table)
├── venues/      # Venue CRUD, search, image upload to Supabase Storage
├── courts/      # Court CRUD per venue
├── schedules/   # Availability schedule management
├── bookings/    # Create, view, cancel bookings; availability queries
├── payments/    # Stripe webhooks, PaymentIntent creation, refunds
├── reviews/     # Submit and view reviews per venue
└── admin/       # Platform-level management
```

### Key Endpoints

#### Auth (handled by Supabase — NOT NestJS)
> Register, login, OAuth, token refresh, password reset, email verification — all go directly to Supabase Auth from the client. NestJS has no `/auth/register` or `/auth/login`.

#### Users (NestJS — manages `profiles` table)
| Method | Path | Role | Description |
|---|---|---|---|
| GET | `/users/me` | Any | Get current user profile |
| PATCH | `/users/me` | Any | Update profile (name, phone, avatar) |
| PATCH | `/users/me/role` | Any | Set role on first login (PLAYER or VENUE_OWNER) |

#### Venues
| Method | Path | Role | Description |
|---|---|---|---|
| GET | `/venues` | Public | Search venues (city, lat/lng, radius, date) |
| GET | `/venues/:id` | Public | Venue details with courts and avg rating |
| POST | `/venues` | VENUE_OWNER | Create venue |
| PATCH | `/venues/:id` | VENUE_OWNER | Update venue |
| GET | `/venues/:id/availability` | Public | Available slots for a date range |

#### Courts
| Method | Path | Role | Description |
|---|---|---|---|
| GET | `/venues/:venueId/courts` | Public | List courts for a venue |
| POST | `/venues/:venueId/courts` | VENUE_OWNER | Add court |
| PATCH | `/courts/:id` | VENUE_OWNER | Update court |

#### Bookings
| Method | Path | Role | Description |
|---|---|---|---|
| POST | `/bookings` | PLAYER | Create booking |
| GET | `/bookings/my` | PLAYER | Player's booking history |
| GET | `/venues/:venueId/bookings` | VENUE_OWNER | Venue's incoming bookings |
| PATCH | `/bookings/:id/cancel` | PLAYER / VENUE_OWNER | Cancel booking |
| PATCH | `/bookings/:id/confirm` | VENUE_OWNER | Confirm manual payment booking |

#### Payments
| Method | Path | Role | Description |
|---|---|---|---|
| POST | `/payments/intent` | PLAYER | Create Stripe PaymentIntent |
| POST | `/payments/webhook` | — | Stripe webhook handler |
| POST | `/payments/refund/:bookingId` | VENUE_OWNER | Issue refund |

#### Reviews
| Method | Path | Role | Description |
|---|---|---|---|
| POST | `/reviews` | PLAYER | Submit review (post-session only) |
| GET | `/venues/:id/reviews` | Public | List reviews for a venue |

---

## Booking Flow

```
Player                        API                        Venue Owner
  |                            |                               |
  |-- GET /venues ------------>|                               |
  |<-- venue list -------------|                               |
  |                            |                               |
  |-- GET /venues/:id/availability (date) --->|               |
  |<-- available time slots ----|                              |
  |                            |                               |
  |-- POST /bookings ---------->|                              |
  |   { courtId, startTime,     |                              |
  |     endTime, paymentMethod }|                              |
  |                            |-- lock slot (Redis TTL) ----->|
  |                            |                               |
  [Stripe payment path]         |                              |
  |-- POST /payments/intent --->|                              |
  |<-- clientSecret ------------|                              |
  |-- confirm payment (Stripe SDK on client)                   |
  |                            |<-- Stripe webhook: payment_intent.succeeded
  |                            |-- booking.status → CONFIRMED  |
  |                            |-- notify venue owner -------->|
  |<-- booking confirmation ----|                              |
  |                            |                               |
  [Manual payment path]         |                              |
  |<-- booking.status: PENDING (awaiting venue confirmation)   |
  |                            |<-- PATCH /bookings/:id/confirm (VENUE_OWNER)
  |<-- booking.status: CONFIRMED                               |
```

---

## Payment Architecture

Courtly uses **Stripe Connect** to handle split payments:

1. **Venue owners** onboard via Stripe Connect (Express accounts) to receive direct payouts.
2. **Players** pay the platform; Stripe routes funds minus the platform fee to the venue.
3. **Platform fee**: configurable per-booking percentage (e.g., 5–10%).
4. **Non-Stripe methods** (cash, Venmo, Zelle): booking is created in `PENDING` state; venue owner manually confirms via the app after collecting payment.

### Stripe Objects per Booking
- `PaymentIntent` — created when player initiates checkout; holds the slot
- `Transfer` — after successful payment, transfer `(amount - platformFee)` to venue's Connect account
- `Refund` — issued on cancellation per venue's cancellation policy

---

## Project Structure

```
courtly-backend/
├── src/
│   ├── app.module.ts
│   ├── main.ts
│   ├── supabase/
│   │   ├── supabase.module.ts      # global module, provides SupabaseClient
│   │   └── supabase.service.ts     # wraps createClient with service role key
│   ├── auth/
│   │   ├── auth.module.ts
│   │   ├── strategies/
│   │   │   └── supabase-jwt.strategy.ts   # validates Supabase JWT, loads profile
│   │   ├── guards/
│   │   │   ├── jwt-auth.guard.ts
│   │   │   └── roles.guard.ts
│   │   └── decorators/
│   │       ├── roles.decorator.ts
│   │       └── current-user.decorator.ts
│   ├── users/
│   ├── venues/
│   ├── courts/
│   ├── schedules/
│   ├── bookings/
│   ├── payments/
│   ├── reviews/
│   ├── admin/
│   └── common/
│       ├── dto/
│       ├── filters/        # global exception filters
│       ├── interceptors/
│       └── pipes/
├── supabase/
│   └── migrations/         # SQL migration files (managed via Supabase CLI)
├── test/
├── .env.example
├── package.json
├── tsconfig.json
└── README.md
```

---

## Roadmap

### Phase 1 — Core MVP
- [ ] Supabase project setup (Auth, DB, Storage buckets)
- [ ] `profiles` table + trigger to auto-create on Supabase signup
- [ ] NestJS Supabase module (service role client, global)
- [ ] JWT strategy validating Supabase tokens + roles guard
- [ ] User profile CRUD (`/users/me`)
- [ ] Venue CRUD + image upload to Supabase Storage
- [ ] Court CRUD
- [ ] Weekly schedule configuration
- [ ] Availability query (return open slots for a given date)
- [ ] Booking creation + cancellation
- [ ] Stripe PaymentIntent + webhook handler
- [ ] Manual payment method support (cash / Venmo / Zelle)
- [ ] Venue owner booking confirmation flow

### Phase 2 — Growth Features
- [ ] Reviews and ratings
- [ ] Venue search with geo-filtering (PostGIS or Haversine)
- [ ] Recurring bookings (weekly reservations)
- [ ] Blocked dates / court maintenance windows
- [ ] Email notifications (booking confirmation, reminders, cancellations)
- [ ] Venue earnings dashboard

### Phase 3 — Scale & Polish
- [ ] Admin panel (venue verification, dispute resolution)
- [ ] Waitlist for fully-booked courts
- [ ] Dynamic pricing (peak / off-peak hours)
- [ ] Promo codes and discounts
- [ ] Mobile push notifications
- [ ] Analytics for venue owners (occupancy rate, revenue trends)

---

## Environment Variables

```env
# App
PORT=3000
NODE_ENV=development

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=eyJ...          # public, safe to expose on client
SUPABASE_SERVICE_ROLE_KEY=eyJ...  # private, only used server-side in NestJS
SUPABASE_JWT_SECRET=your-supabase-jwt-secret  # from Supabase dashboard → Settings → API

# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
PLATFORM_FEE_PERCENT=0.05

# Redis
REDIS_URL=redis://localhost:6379

# Email (for transactional emails beyond Supabase Auth)
SENDGRID_API_KEY=...
FROM_EMAIL=noreply@courtly.app
```

> Find `SUPABASE_JWT_SECRET` in your Supabase dashboard under **Settings → API → JWT Settings**.

---

## Local Development

```bash
# Install dependencies
npm install

# Start in watch mode
npm run start:dev

# Run tests
npm run test

# Run e2e tests
npm run test:e2e
```
