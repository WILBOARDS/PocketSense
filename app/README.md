# Pocket Sense

A phone-first spending app for students. It's built from the Claude Design handoff in `../design/project/Pocket Sense.dc.html`.
It's a React + TypeScript web app you can install to a phone's home screen (PWA). All data stays on the device.

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

## Where things live

| Path | What it is |
| --- | --- |
| `src/App.tsx` | Screen switching, bottom nav, sheets, toast, back-button handling |
| `src/screens/` | One file per screen: Home, Transactions, Insights, Goal, Thinking, Parking, Lookback, Onboarding (+ GoalSetup) |
| `src/sheets/` | Quick log and "Why?" bottom sheets |
| `src/lib/classify.ts` | Need / Useful / Want / Invest scoring and its reasons |
| `src/lib/insights.ts` | Pattern cards and stats. The formulas are documented at the top |
| `src/lib/derive.ts` | Week money, goal progress, parking lot, look-back queue, repeat chips |
| `src/lib/store.tsx` | App data and every action that changes it; saves to `localStorage` |
| `src/styles/ds.css` | The Modernist design system, copied unchanged (minus the Google Fonts import; Archivo is bundled) |
| `src/styles/app.css` | App layout and shared patterns built on the design tokens |

## Differences from the prototype

- **Weekly money is asked in onboarding** (step 1). The prototype hard-coded $120. Income logged in Quick log adds to the current week only.
- **Insights use real formulas.** The prototype's numbers were fixed samples. Pattern cards appear after 2 weeks of data. The two stats need at least 3 data points before they show a value.
- **"Buy it" (Thinking of buying, Parking lot) opens Quick log with the amount filled in**, so you pick the category. The prototype always saved these as Clothing.
- **Look-back check-ins** are offered 14–60 days after a Useful or Want purchase at or over your cooldown line. Answering "Regret it" or "Not yet" teaches the classifier that category (and mood) leans Want.
- **Commit to this** shows "This stays here until Sunday" instead of "We'll remind you at 10pm", because there are no notifications yet.
- **The goal can be edited** from the Goal screen. The prototype had no way to change it after onboarding.
- **Not built:** the prototype's side panel (screen jumper, data-state switcher), a loading state (reading local storage is instant), a settings screen for changing weekly money or the cooldown line later, and notifications.
