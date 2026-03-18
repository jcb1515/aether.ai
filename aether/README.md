# JaboGPT

AI chat app powered by Gemini 2.5 Flash. Built with Next.js 14.

## Deploy to Vercel (5 minutes)

### 1. Push to GitHub

Create a new repo on GitHub, then:

```bash
cd JaboGPT
git init
git add .
git commit -m "initial commit"
git remote add origin https://github.com/YOUR_USERNAME/JaboGPT.git
git push -u origin main
```

### 2. Deploy on Vercel

1. Go to https://vercel.com and sign in
2. Click "Add New Project"
3. Import your GitHub repo
4. Before clicking Deploy, go to "Environment Variables" and add:
   - Name: `GEMINI_API_KEY`
   - Value: your Gemini API key
5. Click Deploy

That is it. Your site will be live at `https://JaboGPT-xxx.vercel.app`.

### 3. Custom domain (optional)

In Vercel dashboard go to your project > Settings > Domains and add your domain.

---

## Rate limits (built in, per user IP)

| Endpoint | Limit |
|----------|-------|
| Chat     | 20 requests / minute |
| Chat     | 100 requests / hour  |
| Image    | 5 images / minute    |

Adjust these in `src/lib/rateLimit.ts` and `src/app/api/image/route.ts`.

---

## Local development

```bash
npm install
cp .env.example .env.local
# Edit .env.local and add your key
npm run dev
```

Open http://localhost:3000.

---

## Security notes

- The API key is stored only as a Vercel environment variable, server-side
- It is never sent to the client or exposed in any response
- All Gemini calls are proxied through `/api/chat` and `/api/image`
- `.env.local` is gitignored and will never be committed
