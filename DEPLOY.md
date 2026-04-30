# Deployment Guide

## Architecture
- **Frontend**: Vercel (Next.js)
- **Backend**: Render (FastAPI)
- **Database + Auth**: Supabase (already configured)

---

## 1. Deploy Backend to Render

1. Go to [render.com](https://render.com) → Sign in with GitHub
2. Click **"New Web Service"**
3. Connect your `scrimba-mock` repository
4. Configure:
   - **Name**: `codestudio-backend`
   - **Root Directory**: `backend`
   - **Runtime**: Python
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
5. Add **Environment Variables**:
   ```
   DATABASE_URL = postgresql+asyncpg://postgres:yO3AUSrJhqMLpyT7@db.tphdrsbeqtpfmpyxovbn.supabase.co:5432/postgres
   SUPABASE_URL = https://tphdrsbeqtpfmpyxovbn.supabase.co
   SUPABASE_SERVICE_ROLE_KEY = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRwaGRyc2JlcXRwZm1weXhvdmJuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzUzNDMzMSwiZXhwIjoyMDkzMTEwMzMxfQ.MbGg9DJmXFPS_TZVVGfV3ntokmLw_nk2KO9jLya4-00
   CORS_ORIGINS = ["https://YOUR-APP.vercel.app"]
   UPLOAD_DIR = /tmp/uploads
   ```
6. Click **Deploy** → wait for build to complete
7. Note the URL (e.g., `https://codestudio-backend.onrender.com`)

---

## 2. Deploy Frontend to Vercel

1. Go to [vercel.com](https://vercel.com) → Sign in with GitHub
2. Click **"New Project"** → Import `scrimba-mock`
3. Configure:
   - **Root Directory**: `frontend`
   - **Framework Preset**: Next.js (auto-detected)
4. Add **Environment Variables**:
   ```
   NEXT_PUBLIC_SUPABASE_URL = https://tphdrsbeqtpfmpyxovbn.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRwaGRyc2JlcXRwZm1weXhvdmJuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc1MzQzMzEsImV4cCI6MjA5MzExMDMzMX0.Lx0PUbxjQ4ukOoJxSMgIrjf1oEtSZpUdWADZeXRE3KM
   NEXT_PUBLIC_API_URL = https://codestudio-backend.onrender.com
   ```
5. Click **Deploy**
6. Note the URL (e.g., `https://your-app.vercel.app`)

---

## 3. Post-Deployment Configuration

### Update CORS on Render
Go to your Render service → Environment → update `CORS_ORIGINS`:
```
["https://your-app.vercel.app"]
```

### Update Supabase Auth Redirect URLs
1. Supabase Dashboard → Authentication → URL Configuration
2. Add to **Redirect URLs**:
   ```
   https://your-app.vercel.app/auth/callback
   ```

### Update Google OAuth
1. [Google Cloud Console](https://console.cloud.google.com/apis/credentials) → Your OAuth client
2. Add to **Authorized redirect URIs**:
   ```
   https://tphdrsbeqtpfmpyxovbn.supabase.co/auth/v1/callback
   https://your-app.vercel.app/auth/callback
   ```
3. Add to **Authorized JavaScript origins**:
   ```
   https://your-app.vercel.app
   ```

---

## Local Development

```bash
./dev.sh
```
Or manually:
```bash
# Terminal 1
cd backend && source .venv/bin/activate && uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

# Terminal 2
cd frontend && npm run dev
```
