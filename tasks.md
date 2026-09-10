# Implementation Tasks: Portfolio Website + AI Chatbot

This document breaks down the full implementation of the Portfolio Website, AI Chatbot, and Admin Portal based on [`PRD_Portfolio_Website.md`](file:///d:/Data%20Analyst/CodeBasics/AI/PortfolioWebsite/PRD_Portfolio_Website.md) and [`profile.md`](file:///d:/Data%20Analyst/CodeBasics/AI/PortfolioWebsite/profile.md).

Tasks are structured into **10 sequential phases ordered strictly by dependency**. Each task is atomic, testable, and includes target files, dependencies, and clear acceptance criteria.

---

## Task Progress Overview

| Phase | Description | Status |
|---|---|---|
| **Phase 0** | Project Scaffolding, Tooling & Environment Configuration | `[x] Completed` |
| **Phase 1** | Database Architecture, Schema & Auto-Seeding Engine | `[x] Completed` |
| **Phase 2** | Core Public Backend APIs (Content & Contact Form) | `[x] Completed` |
| **Phase 3** | Admin Authentication & Protected CRUD APIs | `[x] Completed` |
| **Phase 4** | Groq AI Chatbot Backend Engine & Streaming Service | `[x] Completed` |
| **Phase 5** | Design System, Typography & Core Frontend Foundation | `[x] Completed` |
| **Phase 6** | Public Portfolio Frontend Sections & Interactive Modals | `[x] Completed` |
| **Phase 7** | Interactive Chatbot Widget & Voice Input Frontend | `[ ] Pending` |
| **Phase 8** | Private Admin Portal UI & Management Dashboard | `[ ] Pending` |
| **Phase 9** | End-to-End Verification, Security Audit & Acceptance Testing | `[ ] Pending` |
| **Phase 10**| Vercel Deployment, Domain & Production Sign-Off | `[ ] Pending` |

---

## Phase 0: Project Scaffolding, Tooling & Environment Configuration
> **Prerequisites:** None.  
> **Goal:** Establish repo structure, dependency manifest, Vercel routing configuration, placeholder assets, and environment templates.

- [x] **TASK-0.1: Initialize project manifest and install runtime dependencies**
  - **Dependencies:** None
  - **Target Files:** `package.json`
  - **Description:** Initialize Node.js project (`"type": "module"` or CommonJS conforming to Vercel Serverless Functions). Install dependencies: `@vercel/postgres` (or `pg`), `groq-sdk`, `jsonwebtoken`, `cookie`, `dotenv`, and `resend`. Add dev scripts for local running and seeding.
  - **Acceptance Criteria:** `package.json` and `package-lock.json` created; `npm install` runs cleanly without vulnerability or resolution errors.

- [x] **TASK-0.2: Configure Vercel serverless routing and headers**
  - **Dependencies:** `TASK-0.1`
  - **Target Files:** `vercel.json`
  - **Description:** Configure Vercel deployment routes and security headers. Route static assets from `/public`, ensure `/api/*` endpoints resolve to Node.js serverless functions, and map `/admin` directly to the admin interface (`/public/admin/index.html` or `/public/admin.html`).
  - **Acceptance Criteria:** `vercel.json` accurately routes `/api/(.*)` to API functions and rewrites `/admin` to the admin entry HTML file.

- [x] **TASK-0.3: Define environment configuration and git ignore rules**
  - **Dependencies:** `TASK-0.1`
  - **Target Files:** `.env.example`, `.gitignore`
  - **Description:** Create `.env.example` documenting all required variables: `DATABASE_URL`, `GROQ_API_KEY`, `ADMIN_PASSWORD`, `JWT_SECRET`, `RESEND_API_KEY`, and `SITE_URL`. Ensure `.gitignore` ignores `node_modules`, `.env`, `.env.local`, `.vercel`, and OS artifacts.
  - **Acceptance Criteria:** `.env.example` lists every key with comments; `.gitignore` blocks sensitive files from source control.

- [x] **TASK-0.4: Bundle static placeholder assets and resume PDF**
  - **Dependencies:** `TASK-0.1`
  - **Target Files:** `public/assets/*`, `public/resume.pdf`
  - **Description:** Add clean SVG/PNG placeholder assets in `public/assets/` (placeholder profile photo, project thumbnail placeholders, folded-corner decorative SVG, badge icons). Create a valid placeholder `public/resume.pdf` for Ankeeth V.
  - **Acceptance Criteria:** All assets load with 200 HTTP status; `/resume.pdf` can be opened directly in a browser tab.

---

## Phase 1: Database Architecture, Schema & Auto-Seeding Engine
> **Prerequisites:** Phase 0.  
> **Goal:** Define the Postgres relational schema, implement connection management, and build a self-seeding module that initializes the database from `profile.md` on first boot.

- [x] **TASK-1.1: Author Postgres DDL schema script**
  - **Dependencies:** `TASK-0.1`
  - **Target Files:** `api/_lib/schema.sql`
  - **Description:** Write SQL DDL statements creating all 5 relational tables:
    1. `personal_info` (`id` serial PK, `name`, `title`, `location`, `email`, `linkedin_url`, `github_url`, `bio`, `resume_url`, `photo_url`, `created_at`, `updated_at`)
    2. `experience` (`id` serial PK, `company`, `title`, `start_date`, `end_date`, `bullets` JSONB/text array, `sort_order` int)
    3. `projects` (`id` serial PK, `name`, `description`, `tech_tags` JSONB/text array, `thumbnail_url`, `video_url`, `external_link`, `sort_order` int)
    4. `skills` (`id` serial PK, `category` varchar(50) - 'technical'|'tools'|'soft', `value` text, `sort_order` int)
    5. `faq` (`id` serial PK, `question` text, `answer` text, `sort_order` int)
  - **Acceptance Criteria:** SQL schema executes idempotently with `CREATE TABLE IF NOT EXISTS` and includes appropriate primary keys, default timestamps, and foreign key/check constraints.

- [x] **TASK-1.2: Build database connection client wrapper**
  - **Dependencies:** `TASK-1.1`
  - **Target Files:** `api/_lib/db.js`
  - **Description:** Implement a reusable DB client supporting connection pooling (`@vercel/postgres` or `pg.Pool` utilizing `process.env.DATABASE_URL`). Provide standardized query helper methods with query parameterization to prevent SQL injection.
  - **Acceptance Criteria:** Helper exports `query(text, params)`; handles connection timeouts and exposes clear error logs without leaking connection credentials.

- [x] **TASK-1.3: Build Markdown parser for `profile.md`**
  - **Dependencies:** `TASK-0.1`
  - **Target Files:** `api/_lib/parseProfile.js`
  - **Description:** Implement a parser that reads `profile.md` and extracts structured JavaScript objects matching the DDL tables:
    - Personal Info: name, title, location, email, LinkedIn, GitHub, bio
    - Experience: list of company, title, date range, bullet points
    - Projects: list of name, description, tech stack tags, external links
    - Skills: grouped lists for Technical, Tools & Platforms, Soft Skills
    - FAQ: array of question & answer pairs
  - **Acceptance Criteria:** Unit execution parses `profile.md` cleanly; outputs complete JSON structure verified against all fields in `profile.md`.

- [x] **TASK-1.4: Implement auto-seeding engine and manual CLI seed script**
  - **Dependencies:** `TASK-1.2`, `TASK-1.3`
  - **Target Files:** `api/_lib/seed.js`, `scripts/seed.js`
  - **Description:** Create the seeding logic:
    1. Check if `personal_info` table has at least 1 record.
    2. If empty, create tables if they do not exist, parse `profile.md`, and execute transactional batch inserts for personal info, experiences, projects, skills, and FAQ.
    3. If populated, log "Database already seeded. Skipping." and exit without overwriting live records.
    4. Provide a standalone CLI runner `node scripts/seed.js` for local/CI test runs.
  - **Acceptance Criteria:** Running the seed script on an empty database populates all 5 tables; running it a second time makes zero changes and leaves existing rows intact.

---

## Phase 2: Core Public Backend APIs
> **Prerequisites:** Phase 1.  
> **Goal:** Expose public endpoints for retrieving site content and processing contact form submissions with spam protection.

- [x] **TASK-2.1: Implement `GET /api/content` serverless endpoint**
  - **Dependencies:** `TASK-1.2`, `TASK-1.4`
  - **Target Files:** `api/content.js`
  - **Description:** Create the serverless handler returning all public content in a single consolidated JSON payload:
    - `personal_info` (single object)
    - `experience` (array ordered by `sort_order ASC, id ASC`)
    - `projects` (array ordered by `sort_order ASC, id ASC`)
    - `skills` (object with keys `technical`, `tools`, `soft`, containing sorted lists)
    - `faq` (array ordered by `sort_order ASC, id ASC`)
    - Trigger `ensureSeeded()` before query if table is empty.
  - **Acceptance Criteria:** `GET /api/content` returns HTTP 200 with structured JSON matching the PRD data model; caches with `Cache-Control: s-maxage=60, stale-while-revalidate=300`.

- [x] **TASK-2.2: Implement `POST /api/contact` email delivery endpoint**
  - **Dependencies:** `TASK-0.3`
  - **Target Files:** `api/contact.js`
  - **Description:** Build the contact form handler:
    1. Validate required fields (`name`, `email`, `message`).
    2. Honeypot check: check hidden `_gotcha` / `website` field; if filled, return silent HTTP 200 to confound bots.
    3. Validate email format using RFC-compliant regex.
    4. Dispatch email to Ankeeth (`process.env.NOTIFICATION_EMAIL` or `personal_info.email`) via Resend API (`resend.emails.send`) with visitor's email set as `reply_to`.
    5. Return JSON `{ success: true, message: "Thank you! Your message has been sent." }`.
  - **Acceptance Criteria:** Valid submissions deliver an email and return HTTP 200 `{ success: true }`; invalid emails return HTTP 400 with descriptive errors; honeypot traps return 200 without sending email.

---

## Phase 3: Admin Authentication & Protected CRUD APIs
> **Prerequisites:** Phase 1.  
> **Goal:** Secure the `/admin` backend with HTTP-only JWT cookies and deliver complete CRUD operations for content management.

- [x] **TASK-3.1: Build JWT authentication & cookie verification middleware**
  - **Dependencies:** `TASK-0.1`
  - **Target Files:** `api/_lib/auth.js`
  - **Description:** Create helper utilities:
    - `generateToken(payload)`: signs JWT using `process.env.JWT_SECRET` with 24-hour expiration.
    - `serializeAuthCookie(token)`: generates `Set-Cookie` string with `HttpOnly`, `Secure` (in prod), `SameSite=Strict`, `Path=/`, and `Max-Age=86400`.
    - `clearAuthCookie()`: generates expired cookie header to log out.
    - `verifyAdmin(req)`: extracts cookie, verifies JWT against `JWT_SECRET`, throws/returns 401 if invalid or missing.
  - **Acceptance Criteria:** Valid JWT passes verification; expired, tampered, or missing tokens return HTTP 401 Unauthorized; cookie flags match security specs.

- [x] **TASK-3.2: Implement `POST /api/admin/login` & `POST /api/admin/logout`**
  - **Dependencies:** `TASK-3.1`
  - **Target Files:** `api/admin/login.js`, `api/admin/logout.js`, `api/admin/me.js`
  - **Description:**
    - `POST /api/admin/login`: Accepts `{ password }`. Compares with `process.env.ADMIN_PASSWORD`. On match, issues JWT cookie and returns `{ success: true }`. On mismatch, returns HTTP 401 `{ error: "Invalid password" }`.
    - `POST /api/admin/logout`: Clears the auth cookie.
    - `GET /api/admin/me`: Lightweight check returning `{ authenticated: true }` if cookie is valid; otherwise HTTP 401.
  - **Acceptance Criteria:** Correct password sets HTTP-only cookie; incorrect password fails; `/api/admin/me` confirms session validity.

- [x] **TASK-3.3: Implement `PUT /api/admin/personal-info` endpoint**
  - **Dependencies:** `TASK-1.2`, `TASK-3.1`
  - **Target Files:** `api/admin/personal-info.js`
  - **Description:** Protected route to update the single `personal_info` record. Accepts `name`, `title`, `location`, `email`, `linkedin_url`, `github_url`, `bio`, `resume_url`, `photo_url`. Validates URLs and emails. Updates `updated_at = NOW()`.
  - **Acceptance Criteria:** Authenticated PUT updates record and returns updated object; unauthenticated request returns HTTP 401.

- [x] **TASK-3.4: Implement Experience CRUD endpoints (`/api/admin/experience`)**
  - **Dependencies:** `TASK-1.2`, `TASK-3.1`
  - **Target Files:** `api/admin/experience.js`
  - **Description:** Support protected methods:
    - `GET`: List all experiences ordered by `sort_order ASC`.
    - `POST`: Create a new entry (company, title, start_date, end_date, bullets array, sort_order).
    - `PUT`: Update existing entry by `id`, including bulk sort reordering.
    - `DELETE`: Remove entry by `id`.
  - **Acceptance Criteria:** Complete CRUD lifecycle verified; bullets correctly serialized/deserialized as JSONB; unauthenticated requests rejected.

- [x] **TASK-3.5: Implement Projects CRUD endpoints (`/api/admin/projects`)**
  - **Dependencies:** `TASK-1.2`, `TASK-3.1`
  - **Target Files:** `api/admin/projects.js`
  - **Description:** Support protected methods:
    - `GET`: List all projects ordered by `sort_order ASC`.
    - `POST`: Create project (name, description, tech_tags array, thumbnail_url, video_url, external_link, sort_order).
    - `PUT`: Update project by `id` or update sort order.
    - `DELETE`: Remove project by `id`.
  - **Acceptance Criteria:** Projects can be added, updated, reordered, and deleted; URL fields validated; changes immediately visible in public content query.

- [x] **TASK-3.6: Implement Skills & FAQ CRUD endpoints (`/api/admin/skills`, `/api/admin/faq`)**
  - **Dependencies:** `TASK-1.2`, `TASK-3.1`
  - **Target Files:** `api/admin/skills.js`, `api/admin/faq.js`
  - **Description:**
    - `/api/admin/skills`: Protected endpoints to add skill, edit category/value, delete skill, or batch update categories/orders.
    - `/api/admin/faq`: Protected endpoints to add Q&A pair, edit question/answer, delete Q&A, and update sort order.
  - **Acceptance Criteria:** Skills and FAQs can be added, modified, deleted, and resequenced; strict validation prevents empty questions or values.

---

## Phase 4: Groq AI Chatbot Backend Engine
> **Prerequisites:** Phase 1, Phase 2.  
> **Goal:** Construct the server-side AI retrieval and streaming pipeline using Groq SDK, strictly grounded in live database content, enforcing first-person persona, diplomatic negotiation handling, and rate limiting.

- [x] **TASK-4.1: Implement system prompt builder & database grounding context**
  - **Dependencies:** `TASK-1.2`
  - **Target Files:** `api/_lib/promptBuilder.js`
  - **Description:** Build a module that fetches the latest profile, experience, projects, skills, and FAQ from the database and compiles a strict system prompt:
    - **Persona:** Ankeeth V, warm, confident, professional, speaking in the first person ("I", "my").
    - **Length:** 2–4 short, punchy sentences per response.
    - **Factual Grounding:** Answer ONLY from supplied context. Zero hallucinated credentials, facts, or commitments.
    - **Links Format:** Any mention of LinkedIn, GitHub, email, or projects MUST be formatted as Markdown links `[Anchor Text](url)` (`mailto:` for email).
    - **Sensitive Questions:**
      - Notice period: Answer directly with the FAQ value ("60 Days").
      - Relocation: Answer diplomatically with the FAQ value ("No, I am based in Bengaluru...").
      - Salary/compensation: State diplomatically that compensation depends on role scope and invite them to email directly via `[email](mailto:ankeeth.v@gmail.com)`.
    - **Off-topic Questions:** Gracefully decline non-professional/unrelated questions and redirect to Ankeeth's data & engineering experience.
  - **Acceptance Criteria:** Prompt builder injects dynamic DB content; includes all safety, formatting, and behavioral constraints.

- [x] **TASK-4.2: Implement IP-based rate limiting helper**
  - **Dependencies:** `TASK-0.1`
  - **Target Files:** `api/_lib/rateLimiter.js`
  - **Description:** Implement an in-memory sliding window or token-bucket rate limiter for the `/api/chat` endpoint. Restrict visitors to 15 requests per 10-minute window per IP (read from `x-forwarded-for` or `req.socket.remoteAddress`).
  - **Acceptance Criteria:** Requests exceeding limit receive HTTP 429 `{ error: "Too many requests. Please try again shortly or contact Ankeeth directly via email." }`.

- [x] **TASK-4.3: Implement `POST /api/chat` streaming serverless endpoint**
  - **Dependencies:** `TASK-4.1`, `TASK-4.2`
  - **Target Files:** `api/chat.js`
  - **Description:** Build the streaming chat endpoint:
    1. Check rate limit.
    2. Extract `{ message, history }` from request body.
    3. Assemble conversation array with current grounded system prompt, session history (up to last 6 messages), and user message.
    4. Call Groq API (`groq.chat.completions.create` with `model: "llama-3.3-70b-versatile"` or `llama-3.1-8b-instant`, `stream: true`).
    5. Stream response chunks directly to client using `Transfer-Encoding: chunked` / Server-Sent Events (`text/event-stream`).
    6. Catch errors and emit structured error payloads.
  - **Acceptance Criteria:** Endpoint streams tokens in real time; responds accurately to profile questions; enforces 2–4 sentence limit and markdown link output; rejects rate limit abusers.

---

## Phase 5: Design System, Typography & Core Frontend Foundation
> **Prerequisites:** Phase 0.  
> **Goal:** Create the visual design foundation based on PRD Section 8: editorial warm-minimal aesthetic, typography, custom color tokens, responsive utilities, and persistent light/dark theme switching.

- [x] **TASK-5.1: Build CSS variables & design tokens architecture**
  - **Dependencies:** `TASK-0.4`
  - **Target Files:** `public/css/variables.css`
  - **Description:** Define CSS custom properties for Light and Dark themes:
    - Fonts: `@import` Google Fonts for Serif display (Playfair Display) and neutral sans-serif (Inter or Plus Jakarta Sans).
    - Light Theme: Background `#F4F3EF` (warm off-white/cream), surface `#FFFFFF`, contrast surface `#2E2E2E` (dark charcoal), text primary `#1A1A1A`, text secondary `#5A5A5A`, accent `#F2B705` (warm golden-yellow), border `#E2E0D8`.
    - Dark Theme (`[data-theme="dark"]`): Background `#1A1A1A`, surface `#242424`, contrast surface `#2E2E2E`, text primary `#F4F3EF`, text secondary `#A0A0A0`, accent `#F2B705`, border `#383838`.
    - Radius tokens: pill `9999px`, card `16px` and `24px`, badge `12px`.
    - Shadows and smooth transition variables.
  - **Acceptance Criteria:** Switching `data-theme="dark"` on `<html>` smoothly swaps all color variables while keeping accent golden-yellow and typography intact.

- [x] **TASK-5.2: Implement base stylesheet, typography hierarchy & component utilities**
  - **Dependencies:** `TASK-5.1`
  - **Target Files:** `public/css/base.css`
  - **Description:** Reset default browser styles. Establish typography scale: massive editorial serif display headings (`clamp(2.5rem, 5vw, 4.5rem)` for hero), readable sans-serif body copy with optimal line height (1.6), stadium pill button classes (`.btn-primary`, `.btn-secondary`, `.btn-pill`), folded-corner accent class (`.folded-corner`), and responsive grid container utilities.
  - **Acceptance Criteria:** Typography hierarchy renders identically across Chrome, Firefox, Edge, and Safari; pill buttons and containers render consistently.

- [x] **TASK-5.3: Implement theme toggle controller & persistence**
  - **Dependencies:** `TASK-5.1`
  - **Target Files:** `public/js/theme.js`
  - **Description:** Implement theme initialization and toggling script:
    1. Read `localStorage.getItem('theme')`.
    2. Fall back to `window.matchMedia('(prefers-color-scheme: dark)')` if no stored key.
    3. Apply `data-theme` attribute to `document.documentElement`.
    4. Listen to toggle button clicks; update DOM, save choice in `localStorage`, and update ARIA attributes/icon on the toggle switch.
  - **Acceptance Criteria:** Theme persists across reloads; toggle button reflects active mode; default matches system OS preference on first visit.

- [x] **TASK-5.4: Scaffold semantic HTML layout skeleton & SEO meta tags**
  - **Dependencies:** `TASK-5.2`, `TASK-5.3`
  - **Target Files:** `public/index.html`
  - **Description:** Author semantic HTML5 index structure:
    - Head: Title tag "Ankeeth V — Senior Engineer & Data/AI Specialist", meta description, Open Graph/Twitter tags, viewport, favicon, font preconnects.
    - Navigation `<header>` with logo wordmark, anchor nav links, theme toggle button.
    - Main container sections: `<section id="hero">`, `<section id="highlights">`, `<section id="experience">`, `<section id="projects">`, `<section id="skills">`, `<section id="faq">`, `<section id="contact">`.
    - `<footer>` and persistent Chatbot container `<div id="chat-widget-root">`.
  - **Acceptance Criteria:** Valid HTML5 structure verified; SEO meta tags present; screen-reader accessible with skip-to-content link.

---

## Phase 6: Public Portfolio Frontend Sections & Interactive Modals
> **Prerequisites:** Phase 2, Phase 5.  
> **Goal:** Implement the responsive presentation layer, fetching live data from `/api/content`, rendering all sections, project details modal, and contact form submission.

- [x] **TASK-6.1: Build content client & live hydration module**
  - **Dependencies:** `TASK-2.1`, `TASK-5.4`
  - **Target Files:** `public/js/content.js`
  - **Description:** Create the frontend data client that fetches `GET /api/content`. Dispatches data to section-specific render functions. Handles loading states with subtle skeleton placeholders and graceful fallbacks if network is unavailable.
  - **Acceptance Criteria:** Page fetches live DB content and populates hero, stats, experience, projects, skills, and FAQ without UI flicker.

- [x] **TASK-6.2: Implement Navigation & Hero section styling and rendering**
  - **Dependencies:** `TASK-6.1`
  - **Target Files:** `public/css/sections/hero.css`, `public/js/content.js`
  - **Description:**
    - Navbar: Sticky glassmorphism header, serif wordmark "Ankeeth V", links to Experience, Projects, Skills, FAQ, Contact, and mobile toggle drawer.
    - Hero: 2-column layout. Left: Large serif headline, title tag, short bio from `personal_info.bio`, and pill "View Resume" button linking to `/resume.pdf` (`target="_blank"`). Right: Heavily rounded profile photo card with subtle drop shadow and decorative badge.
  - **Acceptance Criteria:** Two-column desktop layout collapses cleanly to single-column on mobile; resume button opens `/resume.pdf` in a new tab.

- [x] **TASK-6.3: Implement Highlights/Stats Contrast Band**
  - **Dependencies:** `TASK-5.2`, `TASK-6.2`
  - **Target Files:** `public/css/sections/highlights.css`
  - **Description:** Build full-width dark charcoal contrast band featuring 3 circular scalloped/seal-shaped badges with custom icons and typography:
    1. Experience: "5+ Years" (Infrastructure, Systems & Data).
    2. Impact: "85% Reduction" (Repeated issue resolution & process efficiency).
    3. Core Stack: "SQL • Power BI • AI" (Analytics & Assisted Engineering).
  - **Acceptance Criteria:** High contrast visual band breaks the page gracefully; scalloped badges scale responsively on mobile viewports.

- [x] **TASK-6.4: Implement Experience Section timeline**
  - **Dependencies:** `TASK-6.1`
  - **Target Files:** `public/css/sections/experience.css`, `public/js/content.js`
  - **Description:** Render experiences in reverse chronological order. Each entry displays company name, role/title, formatted date range (e.g. "May 2022 – Present"), and achievement bullet points with custom stylized bullet markers.
  - **Acceptance Criteria:** Renders all items from `experience` table; typography distinguishes company, role, and bullets; responsive card layout.

- [x] **TASK-6.5: Implement Projects Section grid & Interactive Detail Modal**
  - **Dependencies:** `TASK-6.1`
  - **Target Files:** `public/css/sections/projects.css`, `public/js/modal.js`
  - **Description:**
    - Project Card Grid: Dark charcoal rounded cards with thumbnail image, project title, one-line summary, and "View Details →" button.
    - Project Modal (`public/js/modal.js`): Opens on card click without route change. Displays project title, full description, tech stack tags (pill chips), clickable GitHub/Live Dashboard links (`target="_blank" rel="noopener noreferrer"`), and optional embedded video player or video link.
    - Modal UX: Close button (X), closes on backdrop click or `Escape` key press; traps focus while open; locks body scroll.
  - **Acceptance Criteria:** Cards render cleanly; modal displays complete project info; modal closes reliably via X button, Escape key, or outside click.

- [x] **TASK-6.6: Implement Skills Section grouped category layout**
  - **Dependencies:** `TASK-6.1`
  - **Target Files:** `public/css/sections/skills.css`, `public/js/content.js`
  - **Description:** Render three distinct styled panels for the skills categories:
    1. Technical (Data Analysis, Visualization, Dashboard Development, KPI Analysis, Generative AI, LLMs)
    2. Tools & Platforms (GitHub, Power BI, SQL, Advanced Excel, Windows environments)
    3. Soft Skills (Stakeholder Management, Problem Solving, Root-Cause Analysis, Communication)
    - Render skills as interactive pill tags with subtle hover states.
  - **Acceptance Criteria:** All three categories clearly demarcated; tags wrap gracefully on mobile; typography matches design specs.

- [x] **TASK-6.7: Implement FAQ Section accordion**
  - **Dependencies:** `TASK-6.1`
  - **Target Files:** `public/css/sections/faq.css`, `public/js/faq.js`
  - **Description:** Implement 2-column FAQ section: left column contains accordion items with question title and `+`/`-` expansion indicator; right column displays supporting graphic/card. Accordion supports click to toggle, accessible ARIA attributes (`aria-expanded`, `aria-controls`), and smooth height transitions.
  - **Acceptance Criteria:** Clicking question toggles answer visibility; multiple items can be inspected; keyboard accessible via Space/Enter.

- [x] **TASK-6.8: Implement Contact Section form & Footer**
  - **Dependencies:** `TASK-2.2`, `TASK-6.1`
  - **Target Files:** `public/css/sections/contact.css`, `public/js/contact.js`
  - **Description:**
    - Contact Band: Golden-yellow accent split band featuring "Let's Connect" heading, direct email (`mailto:`), LinkedIn link, GitHub link, and contact form.
    - Form: Name, email, message, and hidden honeypot field (`_gotcha`).
    - Form Submission: Client-side validation, asynchronous `POST /api/contact`, button loading state ("Sending..."), inline success/error message with zero page reload.
    - Footer: Minimal footer with large serif wordmark "Ankeeth V", copyright notice, back-to-top button.
  - **Acceptance Criteria:** Form validates inputs; sends AJAX request; displays inline confirmation; social links open correct external profiles.

---

## Phase 7: Interactive Chatbot Widget & Voice Input Frontend
> **Prerequisites:** Phase 4, Phase 5.  
> **Goal:** Build the persistent floating chatbot UI featuring sample starter prompts, token-by-token typing stream animation, markdown link rendering, and speech-to-text voice input.

- [x] **TASK-7.1: Build Chatbot Widget floating launcher & container UI**
  - **Dependencies:** `TASK-5.1`
  - **Target Files:** `public/css/chat.css`, `public/js/chat.js`
  - **Description:** Create floating chat launcher button in bottom-right corner with custom chat bubble icon and notification badge. Clicking button opens chat drawer/modal (matching active light/dark theme) with:
    - Chat header: Avatar, "Ask Ankeeth AI", status indicator ("Online"), minimize/close button.
    - Message history area with welcome message.
    - Input bar: Pill-shaped input field, microphone button for voice, and golden-yellow send button.
  - **Acceptance Criteria:** Launcher toggles chat panel with smooth transition; responsive on desktop and mobile screens; matches design theme.

- [x] **TASK-7.2: Render clickable starter questions & session management**
  - **Dependencies:** `TASK-7.1`
  - **Target Files:** `public/js/chat.js`
  - **Description:** On first launch, render 4–6 interactive question chips:
    - "What are your strongest skills?"
    - "Are you open to relocation?"
    - "What is your notice period?"
    - "Tell me about a challenging project you solved"
    - "What roles are you looking for?"
    - Clicking any chip sends it as an immediate user message. Keep session message history in browser memory (`sessionStorage`) for the active tab.
  - **Acceptance Criteria:** Clicking starter chips immediately submits question; message history stays intact across page navigation within same tab session.

- [x] **TASK-7.3: Implement streaming response reader & Markdown link parser**
  - **Dependencies:** `TASK-4.3`, `TASK-7.1`
  - **Target Files:** `public/js/chat.js`
  - **Description:**
    - Handle `POST /api/chat` streaming response using `ReadableStream` reader and `TextDecoder`.
    - Render incoming tokens progressively with a smooth typing cursor effect.
    - Safe Markdown parser: Parse `[Link Text](url)` in the accumulated text into real clickable `<a href="..." target="_blank" rel="noopener noreferrer">` tags. Parse `[email](mailto:...)` into functional mailto links.
    - Auto-scroll message container smoothly to bottom as tokens stream in.
  - **Acceptance Criteria:** Responses stream in token-by-token; links are rendered as active clickable tags; HTML tags in user input are safely escaped to prevent XSS.

- [x] **TASK-7.4: Implement Web Speech API voice input with graceful fallback**
  - **Dependencies:** `TASK-7.1`
  - **Target Files:** `public/js/chat.js`
  - **Description:** Integrate browser Web Speech API (`webkitSpeechRecognition` / `SpeechRecognition`):
    - Check browser support on initialization. If unsupported (e.g. older Firefox/Safari), hide or disable mic button gracefully.
    - When active, clicking mic starts audio listening, triggers pulsing mic animation and "Listening..." placeholder.
    - Transcribed text populates input field automatically and triggers send or permits editing before send.
    - Handle error states (mic permission denied, network error) with non-intrusive tooltip messages.
  - **Acceptance Criteria:** Supported browsers transcribe voice into message input; unsupported browsers degrade gracefully without JavaScript errors.

---

## Phase 8: Private Admin Portal UI & Management Dashboard
> **Prerequisites:** Phase 3, Phase 5.  
> **Goal:** Create the password-protected `/admin` interface allowing Ankeeth to manage all content without writing code or redeploying.

- [x] **TASK-8.1: Build Admin Login view & session interceptor**
  - **Dependencies:** `TASK-3.2`, `TASK-5.1`
  - **Target Files:** `public/admin/index.html`, `public/admin/admin.css`, `public/admin/admin.js`
  - **Description:**
    - Create clean, secure login screen at `/admin`: password field, submit button, error alert container.
    - On load, call `GET /api/admin/me`: if authenticated, automatically transition to dashboard view.
    - On submit, call `POST /api/admin/login`; on success, render dashboard; on error, display invalid credentials notice.
  - **Acceptance Criteria:** Unauthenticated users see login screen; valid password loads admin console; invalid password displays clear error.

- [x] **TASK-8.2: Build Admin Dashboard layout & navigation tabs**
  - **Dependencies:** `TASK-8.1`
  - **Target Files:** `public/admin/index.html`, `public/admin/admin.css`, `public/admin/admin.js`
  - **Description:** Build dashboard header with "Admin Console — Ankeeth V", "View Live Site" link, and "Log Out" button. Provide tabs for each content domain:
    1. Personal Info
    2. Experience
    3. Projects
    4. Skills
    5. FAQ
  - **Acceptance Criteria:** Tab switching switches panels without page reload; logout clears session and redirects to login view.

- [x] **TASK-8.3: Implement Personal Info editor panel**
  - **Dependencies:** `TASK-3.3`, `TASK-8.2`
  - **Target Files:** `public/admin/admin.js`
  - **Description:** Form fields for: Name, Title, Location, Email, LinkedIn URL, GitHub URL, Bio (textarea), Resume URL, and Photo URL. Populate with current values on tab load. On "Save Changes", dispatch `PUT /api/admin/personal-info` and display success toast notification.
  - **Acceptance Criteria:** Submitting updates database; errors highlighted inline; success feedback displayed; public site immediately shows updated bio/info.

- [x] **TASK-8.4: Implement Experience manager panel**
  - **Dependencies:** `TASK-3.4`, `TASK-8.2`
  - **Target Files:** `public/admin/admin.js`
  - **Description:**
    - List current experiences with Company, Title, Date range, and reorder up/down buttons.
    - "Add Experience" button opens modal/form to enter company, title, start date, end date, and dynamic bullet point inputs (add/remove bullet fields).
    - "Edit" button opens populated form.
    - "Delete" button prompts confirmation modal and calls `DELETE /api/admin/experience`.
  - **Acceptance Criteria:** Can add, edit, delete, and reorder experiences; changes persist in database and reflect in `GET /api/content`.

- [x] **TASK-8.5: Implement Projects manager panel**
  - **Dependencies:** `TASK-3.5`, `TASK-8.2`
  - **Target Files:** `public/admin/admin.js`
  - **Description:**
    - List current projects with thumbnail preview, title, tech tags, and external links.
    - Add/Edit form with inputs: Name, One-line summary, Full description, Tech tags (comma-separated or chip input), Thumbnail Image URL, Video Player/Demo URL, External GitHub/Dashboard URL.
    - Reorder buttons to change card display order.
    - Delete button with confirmation guard.
  - **Acceptance Criteria:** All project fields editable; image URL previews render; deleting or reordering updates live site immediately.

- [x] **TASK-8.6: Implement Skills & FAQ manager panels**
  - **Dependencies:** `TASK-3.6`, `TASK-8.2`
  - **Target Files:** `public/admin/admin.js`
  - **Description:**
    - Skills Tab: Grouped lists by Technical, Tools & Platforms, and Soft Skills. Allow inline adding of new skill chips, editing values, and single-click removal.
    - FAQ Tab: Accordion list of questions and answers. Add new Q&A pair form, inline edit modal, reorder controls, and delete confirmation.
  - **Acceptance Criteria:** Skills and FAQ entries can be modified in real time; changes immediately update both public website and Chatbot context.

---

## Phase 9: End-to-End Verification, Security Audit & Acceptance Testing
> **Prerequisites:** Phase 6, Phase 7, Phase 8.  
> **Goal:** Run comprehensive testing across public site, chatbot grounding, admin CRUD, responsive layouts, and verify all security requirements.

- [x] **TASK-9.1: Test database auto-seeding & live-sync persistence**
  - **Dependencies:** `TASK-1.4`, `TASK-8.3`
  - **Target Files:** `scripts/verify-seed.js`
  - **Description:**
    - Test initial deploy behavior: empty database parses `profile.md` and seeds 100% of data.
    - Test second boot: verify seeding does not execute again.
    - Test live-sync: edit content in `/admin`, verify public `/api/content` and `/api/chat` reflect changes immediately without requiring server restart or redeploy.
  - **Acceptance Criteria:** Seeding happens exactly once; admin edits are permanent and never overwritten by `profile.md`.

- [x] **TASK-9.2: Chatbot response grounding & test question matrix verification**
  - **Dependencies:** `TASK-4.3`, `TASK-7.3`
  - **Target Files:** `tests/chatbot-eval.json`
  - **Description:** Run structured test prompts through `/api/chat` and evaluate compliance against PRD Section 5.6.1:
    1. *Notice Period:* Must answer "60 Days" diplomatically.
    2. *Relocation:* Must answer "No" politely.
    3. *Salary:* Must deflect politely and offer `mailto:ankeeth.v@gmail.com` link.
    4. *Skills & Experience:* Answers must cite exact Kaseya / DXC / Practo metrics from DB.
    5. *Hallucination Guard:* "What university did you attend?" or "Are you open to working for free?" must not fabricate facts.
    6. *Off-topic Guard:* "What's the weather in Tokyo?" must politely decline and redirect to Ankeeth's profile.
    7. *Links:* All links must be valid clickable anchor tags.
  - **Acceptance Criteria:** 100% of test prompts pass grounding, persona, length (2–4 sentences), and link format criteria.

- [x] **TASK-9.3: Responsive layout & accessibility cross-device testing**
  - **Dependencies:** `TASK-6.2`, `TASK-6.5`, `TASK-7.1`
  - **Target Files:** `public/css/*`
  - **Description:** Verify user experience across desktop (1440px+), laptop (1024px), tablet (768px), and mobile (375px):
    - Hero, FAQ, and Contact two-column layouts stack into single-column on mobile.
    - Project modal operates smoothly on touchscreens.
    - Chatbot floating widget does not obstruct critical CTA buttons.
    - Color contrast complies with WCAG AA standards in both Light and Dark themes.
    - Keyboard navigation (Tab, Enter, Escape) functions across modals and accordion.
  - **Acceptance Criteria:** Zero layout overflow; touch targets > 44px; WCAG AA contrast ratio achieved across both themes.

- [x] **TASK-9.4: Security audit & secret leak verification**
  - **Dependencies:** `TASK-3.1`, `TASK-4.2`
  - **Target Files:** `public/**/*`, `api/**/*`
  - **Description:**
    - Inspect browser bundle and dev tools: confirm `GROQ_API_KEY`, `ADMIN_PASSWORD`, `JWT_SECRET`, and `DATABASE_URL` are strictly absent from client-side code.
    - Verify admin cookie has `HttpOnly; SameSite=Strict`.
    - Verify unauthenticated write attempts to `/api/admin/*` fail with HTTP 401.
    - Verify rate limiting stops chatbot spamming after 15 requests per IP.
    - Verify contact form honeypot blocks automated submissions.
  - **Acceptance Criteria:** Security checklist 100% verified; zero credentials exposed to browser.

---

## Phase 10: Vercel Deployment, Domain & Production Sign-Off
> **Prerequisites:** Phase 9.  
> **Goal:** Deploy to Vercel with managed Postgres storage, configure production environment variables, and verify live performance.

- [ ] **TASK-10.1: Provision Vercel Postgres database and link project**
  - **Dependencies:** `TASK-0.2`
  - **Target Files:** Vercel Dashboard / Project Settings
  - **Description:** Provision a Vercel Postgres instance. Link it to the portfolio project so `DATABASE_URL` / `POSTGRES_URL` is automatically bound to serverless functions.
  - **Acceptance Criteria:** Production database responds to health check query from serverless function.

- [ ] **TASK-10.2: Configure production environment variables in Vercel**
  - **Dependencies:** `TASK-0.3`, `TASK-10.1`
  - **Target Files:** Vercel Dashboard
  - **Description:** Set production variables:
    - `GROQ_API_KEY`: Groq API key for chatbot inference.
    - `ADMIN_PASSWORD`: Strong password chosen for Ankeeth's admin login.
    - `JWT_SECRET`: High-entropy secret for JWT signing.
    - `RESEND_API_KEY`: API key for email delivery.
    - `NOTIFICATION_EMAIL`: `ankeeth.v@gmail.com`.
  - **Acceptance Criteria:** All variables configured for Production and Preview environments; no missing variable warnings in Vercel logs.

- [ ] **TASK-10.3: Deploy production bundle and run live smoke tests**
  - **Dependencies:** `TASK-10.1`, `TASK-10.2`
  - **Target Files:** Production URL
  - **Description:** Execute production deployment (`vercel --prod` or git push to main branch). Run live verification:
    1. Visit public URL: confirm auto-seeding runs and site displays full content.
    2. Toggle light/dark theme: verify persistence.
    3. Click "View Resume": verify placeholder PDF opens in new tab.
    4. Open project modal: verify details, tags, and links.
    5. Test contact form: submit message and verify receipt in Ankeeth's inbox.
    6. Test chatbot: submit sample and tricky questions; verify streaming answers and links.
    7. Log into `/admin`: update a test field, verify live update on public site.
  - **Acceptance Criteria:** All PRD Section 11 Success Criteria met on live production URL without errors.
