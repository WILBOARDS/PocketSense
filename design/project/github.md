repo: WILBOARDS/PocketSense
branch: main
path: app/src

## Last sync
date: 2026-10-02T15:42:56Z

### Updated in this project
- V1 scope on mobile: share-to-cooldown, quick-add, mood tags, Parking lot filters, weekly summary, "Can I afford it?" chat
- Desktop half screen (600–1023px) and full window (1024px+) with sidebar, History table, always-visible quick-add, paste-a-link
- EN / ID switch on every screen; Rp currency and Indonesian e-wallets
- Optional account, data notice, sign out wipes phone, delete account

## Screen map
| Project screen | Repo files |
| --- | --- |
| 1a Home | app/src/screens/Home.tsx, app/src/App.tsx, app/src/styles/app.css |
| 1b–1c Quick-add / Saved | app/src/sheets/QuickLog.tsx, app/src/lib/constants.ts |
| 1d Park it | app/src/screens/Thinking.tsx |
| 1e Parking lot | app/src/screens/Parking.tsx |
| 1f Weekly summary | app/src/screens/Insights.tsx |
| 1g Ask | (new) |
| 1h Create account | app/src/screens/Account.tsx (SignIn) |
| 1i Settings | app/src/screens/Account.tsx (Settings), app/src/lib/sync.ts |
| 1j Half screen | app/src/screens/Transactions.tsx, app/src/sheets/QuickLog.tsx |
| 1k–1l Full window | app/src/screens/Transactions.tsx, app/src/screens/Parking.tsx, app/src/sheets/QuickLog.tsx |
