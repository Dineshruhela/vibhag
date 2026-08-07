# Splitmaro 2.0 — Implementation Plan

A comprehensive plan to evolve Splitmaro into a premium expense-splitting app with real money movement and a beautiful, distinctive design.

---

## Current State Snapshot

**Strengths**: Solid foundation with Expo SDK 54, expo-router, Supabase auth, Prisma/Postgres backend, theme system, RevenueCat (iOS) + Razorpay (Android) hooks already wired.

**Critical Gaps**:
1. ❌ **No actual money transfer** — settlements only record debts, no real UPI/Stripe execution
2. ❌ **"Offline-first" is a lie** — `lib/sync.ts` is no-op, `lib/database.ts` is online-only
3. ❌ **No expense editing**, only delete
4. ❌ **Only equal splits** despite schema supporting exact/percentage/shares
5. ❌ **No expense comments UI** (model exists)
6. ❌ **Receipt upload but no preview/gallery**
7. ⚠️ Static charts, jarring list updates, no skeletal polish

---

## Phase 1 — Design System Overhaul (Foundation)

**Goal**: Establish a premium, distinctive visual identity before touching screens.

### 1.1 New Brand Identity
- **Replace logo** across `assets/images/` (icon, splash, adaptive, favicon) — generate via Figma/Midjourney with consistent geometric mark
- **New Color System** in `constants/Colors.ts`:
  - Primary: gradient-ready palette (e.g., `#00D4AA` → `#0099CC` for actions)
  - Add **tertiary accents** (warm coral `#FF8A65` for CTAs, lavender `#9B7EBD` for premium)
  - Add **surface elevation tokens** (`surface1`, `surface2`, `surface3` for layered depth)
  - Add **glass/blur tokens** for iOS-style overlays
  - True neutral grayscale (currently mixed)

### 1.2 Typography Upgrade
- Load **Inter** + **Cabinet Grotesk** (display) via `expo-font` in `app/_layout.tsx`
- Update `constants/Typography.ts` with weights (400/500/600/700) and `letterSpacing` tokens
- Add **numeric/tabular** variant for currency amounts (uses `fontVariant: ['tabular-nums']`)

### 1.3 Motion System
- Create `constants/Motion.ts` with shared spring/timing presets (entry, exit, press, layout)
- Adopt `react-native-reanimated` `LayoutAnimation` (FadeIn, SlideIn) for list items
- Add `expo-haptics` micro-feedback presets (light/medium/heavy/success/error)

### 1.4 Component Library Refresh
- New components:
  - `components/Button.tsx` — variants (filled/tonal/outline/ghost), sizes, loading state, gradient option
  - `components/SegmentedControl.tsx` — replace duplicated tab UIs in Activity/Group screens
  - `components/Sheet.tsx` — bottom sheet (gorhom/bottom-sheet) for actions, replace Alerts
  - `components/Toast.tsx` — replace `Alert.alert` for non-critical feedback
  - `components/CurrencyAmount.tsx` — animated count-up + colored sign + tabular nums
  - `components/Chip.tsx` — for filters, categories
  - `components/Stat.tsx` — KPI card with trend
- Refresh `Card.tsx`, `Avatar.tsx`, `ExpenseItem.tsx` to match new system

**Deliverables**: New design tokens, 6 new shared components, refreshed primitives, updated logo set.

---

## Phase 2 — Payments: Real Money Movement

**Goal**: Transform "Settle Up" from a record into actual payment execution. This is the **biggest competitive gap**.

### 2.1 UPI Deep-Link Settlement (India — Free, Instant)
- Generate UPI intent URL: `upi://pay?pa={payee_upi}&pn={name}&am={amount}&tn={memo}&cu=INR`
- New screen `app/group/settle.tsx` flow:
  1. Pick payee → pre-fill from their `upi_id`
  2. Show suggested amount (calculated optimal settlement)
  3. **"Pay via UPI"** button → opens GPay/PhonePe/Paytm/BHIM via `Linking.openURL`
  4. **"Mark as Paid"** confirmation after returning to app
  5. Backend creates `Settlement` record with `payment_method: 'upi_intent'`
- Add **multi-app picker** (showing GPay/PhonePe/Paytm icons)
- Generate **QR code** of UPI string via `react-native-qrcode-svg` for in-person settlement

### 2.2 Razorpay Direct Payouts (Optional Pro Feature)
- Backend: integrate **Razorpay Route/Payouts API** for direct user-to-user transfers
- Requires payee to have linked bank account (collected during pro onboarding)
- Adds 0.5% fee → use as monetization angle (free for Pro users)

### 2.3 Stripe Connect (International Users)
- For non-India users, integrate **Stripe Connect Express**
- Onboarding flow: "Verify identity to receive payments"
- Bank-account-to-bank-account ACH or instant card payout

### 2.4 Subscription Payments Hardening
- **Unify iOS + Android flow** — currently iOS uses RevenueCat, Android uses raw Razorpay; both should funnel through RevenueCat (Razorpay isn't supported, but Stripe is via RC)
- Implement **server-side receipt validation** — currently relies on client-reported state in `splitmaro-api/index.ts`
- Add **restore purchases** button in `app/pro/upgrade.tsx`
- Add **manage subscription** deep-link to App Store/Play settings
- Add **promo codes** support (RevenueCat offerings)
- New **"Lifetime"** tier (one-time purchase)

### 2.5 Payment Tracking & Receipts
- Settlement detail screen showing:
  - Payment method, transaction ID, status
  - Action buttons: "Send Receipt", "Dispute", "Reverse"
- Email/SMS receipts via backend (Resend or AWS SES)
- Spending insights now include "settled" vs "outstanding" amounts

**New DB fields needed** in `Settlement` model:
```prisma
payment_method   String?  // 'upi_intent', 'razorpay_payout', 'stripe', 'manual_cash'
transaction_id   String?
payment_status   String?  @default("completed") // pending, completed, failed, disputed
payment_metadata Json?
```

---

## Phase 3 — Core Feature Completeness

### 3.1 Expense Editing
- New screen `app/group/expense/[id]/edit.tsx` (mirrors `add-expense.tsx`)
- Backend: `PATCH /api/expenses/:id` recalculates payers/shares atomically
- Add **edit history** panel for transparency (audit log table `ExpenseAudit`)

### 3.2 Custom Split Types (UI for Existing Schema)
Build a **SplitEditor** modal with 4 tabs:
- **Equal** (current default)
- **Exact amounts** — input per person, validate sum = total
- **Percentages** — sliders, validate sum = 100%
- **Shares** — "Alice gets 2 shares, Bob gets 1"

Use `react-native-reanimated` shared element transitions between tabs.

### 3.3 Expense Comments
- New section in expense detail: chat-like thread
- Realtime via existing **Socket.io** infrastructure
- Mention support (`@username`)
- Reactions (emoji) on comments

### 3.4 Receipt Gallery & OCR
- Receipt preview modal with pinch-zoom (`react-native-image-zoom-viewer`)
- Multi-receipt support (currently single `receipt_uri`) — change to `receipt_uris: String[]`
- **OCR via Google Vision API** (Pro feature): extract amount, date, merchant → autofill new expense
- **AI categorization** (Pro feature): use OpenAI to suggest category from receipt/description

### 3.5 Multi-Currency Support
- Add **currency picker** in expense form
- Backend: store original + converted amount using **exchangerate.host** (free) or **OpenExchangeRates** (paid)
- Group default currency setting
- Profile setting: home currency

### 3.6 Group Enhancements
- Custom group cover images (upload to backend, currently only string URL)
- Group archiving (currently only delete)
- Group simplification toggle ("simplify debts" — minimum cash flow algorithm)
- Member roles: admin/member; only admins can delete expenses

---

## Phase 4 — Beautiful Screens (Top-to-Bottom Redesign)

### 4.1 Dashboard (`app/(tabs)/index.tsx`)
- **Hero balance card** with animated gradient mesh background
- **Animated count-up** for total balance number
- **Horizontal scrollable group cards** with cover images & balance preview
- **"Recent Activity"** timeline (last 5 expenses)
- **Smart insights chip** ("You spent ₹2,400 less than last week")
- Pull-to-refresh with custom Lottie animation

### 4.2 Groups (`app/(tabs)/groups.tsx`)
- Replace plain list with **2-column grid** of cover-image cards
- Filter chips: All / Owe / Owed / Settled
- Long-press → Sheet with archive/leave/delete

### 4.3 Group Detail (`app/group/[id].tsx`)
- **Sticky parallax header** with cover image + group stats
- **Floating compact balance pill** as user scrolls
- Expense list grouped by date with sticky section headers
- **Skeleton on first load**, animated entry on subsequent loads

### 4.4 Activity (`app/(tabs)/activity.tsx`)
- Replace `react-native-chart-kit` with **Victory Native XL** or **react-native-skia** charts (animated, themable)
- Add: spending by group, top categories donut, monthly trend line, friends ranking
- Insights: "Biggest expense", "Most active group", "You've recovered ₹X this month"

### 4.5 Profile (`app/(tabs)/profile.tsx`)
- Profile header card with avatar editor (camera/gallery)
- Settings sections: Account / Preferences / Payments / Privacy / About
- **Theme picker** (System/Light/Dark + accent color selector)
- **Linked payment methods** section (UPI IDs, bank accounts)

### 4.6 Onboarding (`app/onboarding.tsx`)
- Add 4th slide showcasing payments
- **Lottie animations** instead of static icons
- Progress dots with smooth transitions

### 4.7 Pro Upgrade (`app/pro/upgrade.tsx`)
- Animated feature comparison table (Free vs Pro)
- Testimonials carousel
- Social proof ("12,847 users went Pro")
- 7-day free trial CTA
- Add **Annual** tier (40% discount)

---

## Phase 5 — True Offline-First (or Drop the Claim)

**Recommendation: Implement properly** — it's a real differentiator vs. Splitwise.

### 5.1 SQLite Local Cache
- Reintroduce `expo-sqlite` in `lib/database.ts`
- Mirror Prisma schema in local SQLite
- Read-through cache: hit local first, refresh from API in background

### 5.2 Mutation Queue
- Outbox table for pending mutations
- On reconnect: replay in order, resolve conflicts via `updated_at` timestamps
- UI: "Pending sync" indicator badge

### 5.3 Realtime Sync
- Already have Socket.io — wire it for live group updates
- Optimistic UI updates with rollback on server reject

---

## Phase 6 — Growth, Quality & Launch

### 6.1 Engagement
- **Push notifications** beyond local: real-time on new expense, settlement, friend request (Expo Push)
- **Smart reminders**: "Alice owes you ₹500 from 7 days ago — send reminder?"
- **Referral revamp** (`app/pro/referrals.tsx`): visual progress, share-sheet with deep link, reward unlock animation

### 6.2 Quality
- Add **Sentry** for error tracking
- Add **PostHog** for product analytics
- E2E tests with **Maestro** for critical flows (signup, add expense, settle)
- Unit tests in `splitmaro-api/tests/` for split math edge cases

### 6.3 Compliance & Trust
- In-app GDPR data export
- Account deletion flow (currently only "deactivate")
- Two-factor auth (Pro)
- Biometric app lock (Face ID / Fingerprint)

### 6.4 Marketing
- App Store screenshots regen (use new design)
- Update `splitmaro-landing` with new branding
- Demo video for Play Store / App Store

---

## Suggested Execution Order

| Sprint | Focus | Outcome |
|---|---|---|
| **1** | Phase 1.1–1.3 | New tokens, motion, fonts, logo |
| **2** | Phase 1.4 + Phase 4.1, 4.2 | New components + Dashboard/Groups redesign |
| **3** | Phase 2.1, 2.4, 2.5 | UPI settle + payment hardening |
| **4** | Phase 3.1, 3.2 | Expense editing + custom splits |
| **5** | Phase 4.3–4.5 | Group/Activity/Profile redesign |
| **6** | Phase 3.3, 3.4 | Comments + receipt gallery |
| **7** | Phase 5 | Offline-first |
| **8** | Phase 3.5, 3.6 + Phase 4.6, 4.7 | Multi-currency, group enhancements, onboarding/upgrade polish |
| **9** | Phase 2.2, 2.3 | Razorpay/Stripe payouts |
| **10** | Phase 6 | Quality, growth, launch |

---

## Dependencies to Add

```json
{
  "@gorhom/bottom-sheet": "^5",
  "@shopify/react-native-skia": "*",
  "victory-native": "^41",
  "react-native-qrcode-svg": "*",
  "lottie-react-native": "*",
  "@sentry/react-native": "*",
  "posthog-react-native": "*",
  "expo-image": "*",
  "expo-blur": "*",
  "@stripe/stripe-react-native": "*"
}
```

---

## Open Questions Before Starting

1. **Target market** — India-first (UPI focus) or global (Stripe-first)?
2. **Logo** — do you want me to design a wordmark/icon, or do you have brand assets?
3. **Priority** — payments-first or design-first if we have to pick one?
4. **Backend hosting** — staying on Railway, or moving (the build setup is solid)?
5. **Pro pricing model** — keep ₹499 lifetime, or introduce monthly/annual recurring?

---

## Recommendation

Start with **Phase 1 (Design System) → Phase 2.1 (UPI Settle)** as the highest-impact first sprint — it transforms both the look and the core value prop quickly.
