# Portfolio Website + AI Chatbot — Product Requirements Document

**Owner:** Ankeeth V
**Status:** Draft v1 (pending design screenshots)
**Last updated:** 2026-09-06

---

## 1. Overview

A personal portfolio website for Ankeeth V that showcases his background (bio, experience, projects, skills) and includes an AI chatbot that answers visitor questions about him — grounded strictly in his content. The site includes a private admin page for Ankeeth to update his content without touching code. The entire application (public site, chatbot backend, and admin) deploys as a single project on Vercel.

**Primary goal:** A shareable public link (for LinkedIn) that gives recruiters, clients, and hiring managers a fast, credible, interactive way to learn about Ankeeth — including asking the embedded chatbot direct questions instead of reading the whole page.

---

## 2. Goals & Non-Goals

### Goals
- Modern, creative, non-templated visual design (matching a provided reference — pending screenshots).
- Chatbot that answers only from Ankeeth's real content — no hallucinated facts.
- Zero-code content updates via a private admin page.
- Single-provider deployment (Vercel) with managed Postgres storage.
- Self-seeding on first run so the site is never blank.
- Secrets (AI key, admin password, JWT secret) never exposed to the browser.

### Non-Goals (out of scope for v1)
- Multi-user / multi-tenant support (this is a single-person portfolio).
- Blog or long-form content system.
- Analytics dashboard (basic page-view tracking can be a future enhancement).
- Multi-language support.
- Native mobile app.

---

## 3. Source of Truth for Content

`profile.md` (as provided) is the **initial seed source** for the database. Structure:
- Personal Info (name, title, location, email, LinkedIn, GitHub, bio)
- Experience (company, title, dates, bullet points)
- Projects (name, description, tech, link)
- Skills (technical, tools & platforms, soft skills)
- FAQ (pre-written Q&A pairs, including sensitive ones like relocation and notice period)

After the first deploy, the **database is the live source of truth** — edits made in the admin page take effect immediately, without editing `profile.md` or redeploying. `profile.md` is only read once, at first boot, if the database is empty.

---

## 4. Users & Use Cases

| User | Use Case |
|---|---|
| Recruiter / Hiring Manager | Skims hero + experience, asks chatbot about seniority, availability, notice period, relocation |
| Client (freelance/consulting) | Reviews projects, asks chatbot about specific technical skills or past project outcomes |
| Casual visitor (LinkedIn referral) | Browses design, views resume PDF, contacts via form or email |
| Ankeeth (admin) | Logs into `/admin`, edits bio/experience/projects/skills/FAQ, changes reflect live immediately |

---

## 5. Public Site — Functional Requirements

### 5.1 Hero Section
- Profile photo displayed next to name and current title.
- Placeholder image used until Ankeeth supplies a real photo.
- Short bio pulled from the database (`personal_info.bio`).
- **View Resume** button — opens the resume PDF in a new browser tab. PDF is bundled as a static project asset (placeholder file until Ankeeth supplies the real one) at a fixed path (e.g. `/resume.pdf`).
- Light/dark theme toggle:
  - Switches the whole site's color scheme.
  - Persists the visitor's choice (stored in `localStorage`) so it's remembered on return visits in the same browser.
  - Defaults to the visitor's OS-level preference (`prefers-color-scheme`) on first visit if no stored choice exists.

### 5.2 Experience Section
- Renders all experience entries from the database, most recent first.
- Each entry: company, title, date range, 2–3 achievement bullets.

### 5.3 Projects Section
- Rendered as a responsive grid of cards.
- Each card shows: thumbnail image (placeholder until supplied), project name, one-line description.
- Optional video link badge/icon on cards that have one.
- Clicking a card opens a **modal** (same page, no navigation) showing:
  - Full description
  - Tech stack tags
  - External link (GitHub repo / live dashboard) as a real clickable link, opening in a new tab
  - Embedded video player or video link, if provided
- Modal closes via close button, click-outside, or Escape key.

### 5.4 Skills Section
- Three grouped lists: Technical, Tools & Platforms, Soft Skills — rendered from the database.

### 5.5 Contact Section
- Clickable links: email (`mailto:`), LinkedIn, GitHub.
- **Contact form**: name, email, message fields → sends Ankeeth an email on submission.
  - Requires an email-delivery provider (e.g. Resend or SendGrid) and an API key stored as a Vercel environment variable. **Open decision — see Section 10.**
  - Basic spam protection (honeypot field; optional rate limiting).
  - On submit: success/error confirmation shown inline; no page reload.

### 5.6 Chatbot Widget
- Persistent widget on the page (e.g. floating button that opens a chat panel, or a fixed panel in-page — final placement follows the matched design reference).
- Shows 4–6 clickable example questions on first open (e.g. "What are your strongest skills?", "Are you open to relocation?", "Tell me about a challenging project").
- Input supports both typing and voice (browser microphone via Web Speech API where supported; falls back gracefully to text-only in unsupported browsers, e.g. some versions of Firefox/Safari).
- Responses stream in token-by-token (typing effect) rather than appearing all at once.
- Conversation history persists only for the current page session (not saved server-side per visitor — no visitor accounts).

#### 5.6.1 Chatbot Behavior Rules (firm)
- Answers **only** from content stored in the database (which mirrors `profile.md`'s structure). Never invents facts, credentials, or commitments.
- Speaks in **first person as Ankeeth**, warm and professional tone, 2–4 short sentences per answer.
- Any mention of LinkedIn, GitHub, a project link, or email is rendered as a **real clickable link** (email as `mailto:`), never as plain text — this is enforced by the chatbot's response renderer, not just prompted for.
- **Tricky/negotiation questions** (salary, notice period, working for free, relocation):
  - If the FAQ/profile has an answer (e.g. "60 Days" for notice period, "No" for relocation), the bot answers **diplomatically and helpfully** using that real information — it does not deflect just because the topic is sensitive.
  - If the specific info isn't in the profile (e.g. exact salary expectations), the bot gives a warm, professional non-answer and invites the visitor to email Ankeeth directly (clickable `mailto:` link).
- **Off-topic or unknowable questions** (e.g. "What's the weather today?", overly personal questions unrelated to his professional background): bot politely declines and steers the conversation back to Ankeeth's professional background, inviting contact if relevant. This decline is the **last resort**, not the default.
- Never shares information that isn't in the profile data, never discusses private/sensitive info beyond what's explicitly in the profile, and never makes commitments (e.g. "Yes, I'll take that job") on Ankeeth's behalf.

---

## 6. Admin Page — Functional Requirements

- Route: `/admin` (not linked from public navigation; accessible only by direct URL).
- **Login**: password field only (single admin user — Ankeeth). Password checked against `ADMIN_PASSWORD` env var.
- On successful login, server issues a signed JWT (using `JWT_SECRET` env var) stored in an HTTP-only cookie. All admin API routes require a valid JWT.
- Session expires after a reasonable period (e.g. 24 hours) and requires re-login.
- **Editable content** (all stored in and read live from the database):
  - Personal Info (name, title, location, email, LinkedIn, GitHub, bio)
  - Experience entries (add / edit / delete / reorder)
  - Projects (add / edit / delete / reorder; fields include thumbnail image URL, video link, description, tech tags, external link)
  - Skills (technical, tools & platforms, soft skills — simple list editors)
  - FAQ (add / edit / delete Q&A pairs)
- Changes save directly to the database and take effect on the public site and chatbot **immediately** — no redeploy, no cache clearing required by the admin.
- Basic form validation (required fields, valid URL formats for links).
- No rich asset upload/hosting pipeline in v1 — image/video **URLs** are pasted in (e.g. hosted on a service like Cloudinary/Imgur, or Vercel's own static assets for now). Direct file upload from the admin page is a possible v2 enhancement — flagged in Section 10.

---

## 7. Technical Architecture

### 7.1 Stack
- **Frontend:** Plain HTML, CSS, and JavaScript (no framework), to keep it simple for a non-developer to maintain. Served as static files plus a small number of Vercel Serverless Functions for dynamic behavior.
- **Backend:** Vercel Serverless Functions (Node.js) under `/api/*` for:
  - `GET /api/content` — public read of current site content (personal info, experience, projects, skills) for rendering the page.
  - `POST /api/chat` — chatbot endpoint; takes visitor's question, retrieves current profile content from the database, calls the AI provider server-side, returns the answer.
  - `POST /api/contact` — handles contact form submissions, sends email via the chosen provider.
  - `POST /api/admin/login` — validates password, issues JWT cookie.
  - `GET/POST/PUT/DELETE /api/admin/*` — authenticated CRUD routes for experience, projects, skills, FAQ, personal info. All protected by JWT middleware.
- **Database:** Vercel Postgres. Connection string read from the `DATABASE_URL` environment variable that Vercel injects automatically.
- **AI Provider:** Groq (free-tier API) — accessed only from serverless functions via `GROQ_API_KEY`. Never exposed to the browser/client bundle.

### 7.2 Data Model (Postgres tables, high level)
- `personal_info` (single row): name, title, location, email, linkedin_url, github_url, bio, resume_url, photo_url
- `experience`: id, company, title, start_date, end_date, bullets (array/JSON), sort_order
- `projects`: id, name, description, tech_tags (array/JSON), thumbnail_url, video_url, external_link, sort_order
- `skills`: id, category (technical / tools / soft), value, sort_order
- `faq`: id, question, answer, sort_order

### 7.3 Seeding Logic
- On first request after deploy (or via a one-time setup script/endpoint), the app checks if `personal_info` table is empty.
- If empty, it parses `profile.md` (bundled in the repo) and inserts all sections into the corresponding tables.
- If not empty, seeding is skipped — the database is treated as the live source of truth from then on.
- `profile.md` is never re-read or re-synced after the initial seed (avoids overwriting admin edits).

### 7.4 Security
- `GROQ_API_KEY`, `ADMIN_PASSWORD`, `JWT_SECRET`, `DATABASE_URL` — all read from Vercel environment variables, never hardcoded, never sent to the client.
- Admin JWT stored in an HTTP-only, Secure cookie (not accessible to JavaScript, mitigating XSS token theft).
- All admin write routes verify JWT server-side before touching the database.
- Chatbot endpoint (`/api/chat`) rate-limited per IP to control cost/abuse (exact limits TBD in Section 10).

### 7.5 Chatbot Response Rendering
- The `/api/chat` response includes structured data (not just raw text) so the frontend can reliably render links as real `<a>` tags — e.g. the backend returns plain text with markdown-style links (`[GitHub](https://github.com/AnkeethV)`), and the frontend parses and renders these as clickable elements. This avoids relying on the AI model alone to "format" links correctly.
- Streaming: the backend streams the AI response chunk-by-chunk to the frontend (e.g. via a streamed HTTP response), and the frontend renders it token-by-token for the typing effect.

---

## 8. Design Requirements

Visual direction: modern, editorial, warm-minimal — explicitly **not** a generic template look. Based on the reference screenshots provided, the site should carry over the following system, adapted to Ankeeth's content (data/AI/engineering, not design services):

### 8.1 Typography
- **Headings:** a large-scale serif display font (reference uses an elegant serif similar to Playfair Display / a classic transitional serif) for section titles and hero headline — this is the signature "editorial" touch that keeps it from looking templated.
- **Body text:** a clean, neutral sans-serif for paragraphs, nav, buttons, and labels.
- Generous heading sizes (hero headline notably large) with tight letter spacing; body copy stays modest and readable.

### 8.2 Color Palette
- **Light theme (default):**
  - Background: warm off-white / cream (`#F4F3EF`-ish), not pure white.
  - Primary text: near-black.
  - Accent: warm golden-yellow (`#F2B705`-ish) used for primary CTA buttons and small accent blocks — this is the one "pop" color against an otherwise neutral palette.
  - Secondary surface: dark charcoal (`#2E2E2E`-ish) used for contrast sections (e.g. the stats/highlights bar and project cards), with off-white text on top.
- **Dark theme:** inverts the relationship — dark charcoal/near-black background site-wide, off-white text, the same golden-yellow accent color preserved (it reads well on both light and dark backgrounds so it stays the brand's signature color across themes).
- Both themes keep the same accent color and typography — only background/surface/text values swap.

### 8.3 Layout & Components
- **Hero:** two-column layout — headline + short bio + primary CTA button on the left, a large photo with heavily rounded corners on the right. This maps directly to Ankeeth's hero (photo, name, title, bio, "View Resume" button).
- **Pill-shaped buttons:** fully rounded (stadium-shape) buttons throughout — primary CTA in the accent yellow, secondary/nav CTAs in solid black/white depending on theme.
- **Highlights/stats bar:** a full-width dark contrast band with 3 short stat callouts, each inside a circular scalloped/seal-shaped badge with an icon above a bold short label and a smaller sublabel. For Ankeeth this section can surface quick-hit facts (e.g. years of experience, number of projects shipped, tools mastered) rather than design-agency stats.
- **Project cards ("Case Studies" pattern):** dark charcoal rounded-corner cards in a horizontal grid, each with a title, 2–3 line description, and a "View Project" text link. Adapted for Ankeeth: card also includes a thumbnail image (per his spec) and opens a modal on click rather than navigating away.
- **Decorative folded-corner accent:** a subtle diagonal "folded paper" triangle motif appears in the top-right corner of several full-width section breaks — a nice signature detail to reuse sparingly (e.g. at 1–2 section transitions) for visual continuity with the reference.
- **FAQ:** two-column layout — accordion list (question + "+" expand icon) on the left, a supporting image on the right. Used as-is for Ankeeth's FAQ section (works well since his FAQ already exists in profile data).
- **Contact/CTA band:** full-width split section, solid accent-yellow color block with heading + short line + pill button on one side, a photo on the other. Ankeeth's version: this band houses the "Get in Touch" contact form + social links (email, LinkedIn, GitHub) instead of a "Book Consultation" CTA.
- **Testimonials pattern:** not directly applicable (Ankeeth has no client testimonials in `profile.md` for v1) — skipped unless Ankeeth wants to add a "recommendations" section later using LinkedIn recommendations as a future enhancement.
- **Footer:** minimal, light gray/cream background, large serif wordmark (Ankeeth's name) on the left, contact details in the middle, small utility links on the right.

### 8.4 Chatbot Widget Styling
- Should visually match this system: rounded pill-style input field, accent-yellow send/mic button, cream/charcoal panel background matching the active theme, serif for any chatbot heading ("Ask me anything") and sans-serif for the conversation text.

### 8.5 General
- Both light and dark theme variants fully designed (not just inverted defaults) — see 8.2.
- Fully responsive: desktop, tablet, and mobile breakpoints. On mobile, the two-column sections (hero, FAQ, contact band) stack vertically.
- Rounded corners used consistently and generously across images, cards, buttons, and the chatbot panel — this is a core signature of the look.

---

## 9. Deployment

- Single Vercel project containing frontend, API routes, and admin page.
- Vercel Postgres provisioned and linked to the project (auto-injects `DATABASE_URL`).
- Environment variables configured in Vercel dashboard: `GROQ_API_KEY`, `ADMIN_PASSWORD`, `JWT_SECRET`.
- Public production URL (Vercel-provided domain, e.g. `ankeeth-portfolio.vercel.app`, or a custom domain if Ankeeth adds one later) is the link shared on LinkedIn.

---

## 10. Open Decisions / Needs Input

1. **Contact form email provider** — need to pick one (e.g. Resend, SendGrid, or Nodemailer + SMTP). Each requires its own API key as an env var. Recommendation: Resend (simple free tier, easy Vercel integration) — pending Ankeeth's confirmation.
2. **Real assets** — profile photo, resume PDF, project thumbnails, and project video links are all placeholders in v1 and will need to be swapped in by Ankeeth (via the admin page for most, or by replacing the static resume file for the PDF).
3. **Custom domain** — is `*.vercel.app` acceptable for the LinkedIn link, or does Ankeeth want a custom domain (e.g. `ankeethv.com`)? Affects DNS setup, not core build.
4. **Chatbot rate limiting** — exact request limits per visitor/IP to control Groq API usage and abuse; needs a reasonable default (e.g. 10 messages per session) unless Ankeeth has a preference.
5. **Image/video hosting for admin-added projects** — v1 assumes Ankeeth pastes in URLs to already-hosted images/videos. A future version could add direct upload (e.g. to Vercel Blob storage) if that's preferred.

---

## 11. Success Criteria

- Site is live on a public Vercel URL and loads correctly with no blank/broken states, even before any real assets are added (placeholders render cleanly).
- Chatbot answers a representative set of test questions (including sensitive ones like notice period and relocation) accurately, warmly, and with real clickable links where relevant.
- Chatbot declines only genuinely off-topic questions, and does so gracefully.
- Ankeeth can log into `/admin`, edit any content type, and see the change reflected on the public site and in chatbot answers without a redeploy.
- No secrets appear in browser dev tools, page source, or client-side JavaScript bundles.
- Theme toggle persists correctly across page reloads and browser sessions.
