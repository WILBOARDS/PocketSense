# Setting up accounts and sync

Pocket Sense works without any of this: with no Supabase settings, the app hides every account feature and keeps everything on the phone. Follow these steps when you want sign-in and phone ↔ PC sync to work for real.

You need four free accounts: **Supabase** (database and sign-in), **Resend** (sends emails), **Google Cloud** (only for "Continue with Google") and wherever you host the app (Netlify, Vercel, Cloudflare Pages…).

Plan for about an hour the first time. Do the steps in order.

## 1. Create the Supabase project

1. Go to [supabase.com](https://supabase.com), sign up, and click **New project**.
2. Pick a region close to your users (for Indonesia: **Southeast Asia (Singapore)**).
3. Save the database password somewhere safe. You won't need it in the app.

## 2. Create the tables and rules

1. In the dashboard, open **Database → Extensions**, search for **pg_cron** and enable it. This runs the daily job that erases accounts 7 days after deletion.
2. Open **SQL Editor → New query**. Paste all of [`supabase/migrations/20260930000000_accounts.sql`](../supabase/migrations/20260930000000_accounts.sql) and click **Run**.
3. Do the same with [`supabase/migrations/20260930000100_erase_deleted_accounts.sql`](../supabase/migrations/20260930000100_erase_deleted_accounts.sql).

What this creates:

| Table | Holds |
| --- | --- |
| `profiles` | Birth year, parent approval, deletion date (one row per user) |
| `user_data` | The app data as one JSON document per user, plus a version number (`rev`) |
| `consent_requests` | Parent approval links (only a hash of each link is stored) |

The app can only **read** its own rows. All writes go through database functions that check the rules (`push_data` refuses to save anything for an under-18 user until a parent approves).

## 3. Sign-in settings

In **Authentication → URL Configuration**:

- **Site URL**: your app's address, for example `https://pocketsense.netlify.app`
- **Redirect URLs**: add the same address, and `http://localhost:5173` for testing on your computer

In **Authentication → Providers → Email**:

- Keep **Confirm email** on. New users get a link to confirm their address before they can sign in.
- Set **Minimum password length** to 8 (the app asks for 8 too).

## 4. Emails through Resend

1. Sign up at [resend.com](https://resend.com).
2. **Verify a domain** (Domains → Add domain), then add the DNS records it shows you. Until you do, Resend only sends to *your own* email address, so parents and other users get nothing. If you don't own a domain, a cheap one works fine.
3. Create an **API key** (API Keys → Create).
4. Make Supabase send its own emails (confirm email, password reset) through Resend. In Supabase, open **Authentication → Emails → SMTP Settings** and enable custom SMTP:
   - Host `smtp.resend.com`, port `465`, username `resend`, password: your Resend API key
   - Sender email: an address on your verified domain, such as `hello@yourdomain.com`

## 5. Continue with Google (optional)

1. In [Google Cloud Console](https://console.cloud.google.com), create a project, then go to **APIs & Services → OAuth consent screen** and fill it in.
2. **Credentials → Create credentials → OAuth client ID → Web application**.
   Under **Authorized redirect URIs**, add `https://<your-project-ref>.supabase.co/auth/v1/callback` (Supabase shows the exact address on its Google provider page).
3. Copy the client ID and secret into Supabase **Authentication → Providers → Google** and enable it.

If you skip this, the "Continue with Google" button shows an error. Email sign-in still works.

## 6. Deploy the email functions

These three small server functions send the parent-approval and account-deletion emails.

```bash
cd PocketSense            # the repo root, where the supabase/ folder is
npx supabase login
npx supabase link --project-ref <your-project-ref>

npx supabase secrets set RESEND_API_KEY=re_xxx
npx supabase secrets set EMAIL_FROM="Pocket Sense <hello@yourdomain.com>"
npx supabase secrets set APP_URL=https://pocketsense.netlify.app

npx supabase functions deploy request-consent
npx supabase functions deploy approve-consent
npx supabase functions deploy delete-account
```

`approve-consent` has to work for parents who don't have an account. `supabase/config.toml` already turns off its session check. The one-time token in the email link is checked instead.

## 7. Connect the app

1. In Supabase, open **Project Settings → API Keys** and copy the **Project URL** and the **publishable** key (older projects call it the `anon` key). Both are meant to be public. **Never** put the `service_role` / secret key in the app.
2. In `app/`, copy `.env.example` to `.env.local` and fill them in:
   ```
   VITE_SUPABASE_URL=https://<your-project-ref>.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxx
   ```
3. On your host (Netlify / Vercel / Cloudflare Pages), add the same two variables under the site's environment variables, then redeploy.

`.env.local` is ignored by git, so it won't be committed.

## 8. Check it works

Run `npm run dev` in `app/` and go through this list:

- [ ] Home shows "Sign in to use Pocket Sense on your PC". Create an account with a birth year over 18 → confirm email → the upload screen says "All copied".
- [ ] In Supabase **Table Editor → user_data** there is one row with your purchases.
- [ ] Open the app in a second browser, tap "I already have an account" on the first onboarding step, and sign in. It shows the same purchases.
- [ ] Turn off Wi-Fi, log something: the header says "Offline · 1 change waiting". Turn it back on: "Synced".
- [ ] Create a second account with a birth year under 18. You get "Ask a parent to approve". Send it to an email you can open, approve it, then reopen the app. It copies the data.
- [ ] Settings → Delete account → sign in again → "Keep your account?" → Restore.

## Before real users sign up

- Replace `[date]` and `[contact email]` in the privacy policy (`app/src/screens/Account.tsx`, `POLICY_UPDATED` and `CONTACT_EMAIL`).
- The privacy policy and the under-18 approval flow follow the design. They are **not legal advice**. If this becomes a real product, ask someone who knows Indonesia's UU PDP to check them.
- The goal photo is not synced. It stays on the device where you added it.
