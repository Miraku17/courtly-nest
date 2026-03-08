# Courtly — Implementation Checklist

## Supabase Setup
> Complete these before writing any NestJS code.

- [ ] **1. Create Supabase project**
  - Go to supabase.com → new project named `courtly`
  - Save to `.env`: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET`
  - JWT secret is under Settings → API → JWT Settings

- [ ] **2. Create database enums**
  - `user_role`: PLAYER, VENUE_OWNER, ADMIN
  - `court_surface`: CONCRETE, ASPHALT, WOOD, SPORT_TILE
  - `venue_status`: PENDING, ACTIVE, SUSPENDED
  - `booking_status`: PENDING, CONFIRMED, CANCELLED, COMPLETED, NO_SHOW
  - `payment_status`: UNPAID, PAID, REFUNDED, PARTIAL_REFUND
  - `day_of_week`: MON, TUE, WED, THU, FRI, SAT, SUN

- [ ] **3. Create `profiles` table + auto-create trigger**
  - Columns: `id` (FK → auth.users), `role`, `first_name`, `last_name`, `phone`, `avatar_url`, `stripe_customer_id`, `created_at`
  - Trigger: on `auth.users` INSERT → auto-insert row into `profiles` (role starts as NULL)

- [ ] **4. Create `venues` table**
  - Columns: `id`, `owner_id` (FK → profiles), `name`, `description`, `address`, `city`, `state`, `lat`, `lng`, `amenities` (text[]), `image_urls` (text[]), `status` (default PENDING), `cancellation_policy`, `stripe_account_id`, `created_at`

- [ ] **5. Create `courts` table**
  - Columns: `id`, `venue_id` (FK → venues), `name`, `surface`, `is_indoor`, `max_players` (default 4), `hourly_rate`, `currency` (default USD), `image_urls` (text[]), `is_active` (default true)

- [ ] **6. Create `schedules` table**
  - Columns: `id`, `court_id` (FK → courts), `day_of_week`, `open_time`, `close_time`, `slot_duration` (int, minutes)

- [ ] **7. Create `bookings` table**
  - Columns: `id`, `player_id` (FK → profiles), `court_id` (FK → courts), `start_time`, `end_time`, `total_price`, `status` (default PENDING), `payment_status` (default UNPAID), `payment_method`, `notes`, `created_at`

- [ ] **8. Create remaining tables**
  - `payments`: `id`, `booking_id`, `amount`, `currency`, `method`, `stripe_payment_intent_id`, `stripe_transfer_amount`, `status`, `platform_fee_percent`, `created_at`
  - `venue_payment_methods`: `id`, `venue_id`, `method`, `details`, `is_active`
  - `reviews`: `id`, `player_id`, `venue_id`, `booking_id` (unique), `rating` (1–5), `comment`, `created_at`
  - `blocked_dates`: `id`, `court_id`, `date`, `reason`

- [ ] **9. Set up Supabase Storage buckets**
  - Create `venue-images` bucket (public)
  - Create `court-images` bucket (public)
  - Policy: authenticated users can upload to `{user_id}/` prefix; anyone can read

- [ ] **10. Configure RLS policies**
  - `profiles`: user can read/update their own row
  - `venues`: owner can CRUD; public can read ACTIVE venues
  - `courts`: owner can CRUD; public can read active courts
  - `bookings`: player sees own; venue owner sees bookings for their courts
  - `payments`: player and venue owner see their own
  - `reviews`: public read; player can insert for COMPLETED bookings only

---

## NestJS Setup

- [ ] **11. Install dependencies**
  ```bash
  npm install @supabase/supabase-js @nestjs/passport passport passport-jwt @nestjs/jwt @nestjs/config class-validator class-transformer @nestjs/swagger swagger-ui-express stripe
  npm install -D @types/passport-jwt
  ```

- [ ] **12. Build Supabase module**
  - `src/supabase/supabase.module.ts` — global NestJS module
  - `src/supabase/supabase.service.ts` — initializes client with service role key
  - Injected into all other modules that need DB access

- [ ] **13. Build auth guards**
  - `src/auth/strategies/supabase-jwt.strategy.ts` — validates Supabase JWT using `SUPABASE_JWT_SECRET`, loads profile for role
  - `src/auth/guards/jwt-auth.guard.ts`
  - `src/auth/guards/roles.guard.ts`
  - `src/auth/decorators/roles.decorator.ts`
  - `src/auth/decorators/current-user.decorator.ts`

- [ ] **14. Build users module**
  - `GET /users/me` — return current user's profile
  - `PATCH /users/me` — update name, phone, avatar
  - `PATCH /users/me/role` — set PLAYER or VENUE_OWNER (onboarding, only if role is null)

- [ ] **15. Build venues module**
  - `GET /venues` — search by city / lat+lng+radius
  - `GET /venues/:id` — venue detail with courts and avg rating
  - `POST /venues` — create venue (VENUE_OWNER)
  - `PATCH /venues/:id` — update venue (owner only)
  - `GET /venues/:id/availability` — available slots for a date
  - Image upload to Supabase Storage

- [ ] **16. Build courts + schedules modules**
  - `GET /venues/:venueId/courts`
  - `POST /venues/:venueId/courts` (VENUE_OWNER)
  - `PATCH /courts/:id` (owner only)
  - `POST /courts/:courtId/schedules` — set weekly availability
  - `GET /courts/:courtId/schedules`
  - `DELETE /schedules/:id`

- [ ] **17. Build bookings module**
  - `POST /bookings` — create booking (PLAYER), compute price, lock slot
  - `GET /bookings/my` — player's booking history
  - `GET /venues/:venueId/bookings` — venue owner's incoming bookings
  - `PATCH /bookings/:id/cancel`
  - `PATCH /bookings/:id/confirm` — venue owner confirms manual payment
  - Availability logic: schedules minus existing bookings and blocked_dates

- [ ] **18. Build payments module**
  - `POST /payments/intent` — create Stripe PaymentIntent (PLAYER)
  - `POST /payments/webhook` — Stripe webhook handler (set booking CONFIRMED + Transfer to venue)
  - `POST /payments/refund/:bookingId` — issue refund (VENUE_OWNER)
  - Stripe Connect onboarding flow for venue owners

- [ ] **19. Build reviews module**
  - `POST /reviews` — submit review (PLAYER, only for COMPLETED bookings, one per booking)
  - `GET /venues/:id/reviews` — list reviews with avg rating
