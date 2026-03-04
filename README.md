# MedExpiry - Medicine Expiry Tracker

A full-stack web application to track medicine expiry dates by extracting data from bills (PDFs/Excel files) uploaded manually or fetched from Gmail attachments.

## Features

- **Google Login** — Sign in with Google to access the app and Gmail
- **Upload Bills** — Upload PDF or Excel bill files to auto-extract medicine data
- **Fetch from Gmail** — Automatically find and process bill attachments from your email
- **Smart Parsing** — Extracts Medicine Name, Expiry Date, Batch No, Bill Date, and Distributor Name
- **Duplicate Prevention** — Tracks processed emails so the same attachment is never re-imported
- **Sort & Search** — Sort medicines by expiry date, name, or distributor; search across all fields
- **Delete & Manage** — Delete single or multiple medicine entries
- **Expiry Alerts** — Visual status indicators: Valid, Expiring Soon (90 days), Expired

## Tech Stack

| Component | Technology | Cost |
|-----------|------------|------|
| Frontend | React + Vite + TailwindCSS | Free |
| Backend | Node.js + Express | Free |
| Database | SQLite (file-based) | Free |
| Auth | Google OAuth 2.0 | Free |
| Email | Gmail API | Free |
| PDF Parsing | pdf-parse | Free |
| Excel Parsing | xlsx (SheetJS) | Free |

**Total cost: $0** — Everything runs locally with no paid services.

## Setup

### 1. Google Cloud Console Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or select an existing one)
3. **Enable APIs:**
   - Go to *APIs & Services > Library*
   - Enable **Gmail API**
4. **Create OAuth Credentials:**
   - Go to *APIs & Services > Credentials*
   - Click *Create Credentials > OAuth 2.0 Client ID*
   - Application type: **Web application**
   - Authorized JavaScript origins: `http://localhost:5173`
   - Authorized redirect URIs: `http://localhost:5000/api/auth/google/callback`
   - Copy the **Client ID** and **Client Secret**
5. **Configure OAuth Consent Screen:**
   - Go to *APIs & Services > OAuth consent screen*
   - Add scopes: `userinfo.email`, `userinfo.profile`, `gmail.readonly`
   - Add your email as a test user (while in Testing mode)

### 2. Environment Setup

```bash
cd server
cp .env.example .env
```

Edit `server/.env` and fill in your Google credentials:
```
GOOGLE_CLIENT_ID=your_actual_client_id
GOOGLE_CLIENT_SECRET=your_actual_client_secret
```

### 3. Install & Run

```bash
# Install server dependencies
cd server
npm install

# Install client dependencies
cd ../client
npm install

# Start the server (from server/)
cd ../server
npm run dev

# In another terminal, start the client (from client/)
cd client
npm run dev
```

Open **http://localhost:5173** in your browser.

## Project Structure

```
med-exp/
├── server/
│   ├── db/
│   │   └── database.js          # SQLite setup & schema
│   ├── middleware/
│   │   └── auth.js              # Auth middleware
│   ├── routes/
│   │   ├── auth.js              # Google OAuth routes
│   │   ├── medicines.js         # CRUD + upload routes
│   │   └── emails.js            # Gmail fetch routes
│   ├── services/
│   │   ├── googleAuth.js        # Google OAuth & Gmail API
│   │   └── billParser.js        # PDF/Excel parsing
│   ├── index.js                 # Express server entry
│   ├── package.json
│   └── .env.example
├── client/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Header.jsx
│   │   │   ├── UploadBill.jsx
│   │   │   ├── FetchEmails.jsx
│   │   │   ├── MedicineTable.jsx
│   │   │   ├── AddMedicineModal.jsx
│   │   │   └── Toast.jsx
│   │   ├── context/
│   │   │   └── AuthContext.jsx
│   │   ├── pages/
│   │   │   ├── LoginPage.jsx
│   │   │   ├── AuthCallback.jsx
│   │   │   └── Dashboard.jsx
│   │   ├── api.js               # API client
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── index.css
│   ├── index.html
│   ├── vite.config.js
│   ├── tailwind.config.js
│   └── package.json
├── .gitignore
└── README.md
```

## How Bill Parsing Works

### Excel Files
Column headers are matched against common patterns:
- **Medicine Name:** `medicine`, `drug`, `product`, `item`, `name`, `description`, `particulars`
- **Expiry Date:** `expiry`, `exp`, `expiration`
- **Batch No:** `batch`, `lot`, `b.no`
- **Bill Date:** `bill date`, `invoice date`, `date`
- **Distributor:** `distributor`, `supplier`, `vendor`, `party`

### PDF Files
Text is extracted and parsed using:
1. **Tabular detection** — Identifies header rows and parses columns
2. **Pattern matching** — Regex-based extraction of batch numbers, dates, etc.
3. **Context extraction** — Bill date and distributor from the first few lines

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/auth/google` | Get Google OAuth URL |
| GET | `/api/auth/google/callback` | OAuth callback handler |
| GET | `/api/auth/me` | Get current user |
| GET | `/api/medicines` | List medicines (supports `sort`, `order`, `search` params) |
| POST | `/api/medicines` | Add medicine manually |
| POST | `/api/medicines/upload` | Upload and parse a bill file |
| PUT | `/api/medicines/:id` | Update a medicine |
| DELETE | `/api/medicines/:id` | Delete a medicine |
| DELETE | `/api/medicines` | Bulk delete (body: `{ ids: [...] }`) |
| POST | `/api/emails/fetch` | Fetch and process Gmail attachments |
| GET | `/api/emails/status` | Get processed email count |

## Deploying for Free (Railway + GitHub Education)

Railway.app gives **$5/month free credits** with the GitHub Student Developer Pack — more than enough for a personal single-user app.

### Step 1: Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit"

# Create a repo on GitHub, then:
git remote add origin https://github.com/YOUR_USERNAME/med-exp.git
git branch -M main
git push -u origin main
```

> **WARNING:** Never commit your `.env` file. It's already in `.gitignore`. Double-check before pushing.

### Step 2: Claim Railway Credits (GitHub Education)

1. Go to [education.github.com/pack](https://education.github.com/pack)
2. Find **Railway** in the pack and click to activate
3. Sign up at [railway.app](https://railway.app) using your GitHub account
4. Your $5/month credit will be applied automatically

### Step 3: Deploy on Railway

1. Go to [railway.app/new](https://railway.app/new) → **Deploy from GitHub Repo**
2. Select your `med-exp` repository
3. Railway auto-detects the `Dockerfile` and `railway.toml`
4. **Add Environment Variables** in the Railway dashboard → Settings → Variables:
   ```
   GOOGLE_CLIENT_ID=your_google_client_id
   GOOGLE_CLIENT_SECRET=your_google_client_secret
   NODE_ENV=production
   ```
5. Railway will assign a URL like `https://med-exp-production-xxxx.up.railway.app`
6. Set these **additional env vars** (replace `YOUR_URL` with the Railway URL):
   ```
   GOOGLE_REDIRECT_URI=https://YOUR_URL/api/auth/google/callback
   CLIENT_URL=https://YOUR_URL
   ```

### Step 4: Update Google Cloud Console

1. Go to [Google Cloud Console → Credentials](https://console.cloud.google.com/apis/credentials)
2. Edit your OAuth 2.0 Client ID
3. Add to **Authorized JavaScript origins:**
   ```
   https://YOUR_RAILWAY_URL
   ```
4. Add to **Authorized redirect URIs:**
   ```
   https://YOUR_RAILWAY_URL/api/auth/google/callback
   ```
5. Save — changes take effect instantly

### Step 5: Add Persistent Volume (Keep SQLite Data)

1. In Railway dashboard, go to your service → **Settings**
2. Scroll to **Volumes** → **Mount Volume**
3. Mount path: `/data`
4. This ensures your SQLite database survives redeployments

### Done!

Your app is live at `https://YOUR_RAILWAY_URL`. Every push to `main` triggers auto-deployment.

### Alternative Free Hosting Options

| Platform | Free Tier | SQLite Persistence | Notes |
|----------|-----------|-------------------|-------|
| **Railway** | $5/mo credits (Student Pack) | Yes (volumes) | Best option |
| **Render** | Free web service | No (disk resets) | OK if you can tolerate data loss on redeploy |
| **Fly.io** | Free 3 shared VMs | Yes (volumes) | Requires `flyctl` CLI setup |
| **Azure** | $100 credit (Student Pack) | Yes | More complex setup |

