# Kasir Pro

Aplikasi kasir (POS) profesional berbasis web untuk toko retail Indonesia — dioptimalkan untuk tablet dan smartphone.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm --filter @workspace/kasir run dev` — run the frontend (port 22227)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite, TanStack Query, Wouter, Tailwind CSS, Shadcn UI
- API: Express 5 (artifact: api-server, path: /api)
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `lib/api-spec/openapi.yaml` — OpenAPI spec (source of truth for all API contracts)
- `lib/db/src/schema/` — DB schema (categories, products, customers, transactions)
- `artifacts/api-server/src/routes/` — Express route handlers
- `artifacts/kasir/src/` — React frontend
- `artifacts/kasir/src/pages/` — App pages (kasir, dashboard, products, customers, transactions)

## Architecture decisions

- Contract-first: OpenAPI spec → codegen → React Query hooks + Zod schemas
- Points system: 1 poin per Rp 10.000 pembelian, hanya member yang bisa redeem poin
- Tax defaults to 0% (dapat diubah di transactions.ts)
- Supabase for production: ganti DATABASE_URL ke Supabase PostgreSQL connection string saat deploy

## Product

- **Kasir** (`/`) — Layar POS utama: grid produk + keranjang, pilih pelanggan, metode pembayaran, diskon, poin
- **Dashboard** (`/dashboard`) — Statistik revenue, grafik harian, produk terlaris, transaksi terbaru
- **Produk** (`/products`) — CRUD produk dengan foto URL dan kategori
- **Pelanggan** (`/customers`) — CRUD pelanggan, membership member/non-member, saldo poin
- **Riwayat Transaksi** (`/transactions`) — Histori transaksi dengan filter tanggal & metode bayar
- **Detail Transaksi** (`/transactions/:id`) — Struk lengkap dengan rincian item

## User preferences

- Bahasa Indonesia untuk label UI
- Format harga: Rupiah (Rp X.XXX)
- Dioptimalkan untuk tablet dan smartphone

## Supabase Production Setup

Untuk menggunakan Supabase sebagai database production:
1. Buat project di [supabase.com](https://supabase.com)
2. Buka Settings > Database > Connection string (URI mode)
3. Salin connection string dan set sebagai `DATABASE_URL` di Secrets/environment production
4. Jalankan `pnpm --filter @workspace/db run push` untuk push schema ke Supabase

## Gotchas

- Selalu jalankan `pnpm --filter @workspace/api-spec run codegen` setelah mengubah openapi.yaml
- Jalankan `pnpm run typecheck:libs` setelah mengubah file di `lib/*`
- Harga produk disimpan sebagai `numeric` di DB, diformat ke `parseFloat()` di routes

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
