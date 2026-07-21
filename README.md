# takanock-hub
# Takanock Assistant Hub

A web-based intake portal for Takanock employees to submit IT, GIS, and automation requests — and look up the status of their submissions. Built as a Next.js app deployed on Vercel, with an AI-powered conversational interface and Airtable as the backend.

**Live URL:** https://takanock-hub-v1.vercel.app

---

## What it does

Instead of Slacking someone directly, employees describe their issue through the hub and it routes their request to the right team automatically. Every submission is tracked so the employee and the request owner can see its status at any time.

The hub has three tabs:

- **Assistant** — a routing chatbot that identifies what kind of request the employee has, routes them to the right intake form, or tells them who to contact. It pulls from a live org chart in Airtable so contact information is always current.
- **Submit a Request** — conversational intake forms for IT Help Desk, GIS Requests, and Automation Ideas. Each form collects the relevant details through a chat conversation, shows a summary for confirmation, and submits directly to Airtable.
- **Check My Ticket** — employees enter their email to look up the status of their submitted requests, grouped by type (IT, GIS, Automation).

---

## Tech stack

| Layer | Technology |
|---|---|
| Framework | Next.js (Pages Router) |
| Hosting | Vercel |
| AI | Anthropic API (claude-sonnet-4-6) |
| Database | Airtable |
| Language | JavaScript (no TypeScript) |

---

## Project structure

```
takanock-hub/
├── pages/
│   ├── index.jsx              # Main page — assembles all components
│   ├── _app.js                # Imports global styles
│   ├── _document.js           # HTML document structure, Google Fonts
│   └── api/
│       └── proxy.js           # Server-side API handler (Anthropic + Airtable)
├── components/
│   ├── NavBar.jsx             # Top navigation tabs + Install App button
│   ├── ChatInterface.jsx      # Assistant tab (routing chatbot)
│   ├── ITChat.jsx             # IT Help Desk chat flow
│   ├── GISChat.jsx            # GIS Request chat flow
│   ├── AutomationChat.jsx     # Automation Idea chat flow
│   ├── LegalChat.jsx          # Legal Intake chat flow (dev branch, pending Adam Smith approval)
│   ├── TicketLookup.jsx       # Check My Ticket tab
│   └── RequestTypeSelect.jsx  # Custom styled dropdown for request type
├── lib/
│   └── chatHelpers.js         # Shared utilities (textarea resize, markdown stripping, reply parsing)
├── styles/
│   └── globals.css            # All styles — Takanock brand colors, chat UI, tables
└── public/
    ├── manifest.json          # PWA manifest (installable as desktop app)
    ├── takanock-logo.png      # Wordmark logo (navbar)
    ├── icon-192.png           # PWA icon
    └── icon-512.png           # PWA icon
```

---

## How the proxy works

All API calls go through `pages/api/proxy.js` — this keeps API keys server-side and never exposed to the browser.

The proxy handles three types of requests:

**`action: "chat"`** — sends a message to the Anthropic API. For the Assistant tab, it also fetches the full org chart from Airtable and injects it into the system prompt so the assistant always has current contact information.

**`action: "submit"`** — writes a new record to the appropriate Airtable table based on the `type` field (it, gis, automation, legal).

**`action: "lookup"`** — fetches ticket records from all three tables filtered by email address, used by the Check My Ticket tab.

---

## Airtable backend

All tables live in base `appvNDBoDDGFshd5J`.

| Table | Purpose | Env var |
|---|---|---|
| IT Requests | IT Help Desk submissions | `AIRTABLE_IT_TABLE` |
| GIS Requests | GIS Request submissions | `AIRTABLE_GIS_TABLE` |
| AI Automation intake | Automation Idea submissions | `AIRTABLE_AUTO_TABLE` |
| Legal Requests | Legal Intake submissions (dev only) | `AIRTABLE_LEGAL_TABLE` |
| Org Chart | Employee directory for contact lookups | Hardcoded in proxy |

The Org Chart table (`tblg3HtkMjh3qVq9S`) contains Name, Title, Department, and Email for all Takanock employees. When Stephanie adds a new hire, she should also add them here so the assistant's contact directory stays current.

---

## Environment variables

Set these in Vercel → Project Settings → Environment Variables. All should be scoped to **Production and Preview**.

| Variable | Description |
|---|---|
| `ANTHROPIC_API_KEY` | Anthropic API key |
| `AIRTABLE_API_KEY` | Airtable personal access token |
| `AIRTABLE_HUB_BASE` | Airtable base ID (`appvNDBoDDGFshd5J`) |
| `AIRTABLE_IT_TABLE` | IT Requests table ID |
| `AIRTABLE_GIS_TABLE` | GIS Requests table ID |
| `AIRTABLE_AUTO_TABLE` | AI Automation intake table ID |
| `AIRTABLE_LEGAL_TABLE` | Legal Requests table ID |

---

## Branches

| Branch | Purpose |
|---|---|
| `main` | Production — auto-deploys to Vercel |
| `dev` | Active development — deploys to Vercel preview |
| `nextjs-migration` | Legacy branch from the vanilla → Next.js migration |

All new work should happen on `dev`. Merge `dev → main` to deploy to production.

---

## PWA (Progressive Web App)

The hub is installable as a desktop app. Open it in Chrome and click "Install App" in the top right corner of the navbar. The app is powered by `next-pwa` with a service worker that caches assets for offline use. Updates deploy automatically — users don't need to reinstall.

---

## Branding

| Token | Value |
|---|---|
| Navy | `#0A2350` |
| Orange | `#FF5C35` |
| Cream | `#F7F5F0` |
| Font | Archivo (Google Fonts) |

---

## For developers

If you're picking this up for the first time and need to run it locally or make changes, here's what you need to know.

**Prerequisites:**
- Node.js 18 or higher
- A Vercel account (or you can run it locally without deploying)
- Access to the Takanock Airtable base
- An Anthropic API key

**Run locally:**
```bash
git clone https://github.com/mia-tursman/takanock-hub
cd takanock-hub
npm install
```

Create a `.env.local` file in the root with all the environment variables listed above, then:
```bash
npm run dev
```

Open http://localhost:3000.

**Deploy changes:**
```bash
git add .
git commit -m "your message"
git push origin dev
```

Vercel will automatically build a preview deployment from the `dev` branch. Check it at the Vercel dashboard. When you're happy with it, merge `dev` into `main` to deploy to production.

**If something breaks in production:**
Check Vercel → your project → Logs. The proxy logs Airtable errors and API failures. Most common issues are expired API keys or missing environment variables.

**To add a new intake form:**
1. Create a new component in `components/` following the pattern of `ITChat.jsx`
2. Add a new option to `RequestTypeSelect.jsx`
3. Add a new submit route in `pages/api/proxy.js`
4. Wire it into `pages/index.jsx`
5. Create the corresponding Airtable table and add its ID as an env var in Vercel

---

*Built by Mia Tursman, AI & Automation Intern, Summer 2026. Questions: ibenavides@takanock.com*
