# Agent Instructions

<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->


## Product Specification
- **Source of Truth**: Read `docs/product-spec.md` before writing any code.
- **Rule**: Every feature built must strictly align with the requirements in the spec. Do not hallucinate fields or flows.

## Tech Stack
- Frontend: Next.js (App Router), Tailwind CSS
- Backend: Supabase
- Redis: Upstash Redis

## Build & Lint
- Build: `npm run build`
- Lint: `npm run lint`