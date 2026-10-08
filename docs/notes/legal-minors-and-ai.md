# Law notes: under-18 users and AI

**Status: parked on purpose.** Decision on 4 Oct 2026: get a working prototype first, deal with the law before real users or a Google Play release. This page is the tracker so nothing is forgotten.

**This is not legal advice.** It is a list of rules I found and what each could mean for Pocket Sense. Before real users, ask someone who knows Indonesian law.

How sure each line is:

- **[search]** I only saw a search-result summary. I did not open the law or the policy itself.
- **[memory]** From my own memory. I did not check it at all.
- **[doc]** From your own backend-stack doc. I did not re-check it.

## The rules

| # | Rule | What it could mean for Pocket Sense | How sure |
|---|------|--------------------------------------|----------|
| 1 | **Indonesia, UU PDP (Law 27/2022), Article 25.** Processing a child's personal data needs the consent of the parent and/or guardian. | The parent-approval flow (sync and Ask locked until a parent approves) existed because of this. It was removed in PR #5 (5 Oct 2026), so under-18s can now sync without a parent's consent. See open decision 1. | [search] Legal portals and a Kompas article. I did not read the article text. That "child" means under 18 is [memory]. |
| 2 | **Indonesia, PP 17/2025 ("PP Tunas")**, in force since 1 Apr 2025. Splits children into 5 age bands (3-5, 6-9, 10-12, 13-15, 16 to under 18). Platform operators must verify age, limit access by age, offer parental controls, and handle a child's data only with parent/guardian consent. "High-risk" platforms must deactivate accounts of under-16s from 28 Mar 2026. | Same direction as rule 1. Whether Pocket Sense or its AI feature counts as "high-risk" depends on criteria I have not read. | [search] Kompas, Bisnis and law-firm summaries. |
| 3 | **Google Play** rules for apps that reach minors (Families policy, AI-Generated Content policy; policy update 15 Jul 2026). AI output must not be unsafe for minors, and AI outputs need labelling and moderation. | Declare the app's target age group honestly in Play Console. Ask is AI-written text, so the AI policy applies. | [search] Play Console help pages. I believe Play also expects an in-app way to report bad AI answers: [memory], please verify. |
| 4 | **OpenRouter Terms:** you must be 18 or older to use the service. | This is about whoever owns the OpenRouter account, not your app's users. | [search] Quoted from openrouter.ai/terms. |
| 5 | **NVIDIA API Trial Terms:** only an adult of legal age of majority in the country of use can accept them. The free API is for trial, testing and evaluation only, not production, unless you buy a subscription. | Whoever owns the NVIDIA account must meet the age rule. "Not production" is the main reason this is prototype-only. I did not read what NVIDIA may log or keep from prompts. | [search] Quoted from NVIDIA's trial-terms PDF. |
| 6 | **Gemini API terms (effective 23 Mar 2026)** bar apps directed at, or likely to be used by, under-18s. | Gemini is not used. | [doc] |
| 7 | **Free AI models may log or train on prompts**, depending on who runs the model. | Users' spending data goes into the prompt. OpenRouter has a privacy setting for this (`docs/ACCOUNTS-SETUP.md`, step 6). | [memory] |
| 8 | **EU / Germany:** the GDPR sets the age for a child's own consent at 16 by default. | Only matters if you target EU users. This is tied to the open question "AI for Germany" (see below). | [memory] |
| 9 | **USA, COPPA:** rules for under-13s. | Only matters if the app is aimed at US users. | [memory] |

## What the app does today

- Parent approval is back (restored 8 Oct 2026 after PR #5 removed it). Age comes from the full date of birth and today's date in Jakarta, so someone is an adult on their 18th birthday. Under 18: nothing syncs until a parent approves by email, and Ask is closed to them whatever the parent says ("Ask is for 18+", `supabase/functions/ask/index.ts`).
- Age and the parent are self-declared. Nothing checks that the date of birth is true or that the approving email belongs to a parent: a child can type a friend's address. Whether that is enough for UU PDP Article 25 is the open question for a lawyer.
- Ask sends a summary of the last 4 weeks of logged spending. It never sends the email or date of birth.
- Ask is limited to the user's own money by a prompt plus checks on the answer (see `backend-status.md`, "Keeping Ask to money questions"). That helps with Google Play's rule that AI must not produce unsafe content for minors (rule 3), but it is not a guarantee.
- The privacy text and the "About Ask" screen now say the question goes to **NVIDIA or OpenRouter** (updated 4 Oct 2026 when NVIDIA was added).

## Open decisions (yours)

1. **Removing parent approval.** *Status, 8 Oct 2026: parent approval is restored (see "What the app does today"). The older status follows for history. 5 Oct 2026: the project owner had it removed (PR #5) before this was decided, in line with "prototype first, law before real users". The legal question below is still open and must be settled before real users.* The backend doc's plan (Account.tsx split, step 1) deletes the parent-approval flow. From rules 1 and 2 as summarized above, that looks like it conflicts with the law while under-18s can still create accounts. Options: keep parent approval, or block under-18s from accounts and keep them on the local-only mode. Decide this *before* doing step 1.
2. **Account holder for NVIDIA and OpenRouter.** Rules 4 and 5 need an adult (of legal age of majority) as account holder. Decided 5 Oct 2026: it will be the project owner once they qualify. Until then the keys are for private testing only and must not back real users. Not checked: whether Indonesia counts 18 or 21 as the age of majority for this. I believe it differs between laws [memory], so confirm.
3. **"AI for Germany"** was unanswered: if it means Gemini, that is ruled out (rule 6). If it means German users, that adds the GDPR (rule 8) and a German translation, which does not exist yet (the app has English and Indonesian only).
4. **Before launch:** read NVIDIA's and OpenRouter's data-retention terms in full, and check rule 3 in Play Console.

## Sources

- UU PDP, Article 25: [Kompas explainer](https://nasional.kompas.com/read/2022/09/20/13013871/uu-pdp-pemrosesan-data-anak-dan-penyandang-disabilitas-diatur-khusus), [law text (Hukumonline PDF)](https://learning.hukumonline.com/wp-content/uploads/2023/07/Undang-Undang-No.27-Tahun-2022-Hukumonline.pdf)
- PP 17/2025: [PP TUNAS book 1 (Komdigi)](https://djkpm.komdigi.go.id/assets/files/tunaspedia-buku-1.pdf), [Kompas, 19 Mar 2026](https://nasional.kompas.com/read/2026/03/19/21511411/pp-tunas-resmi-berlaku-regulasi-untuk-melindungi-anak-di-ruang-digital), [Bisnis, 16 Apr 2026](https://teknologi.bisnis.com/read/20260416/84/1966248/pemerintah-perkuat-aturan-pp-tunas-akses-anak-di-platform-digital-dibatasi)
- Google Play: [Policy announcement, 15 Jul 2026](https://support.google.com/googleplay/android-developer/answer/17134731), [Developer Policy Center](https://play.google/developer-content-policy/)
- [OpenRouter Terms of Service](https://openrouter.ai/terms)
- [NVIDIA API Trial Terms of Service (PDF)](https://assets.ngc.nvidia.com/products/api-catalog/legal/NVIDIA%20API%20Trial%20Terms%20of%20Service.pdf)
- [Gemini API Additional Terms](https://ai.google.dev/gemini-api/terms)
