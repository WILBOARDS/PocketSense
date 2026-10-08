# Setting up accounts and sync

Pocket Sense works without any of this. With no Supabase settings, the app hides every account feature and keeps everything on the phone. This page covers turning sign-in and phone ↔ PC sync on.

## Already done

- A Supabase project called **Pocket Sense** (free plan, Singapore).
- The database: the first four files in [`supabase/migrations/`](../supabase/migrations/) are applied (accounts, the daily job that erases deleted accounts, Ask's question counter). The fifth, `…_parent_approval_and_dob.sql`, restores parent approval and replaces the birth year with a date of birth. It is **not applied yet**: apply it through the Supabase connector (not `npx supabase db push`: see item 5 of the code to-do in [`notes/backend-status.md`](notes/backend-status.md)), then redeploy `request-consent`, `approve-consent` and `ask` so they match it.
- The `delete-account`, `ask`, `request-consent` and `approve-consent` functions are deployed (the last two are the older versions and must be redeployed after the migration). Ask still needs its AI secrets: see step 6.
- [`.github/workflows/deploy-pages.yml`](../.github/workflows/deploy-pages.yml) builds the app from the GitHub secrets and publishes it to GitHub Pages on every push to `main`.

## Where the keys live (and why nothing leaks)

| Value | Secret? | Where it goes |
| --- | --- | --- |
| Project URL (`https://<ref>.supabase.co`) | No | GitHub secret `VITE_SUPABASE_URL`, or your own `app/.env.local` |
| Publishable key (`sb_publishable_…`) | No, it's made to be public | GitHub secret `VITE_SUPABASE_PUBLISHABLE_KEY`, or your own `app/.env.local` |
| Brevo API key (`xkeysib-…`) | **Yes** | Supabase → Edge Functions → Secrets only |
| NVIDIA API key (`nvapi-…`) and OpenRouter API key (`sk-or-…`) | **Yes** | Supabase → Edge Functions → Secrets only. Never in `app/.env.local` or a `VITE_` variable: those end up in the public JavaScript. |
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

All the app's own emails (parent approval, account deletion) go through [Brevo](https://www.brevo.com). Resend is no longer used.

1. In Brevo: **SMTP & API → API keys → Generate a new API key**. Copy it (it starts `xkeysib-`).
2. In Brevo: **Senders, domains & dedicated IPs → Senders**. The sender address must be verified there. A Gmail address is a poor choice: Gmail and Yahoo tend to reject or spam-folder mail that claims to come from their domain but is sent by someone else (from memory, not tested). Use an address on a domain you own and authenticate that domain in Brevo (its DKIM, SPF and DMARC records).
3. Supabase → **Edge Functions → Secrets** (Manage secrets), add:
   - `BREVO_API_KEY`: the key from step 1
   - `EMAIL_FROM_ADDRESS`: the verified sender address from step 2
   - `EMAIL_FROM_NAME`: optional, defaults to `Pocket Sense`
   - `EMAIL_REPLY_TO`: optional, the contact address. When set, it's shown in every email's footer and used for replies.
   - `APP_URL`: `https://wilboards.github.io/PocketSense/`
   - You can delete the old `RESEND_API_KEY` and `EMAIL_FROM` secrets.
4. Confirm-your-email and reset-password emails come from Supabase Auth itself, not from these functions. Supabase's built-in sender only mails members of your Supabase organization, a few per hour. For real users, go to Authentication → Emails → SMTP Settings and turn on custom SMTP with Brevo (host `smtp-relay.brevo.com`, port `587`; the login and the SMTP key are shown in Brevo under SMTP & API → SMTP, and the SMTP key is **not** the API key from step 1). Use the same verified sender. **The privacy policy says all these emails go through Brevo, so it is only true once this step is done.**

While testing, use your own email address as the "parent".

### 5. Optional: Continue with Google

In [Google Cloud Console](https://console.cloud.google.com) create an OAuth client (Web application) with the redirect URI shown on Supabase → Authentication → Providers → Google, then paste the client ID and secret there. Until you do, the Google button shows an error; email sign-in works.

### 6. Turn on Ask (AI answers)

Ask sends a question plus a summary of what the user logged to a free AI model, through [NVIDIA NIM](https://build.nvidia.com) first and [OpenRouter](https://openrouter.ai) as the fallback. It only works for signed-in users who are 18 or older. Both free tiers are for prototypes: see [`notes/backend-status.md`](notes/backend-status.md) for the limits and [`notes/legal-minors-and-ai.md`](notes/legal-minors-and-ai.md) for the terms.

1. The `ask_usage` migration and the `ask` function are already deployed (4 Oct 2026). To redeploy after a change: `npx supabase functions deploy ask`, or ask Claude to do it through the Supabase MCP.
2. Get a key from each service: build.nvidia.com → your profile → **API Keys** (starts `nvapi-`), and openrouter.ai → **Keys → Create key**. Give the OpenRouter key a **credit limit** (for example $2) so a bug can't run up a bill. Test both on your own computer with the `curl` commands in [`notes/backend-status.md`](notes/backend-status.md) before using them.
3. On openrouter.ai → **Settings → Privacy**: turn off any option that lets providers train on or log your prompts. Your users' spending goes through here.
4. Pick a model on each service. Choose a plain "instruct" chat model, not a "reasoning/thinking" one (those spend the answer's token limit thinking and can break the JSON). OpenRouter's free models end in `:free`. Copy the exact IDs.
5. Supabase → **Edge Functions → Secrets**, add:
   - `NVIDIA_API_KEY` and `NVIDIA_MODEL`
   - `OPENROUTER_API_KEY` and `OPENROUTER_MODEL`
   - Optional `AI_PROVIDERS`: the order to try them, default `nvidia,openrouter`. Use `openrouter` alone to turn NVIDIA off.

A service is used only when both its key and its model are set. If an AI service errors, is rate-limited or gives an unreadable answer, the next one is tried. If none is set up, Ask answers "Ask isn't switched on yet", sends nothing anywhere and doesn't use up the user's daily questions. If they all fail, Ask shows "Ask couldn't answer right now".

Check each provider's terms before real users try it. Some AI APIs don't allow apps that people under 18 are likely to use, and Pocket Sense is for students.

## Test on your computer instead

Copy `app/.env.example` to `app/.env.local`, fill in the two values from step 1, then `cd app && npm run dev`. `.env.local` is ignored by git.

## Check it works

- [ ] Home shows "Sign in to use Pocket Sense on your PC". Create an account with a date of birth that makes you over 18 → open the confirm link in the email → the upload screen says "All copied".
- [ ] Supabase → Table Editor → `user_data` has one row.
- [ ] Open the app in a second browser, tap "I already have an account" on the first onboarding step and sign in: the same purchases appear.
- [ ] Turn off Wi-Fi and log something: "Offline · 1 change waiting". Turn it back on: "Synced".
- [ ] Create a second account with a date of birth under 18 and use **your own email** as the parent: you get the approval email, approve it, reopen the app, and it copies the data.
- [ ] Settings → Delete account → sign in again → "Keep your account?" → Restore.
- [ ] Ask tab, signed in: "Can I afford Rp 189.000 earbuds?" gives an answer card with "Left this week" and "After buying". Supabase → Table Editor → `ask_usage` shows a count of 1 for today.

## Changing the database later

Add a new file to `supabase/migrations/` (never edit one that's already applied), then apply it with the Supabase CLI (`npx supabase db push`) or ask Claude to apply it through the Supabase MCP.

## Before real users sign up

- Replace `[date]` and `[contact email]` in the privacy policy (`app/src/screens/Account.tsx`, `POLICY_UPDATED` and `CONTACT_EMAIL`).
- Own a domain, authenticate it in Brevo, and switch `EMAIL_FROM_ADDRESS` to an address on it, so parents' emails arrive.
- The privacy policy and the under-18 flow follow the design. They are **not legal advice**. Ask someone who knows Indonesia's UU PDP before this becomes a real product.
- The goal photo is not synced. It stays on the device where you added it.
