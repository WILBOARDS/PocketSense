# Setting up accounts and sync

Pocket Sense works without any of this. With no Supabase settings, the app hides every account feature and keeps everything on the phone. This page covers turning sign-in and phone ↔ PC sync on.

## Already done

- A Supabase project called **Pocket Sense** (free plan, Singapore).
- The database: all three files in [`supabase/migrations/`](../supabase/migrations/) are applied, including the daily job that erases deleted accounts.
- The three email functions (`request-consent`, `approve-consent`, `delete-account`) are deployed.
- [`.github/workflows/deploy-pages.yml`](../.github/workflows/deploy-pages.yml) builds the app from the GitHub secrets and publishes it to GitHub Pages on every push to `main`.

## Where the keys live (and why nothing leaks)

| Value | Secret? | Where it goes |
| --- | --- | --- |
| Project URL (`https://<ref>.supabase.co`) | No | GitHub secret `VITE_SUPABASE_URL`, or your own `app/.env.local` |
| Publishable key (`sb_publishable_…`) | No, it's made to be public | GitHub secret `VITE_SUPABASE_PUBLISHABLE_KEY`, or your own `app/.env.local` |
| Resend API key (`re_…`) | **Yes** | Supabase → Edge Functions → Secrets only |
| `service_role` / secret key | **Yes, the most dangerous one** | Nowhere. Supabase gives it to the functions automatically. Never put it in the app, GitHub or chat. |

Both app values end up inside the built JavaScript that every visitor downloads. That's normal: the database rules (RLS and the checked functions) are what protect the data, not these keys. They're kept in GitHub secrets so they aren't copied into the code.

`.gitignore` blocks `.env`, `.env.*` and `*.local` everywhere, so `git push` can't upload them. Only `app/.env.example` (empty placeholders) is committed.

## Your steps (about 15 minutes)

### 1. Add the two GitHub secrets

GitHub → the PocketSense repo → **Settings → Secrets and variables → Actions → New repository secret**. Add:

- `VITE_SUPABASE_URL`: from Supabase → Project Settings → API → Project URL
- `VITE_SUPABASE_PUBLISHABLE_KEY`: from Supabase → Project Settings → API Keys → the **publishable** key

### 2. Turn on GitHub Pages

GitHub → **Settings → Pages → Build and deployment → Source: GitHub Actions**.

After the next push to `main` (merging the PR counts), the app is at `https://wilboards.github.io/PocketSense/`. The run shows under the **Actions** tab.

### 3. Tell Supabase where the app lives

Supabase → **Authentication → URL Configuration**:

- **Site URL**: `https://wilboards.github.io/PocketSense/`
- **Redirect URLs**: add `https://wilboards.github.io/PocketSense/` and `http://localhost:5173/`

Without this, the confirm-email and password-reset links send people to the wrong place.

### 4. Give the email functions their secrets

1. Sign in at [resend.com](https://resend.com) → **API Keys → Create API key** (permission: Sending access). Copy it.
2. Supabase → **Edge Functions → Secrets** (Manage secrets), add:
   - `RESEND_API_KEY`: the key from Resend
   - `EMAIL_FROM`: `Pocket Sense <onboarding@resend.dev>` for testing
   - `APP_URL`: `https://wilboards.github.io/PocketSense/`

Two limits while testing:
- **Resend** only delivers to your own email address until you verify a domain (Resend → Domains). Parent-approval tests must use your own address as the "parent".
- **Supabase's built-in email** (confirm email, password reset) only sends to members of your Supabase organization, a few per hour. That's you, so testing works. For real users, set up custom SMTP with Resend (Authentication → Emails → SMTP: host `smtp.resend.com`, port `465`, user `resend`, password = a Resend API key) once you have a verified domain.

### 5. Optional: Continue with Google

In [Google Cloud Console](https://console.cloud.google.com) create an OAuth client (Web application) with the redirect URI shown on Supabase → Authentication → Providers → Google, then paste the client ID and secret there. Until you do, the Google button shows an error; email sign-in works.

## Test on your computer instead

Copy `app/.env.example` to `app/.env.local`, fill in the two values from step 1, then `cd app && npm run dev`. `.env.local` is ignored by git.

## Check it works

- [ ] Home shows "Sign in to use Pocket Sense on your PC". Create an account with a birth year over 18 → open the confirm link in the email → the upload screen says "All copied".
- [ ] Supabase → Table Editor → `user_data` has one row.
- [ ] Open the app in a second browser, tap "I already have an account" on the first onboarding step and sign in: the same purchases appear.
- [ ] Turn off Wi-Fi and log something: "Offline · 1 change waiting". Turn it back on: "Synced".
- [ ] Create a second account with a birth year under 18 and use **your own email** as the parent: you get the approval email, approve it, reopen the app, and it copies the data.
- [ ] Settings → Delete account → sign in again → "Keep your account?" → Restore.

## Changing the database later

Add a new file to `supabase/migrations/` (never edit one that's already applied), then apply it with the Supabase CLI (`npx supabase db push`) or ask Claude to apply it through the Supabase MCP.

## Before real users sign up

- Replace `[date]` and `[contact email]` in the privacy policy (`app/src/screens/Account.tsx`, `POLICY_UPDATED` and `CONTACT_EMAIL`).
- Verify a domain in Resend and switch `EMAIL_FROM` to it, so parents can actually get emails.
- The privacy policy and the under-18 flow follow the design. They are **not legal advice**. Ask someone who knows Indonesia's UU PDP before this becomes a real product.
- The goal photo is not synced. It stays on the device where you added it.
