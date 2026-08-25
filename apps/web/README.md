# Bamboo IconGen Web

Next.js App Router frontend and BFF for the Bamboo IconGen MVP.

## Routes

- `/` — marketing landing page.
- `/pricing` — Stripe credit-pack entry.
- `/auth/sign-in` — Supabase Auth entry.
- `/create` — generation request form.
- `/icons` and `/icons/[jobId]` — history and generation results.
- `/account` — user profile and credit summary.
- `/admin` — protected operations workspace.
- `/api/*` — BFF endpoints and webhook boundary.

## Getting Started

From the repository root:

```bash
npm install
npm run dev
```

Copy `.env.example` to `.env.local` before connecting Supabase or Stripe.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
