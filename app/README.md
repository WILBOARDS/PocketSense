# Pocket Sense

A phone-first spending app for students. It's built from the Claude Design handoff in `../design/project/Pocket Sense.dc.html`.
It's a React + TypeScript web app you can install to a phone's home screen (PWA). All data stays on the device unless you sign in.

**V1** (`../design/project/Pocket Sense V1.dc.html`) adds English / Indonesian, Rupiah, a category dropdown with your own categories, Indonesian e-wallets, sharing a product from a shop app into the parking lot, parking-lot filters, and **Ask**, AI answers about your own logged money. It also lays out for bigger windows: half screen (600–1023px, tabs on top) and full window (1024px and up, sidebar plus a side panel for logging and parking from a link).

## Run it

```bash
cd app
npm install
npm run dev        # http://localhost:5173 — open it on your phone via your computer's LAN IP
npm test           # logic tests (classifier, dates, insights)
npm run build      # typecheck + production build into dist/
npm run preview    # serve the production build (service worker on)
```

To install it on Android, host the `dist/` folder over HTTPS (Netlify, Vercel, Cloudflare Pages, GitHub Pages). Open it in Chrome, then choose *Add to Home screen*.

## Accounts and sync

Signing in is optional. Without Supabase settings (`.env.local`, see `.env.example`), the app hides every account feature and works exactly as before. To turn accounts on, follow [docs/ACCOUNTS-SETUP.md](../docs/ACCOUNTS-SETUP.md).

How sync works: the account keeps one copy of the app data with a version number. The phone sends its changes a moment after each edit, and checks for changes from the PC every minute and whenever the app comes back to the screen. If both changed, nothing is lost: every purchase, saving and parked item from both sides is kept. For the rest (settings, goal), the device sending the change wins. No purchase or other app data reaches the server for an under-18 user until a parent approves by email.

## Where things live

| Path | What it is |
| --- | --- |
| `src/App.tsx` | Screen switching, the three layouts, bottom nav, sheets, toast, back-button handling, language and currency, shared links |
| `src/layout.ts` | Which layout the window width calls for: phone, half screen or full window |
| `src/components/Shell.tsx` | Half-screen top bar and tabs, full-window sidebar |
| `src/components/LogPanel.tsx`, `ParkForm.tsx`, `PastePark.tsx`, `ReadyBanner.tsx` | Logging by typing, the Park it form, paste-a-link, and "Wait's over" choices, shared by the layouts |
| `src/screens/History.tsx` | History on bigger windows (list at half screen; search, totals and table at full window) |
| `src/screens/` | One file per screen: Home, Transactions (Spending), Insights (Week), Ask, Goal, Thinking (Park it), Parking, Lookback, Onboarding (+ GoalSetup) |
| `src/lib/i18n.ts` | English / Indonesian. Strings are written in place as `tr('English', 'Indonesia')` |
| `src/lib/format.ts` | Money in Rupiah or dollars, and amount fields |
| `src/lib/share.ts` | Reads a product name, price and shop from a shared or pasted link |
| `src/lib/ask.ts` | What Ask sends to the AI (a summary, no account details) and checks the answer |
| `../supabase/functions/ask/` | The server side of Ask: checks the user, counts questions, calls a free AI model through NVIDIA NIM and/or OpenRouter |
| `src/sheets/` | Quick log and "Why?" bottom sheets |
| `src/lib/classify.ts` | Need / Useful / Want / Invest scoring and its reasons |
| `src/lib/insights.ts` | Pattern cards and stats. The formulas are documented at the top |
| `src/lib/derive.ts` | Week money, goal progress, parking lot, look-back queue, repeat chips |
| `src/lib/store.tsx` | App data and every action that changes it; saves to `localStorage` |
| `src/lib/account.ts` | Sign-in, parent approval, delete/restore, and syncing with the account (Supabase) |
| `src/lib/sync.ts` | Merging the phone's and the account's copies, sync status labels (pure, tested) |
| `src/screens/Account.tsx` | Settings, sign in, password reset, parent approval request, upload, restore, delete, privacy policy |
| `src/screens/ParentApprove.tsx` | The page a parent opens from the approval email |
| `../supabase/` | Database tables and rules, and the email functions. Setup: [docs/ACCOUNTS-SETUP.md](../docs/ACCOUNTS-SETUP.md) |
| `src/styles/ds.css` | The Modernist design system, copied unchanged (minus the Google Fonts import; Archivo is bundled) |
| `src/styles/app.css` | App layout and shared patterns built on the design tokens |

## Differences from the prototype

V1:

- **Currency is a choice** (Rupiah or dollars) in setup and Settings. New users start on Rupiah. Data saved before V1 stays in dollars so its numbers don't change meaning. Switching currency only changes the symbol; it doesn't convert amounts.
- **Settings work without an account** and you can change weekly money, the cooldown line and the currency there. The design showed them as fixed values.
- **The first setup screen has an EN / ID switch**, because Settings isn't reachable until setup is done.
- **Date of birth stays on Create account** (the design removed it, and asked only for a year) because it decides whether a parent has to approve before anything syncs, and whether Ask is open to you (18+ only). The server's `account_status()` never returns it and it is never sent to Ask (a signed-in user can still read their own row in `profiles`). Accounts start at 13; an adult can correct the date later, only to another adult date and once every 30 days. The "What gets stored" box is gone, as in the design.
- **Ask needs an account and is for 18+ only** (a parent's approval does not unlock it), since the question and a summary of your spending leave the phone. "Left this week" and "After buying" on the answer card are worked out by the app, not by the AI. Limit: 30 questions a day.
- **"Read the documentation"** under Ask opens an in-app page explaining what Ask sees and where it goes.
- **Sharing from a shop app** only works once Pocket Sense is installed to the home screen on Android (Chrome's Share target). iPhones don't support it. The name and price come from the text the shop app shares; shop pages can't be read from the browser, so you check them before parking.
- **Pattern sentences** (Week) keep the real formulas from before; the design's "after 9pm" wording was sample copy.
- **Goal** moved off the bottom bar (Ask took its place). Tap the goal on Home to open it. At half screen it gets a fifth tab, because the design's four tabs left no way to reach it.
- **Bigger windows:** "Decide" on a parked item opens the same three choices (Skip it, Wait longer, Buy it) in a dialog. Sheets (Quick log, Why?, Sign out) become centred dialogs. Search on the full-window History looks through all purchases, not just this week. The side panel's Park form also lets you park something under your cooldown line, since you pasted it to wait on it.

Before V1:

- **Weekly money is asked in onboarding** (step 1). The prototype hard-coded $120. Income logged in Quick log adds to the current week only.
- **Insights use real formulas.** The prototype's numbers were fixed samples. Pattern cards appear after 2 weeks of data. The two stats need at least 3 data points before they show a value.
- **"Buy it" (Thinking of buying, Parking lot) opens Quick log with the amount filled in**, so you pick the category. The prototype always saved these as Clothing.
- **Look-back check-ins** are offered 14–60 days after a Useful or Want purchase at or over your cooldown line. Answering "Regret it" or "Not yet" teaches the classifier that category (and mood) leans Want.
- **Commit to this** shows "This stays here until Sunday" instead of "We'll remind you at 10pm", because there are no notifications yet.
- **The goal can be edited** from the Goal screen. The prototype had no way to change it after onboarding.
- **Accounts need a few screens the design doesn't show:** "Check your email" after creating an account (Supabase confirms the address first), "Choose a new password" after the reset link, "Finish creating your account" when someone signs in with Google without giving a date of birth, the parent's approval page, and an error state on the upload screen. They reuse the design's layouts. The first onboarding step also has an "I already have an account" link, so a new PC can sign in without setting up first.
- **Sign-in is real, not simulated.** The design's sample login (rina@example.com) and the side panel's account/offline switches are not in the app.
- **Under 18 is decided from the full date of birth and today's date in Jakarta**, so someone is an adult on their 18th birthday. The rule lives in three places that must agree: `src/lib/age.ts`, `supabase/functions/_shared/age.ts` and `public.is_minor()` in the database. Age is self-declared and not verified.
- **Not built:** the prototype's side panel (screen jumper, data-state switcher), a loading state (reading local storage is instant), settings for changing weekly money or the cooldown line later, syncing the goal photo, and notifications.
