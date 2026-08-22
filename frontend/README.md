# CineSync Frontend

Next.js 15 App Router app for the CineSync movie streaming platform.

## Development

```bash
pnpm install
cp .env.example .env.local   # fill in MOVIE_PROVIDER_BASE_URL
pnpm dev
```

## Deploy to Vercel

1. Import the repository into Vercel.
2. Set **Root Directory** to `frontend`.
3. Configure environment variables (Project → Settings → Environment Variables):

| Variable | Required | Description |
| --- | --- | --- |
| `MOVIE_PROVIDER_BASE_URL` | yes | Primary movie data provider API base URL (server-side only, never exposed to the client) |
| `MOVIE_PROVIDER_FALLBACK_URL` | no | Backup provider used when the primary fails |
| `NEXT_PUBLIC_API_URL` | no | Backend REST base URL (`/api/v1`) — leave empty until the NestJS backend ships |
| `NEXT_PUBLIC_WS_URL` | no | Backend WebSocket origin for watch-party |

4. Deploy. ISR-cached routes are served from the Vercel edge CDN automatically.

### Notes

- The movie provider base URLs are server-only: they are read exclusively in
  Server Components / Route Handlers and never reach the client bundle.
- The fallback provider may be geo-blocked when functions run in US/EU regions;
  requests failing there degrade gracefully back to the primary provider.
- Node.js 22 LTS is required (`engines` field is set).
