<div align="center">
  <br/>

  <h1>PopularVote</h1>
  <p><strong>Anonymous live Q&amp;A, sorted by AI so the room gets one answer per question</strong></p>

  <p>
    <img alt="License AGPL-3.0" src="https://img.shields.io/badge/license-AGPL--3.0-4a4a4a?style=flat-square" />
    <img alt="Built with React, Flask and Supabase" src="https://img.shields.io/badge/built%20with-React%20%C2%B7%20Flask%20%C2%B7%20Supabase-4a4a4a?style=flat-square" />
    <img alt="Clustering by Google Gemini" src="https://img.shields.io/badge/clustering-Gemini-4a4a4a?style=flat-square" />
  </p>

  <p>
    <a href="#features">Features</a> ·
    <a href="#how-a-session-works">How it works</a> ·
    <a href="#getting-started">Getting started</a> ·
    <a href="#docker">Docker</a> ·
    <a href="#under-the-hood">Under the hood</a> ·
    <a href="#contributing">Contributing</a>
  </p>

  <p>Join with a code, ask anything, and let the host answer the whole room at once.</p>

  <!-- TODO when taken: examples/host-view.png, a host dashboard with clustered questions
  <img src="examples/host-view.png" alt="Host view with questions grouped into clusters" width="840" />
  -->
  <br/>
</div>

<table>
<tr>
<td align="center" valign="top" width="25%"><strong>No accounts</strong><br/>Participants join and ask without identifying themselves.</td>
<td align="center" valign="top" width="25%"><strong>Questions sort themselves</strong><br/>Gemini groups similar questions into clusters.</td>
<td align="center" valign="top" width="25%"><strong>Live</strong><br/>Upvotes and answers show up for everyone over WebSockets.</td>
<td align="center" valign="top" width="25%"><strong>Private if you want it</strong><br/>Optional end-to-end encryption per session.</td>
</tr>
</table>

## Features

### Ask without being known

Participants submit questions with no account and no identity attached. Scan a QR code or enter a session code and start typing. Everyone in the session can upvote the questions they want answered, so the popular ones rise.

### Clusters instead of duplicates

Ten people asking the same thing should not mean ten answers. Google Gemini groups similar submissions into clusters by topic, so the host answers each cluster once and everyone in it sees the reply.

<!-- TODO when taken: examples/clusters.png, a cluster with its grouped questions and a host answer
<p align="center"><img src="examples/clusters.png" width="720" alt="A cluster of similar questions with one host answer" /></p>
-->

### Host and curators

The session host answers clustered questions, and can promote curators who answer alongside them. Responses appear live for every participant.

### Notes and suggested answers

Hosts can upload their notes as a PDF. PopularVote reads them to seed suggested answers and a chat flow, so the host starts from a draft instead of a blank box.

> [!NOTE]
> Suggested answers are drafts for the host to review. Nothing is sent to participants on its own.

### Optional end-to-end encryption

A session can opt into per-session encryption. Submission content and clustering then happen in the browser, and the server only relays ciphertext it cannot read.

### Take it with you

When the session ends, download the results as a PDF summary.

## How a session works

| Step | Who | What happens |
|---|---|---|
| 1 | Host | Starts a session. Optionally uploads PDF notes and turns on encryption. |
| 2 | Participants | Join by QR code or session code. No account needed. |
| 3 | Participants | Submit questions and upvote the ones they care about. |
| 4 | Gemini | Groups similar questions into clusters. |
| 5 | Host or curators | Answer each cluster once. Everyone sees the answer live. |
| 6 | Host | Exports the session as a PDF. |

## Getting started

1. **Clone the repository.**
2. **Backend config.** Copy `src/backend/.env.example` to `src/backend/.env` and fill in your Supabase and Gemini credentials.
3. **Frontend config.** Copy `src/frontend/.env.example` to `src/frontend/.env` and fill in your Supabase and API URL values.
4. **Install.** Backend dependencies come from `src/backend/requirements.txt`. For the frontend, run `npm install` in `src/frontend`.
5. **Run.** Start the backend (`app.py`) and the frontend (`npm run dev`).

### Docker

A multi-stage `Dockerfile` builds the Vite frontend and serves it from the Flask backend in one container.

1. Fill in `src/backend/.env` as above.
2. Put `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in a `.env` at the repo root. Compose passes them to the frontend build.
3. Run `docker compose up --build` and open `http://localhost:6967`.

> [!IMPORTANT]
> Host port `6967` maps to container port `2167` because the CORS and Socket.IO allowlist in `src/backend/app.py` only permits `http://localhost:6967`. Keep the backend at one worker, since `SessionManager` holds session state in memory.

### Hosted deployment

The frontend deploys as a static build on Render's free tier, and the backend runs separately on Railway. Both are free or low tiers, so the first request after an idle period can be slow while the services wake up.

## Under the hood

<details>
<summary><strong>How it is built and where your data lives</strong></summary>

<br/>

| Part | What it is |
|---|---|
| Frontend | React 19 and Vite |
| Backend | Python and Flask, served with `gunicorn` in production |
| Real time | `Flask-SocketIO` (`eventlet`) on the server, `socket.io-client` in the browser |
| Database | PostgreSQL on Supabase |
| AI | Google Gemini through `google-genai` |
| Notes | `pypdf` extracts text from host PDFs |
| Export | `jspdf` builds the PDF summary |
| Joining | `qrcode` and `html5-qrcode` for QR sessions |
| Abuse control | `Flask-Limiter` rate limiting |

- **The database is the source of truth.** Sessions, submissions and clusters live in PostgreSQL via Supabase. The backend keeps an in-memory cache that is hydrated from the database and written through to it.
- **One worker, on purpose.** `SessionManager` holds live session state in memory, so the backend runs a single worker.
- **Encrypted sessions keep the server blind.** With encryption on, submission content and clustering happen client-side and the server relays opaque ciphertext.
- **It started on Node.** The backend was first built on Node.js and Express, then ported to Python and Flask to use one runtime for AI, PDF tooling and WebSockets. The full history and decision log are in `documents/design_documents/`.

<p align="center">
  <img src="documents/design_documents/diagrams/08-supabase-schema.png" alt="Supabase schema" width="720" />
</p>

Schema script and notes: `documents/design_documents/PostgreSQL Schema.sql` and `PostgreSQL Schema.md`.

</details>

## Contributing

Contributions are welcome. Read the contribution guide before getting started.

## License

Licensed under [AGPL-3.0](LICENSE). Legal documentation lives in `documents/legal/` and `documents/licenses/`.
