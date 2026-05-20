# Splitmaro Project Handover Guide 🚀

This document provides all the context and technical details required to continue the development of **Splitmaro**, a premium offline-first expense-sharing application. You can copy-paste sections of this document into the AI assistant to give it full context on where the project currently stands.

## 📱 Project Overview
Splitmaro is a Splitwise-inspired application built for high performance and visual excellence. It features a robust bi-directional sync engine, premium animations, and a tiered subscription model.

## 🛠 Tech Stack
- **Frontend:** React Native (Expo SDK 50+)
- **Navigation:** Expo Router (File-based)
- **Database:** SQLite (Local-first) via `expo-sqlite`
- **Backend/Auth:** Supabase (PostgreSQL + Realtime Sync)
- **Animations:** `react-native-reanimated`
- **Payments:** UPI Deep Linking (NPCI Standards)

## 🏗 Key Architecture: "Offline-First Sync"
The app uses a "Local-First" approach:
1. All user actions (expenses, groups, etc.) are written to a local SQLite database immediately for zero latency.
2. The `useSync` hook triggers the `lib/sync.ts` engine.
3. Data is pushed to/pulled from Supabase in the background.
4. Real-time subscriptions ensure that if a friend adds an expense, it appears on your device automatically.

## ✅ Current Feature Status (Updated: Phase 3)
- [x] **Authentication:** Supabase Auth (Email/Password & Magic Link).
- [x] **Group Management:** Create groups with categories (Trip, Home, etc.).
- [x] **Expense Splitting:** Equal, Exact Amount, and Percentage-based splits.
- [x] **Settlements:** One-tap UPI payment integration.
- [x] **Cloud Sync:** Bi-directional sync for all core entities.
- [x] **Pro Tier (Freemium):** 3-group limit for free users; "Splitmaro Pro" upgrade screen.
- [x] **Recurring Expenses:** Auto-generated bills with a 🔁 badge indicator (Pro feature).
- [x] **Monthly Budget Alerts:** Color-coded progress bar and alerts in the Insights tab based on a user-set monthly budget.
- [x] **Expense Notes:** Users can attach multi-line notes when creating/editing an expense.

## 🔑 Environment Setup
Ensure your `.env` file in the root directory contains:
```bash
EXPO_PUBLIC_SUPABASE_URL=your_project_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
```

## 🚀 How to Run
1. Install dependencies: `npm install`
2. Start the dev server: `npx expo start -c`
3. Press `i` for iOS or `a` for Android.

## 🤖 Prompts for AI Assistant
If you are passing this project to an AI, give it this prompt:

> "We are working on Splitmaro, a React Native (Expo) offline-first app using SQLite and Supabase for sync. The app currently supports group creation, expense splitting, recurring expenses, and monthly budget alerts. Please review the database schema in `lib/database.ts` to understand the local SQLite structure before making any changes. We are currently trying to tackle the next task: [INSERT NEXT TASK HERE]."

## 🚧 Developer Roadmap (Next Tasks)
1. **Receipt Photo Uploads:** We added `receipt_url` to the SQLite schema, but the UI only supports text Notes right now. Next step is to integrate `expo-image-picker` and Supabase Storage to upload receipt photos.
2. **Recurring Management:** Add a UI to "Stop/Cancel" a recurring expense template from the Edit Expense screen.
3. **Security Hardening:** Update Supabase RLS policies to restrict data access strictly to `auth.uid()`.
4. **Member Management:** UI for removing members from a group and handling their remaining balances.
5. **Conflict Resolution:** Enhance the sync engine to handle edge cases where the same expense is edited simultaneously on two devices.

## 🐞 Known Gotchas
- **Text Rendering:** Always use `!!` for boolean checks on numbers (e.g., `!!user.is_pro`) to avoid "Text strings must be rendered within a <Text> component" crashes.
- **Sync Loops:** `lib/database.ts` and `lib/sync.ts` have a circular dependency handled by `require('./sync')` inside database functions. Be careful when refactoring these.
- **Migrations:** SQLite migrations are managed inside `lib/database.ts`. If you add new columns, always append a new migration object to the `migrations` array.

---
**Happy Coding!** Let's make Splitmaro the #1 expense splitting app.
