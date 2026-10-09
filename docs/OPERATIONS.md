# PIAT 6 Finance & Accounting — Operations

## Runtime

- Frontend: Vite + React + TypeScript
- Backend/database: Convex with the domain schema in `convex/schema.ts`
- Authentication: Convex Auth password provider; passwords are hashed with Scrypt
- Files: Convex File Storage for transaction evidence (PDF, images, XLSX, CSV)
- Currency: IDR, stored as numeric values and rounded to two decimals

## First login

1. Open `/auth`.
2. Choose **Daftar pengguna** for the first user.
3. The first user receives `SUPER_ADMIN`; later users default to `BENDAHARA`.
4. The Super Admin is prompted to initialize the PIAT 6 baseline.
5. Create the role-specific users from **Pengguna & Akses** after they register.

Do not put a shared password in this repository. Each operational user should have an individual account.

## Excel migration

`1. LK PIAT6_0626_Konsol.xlsx` remains the source/reference workbook.

1. **Data → Import Excel**.
2. Select the workbook and mode `COA`.
3. Review the preview and error count.
4. Click **Validasi**.
5. Click **Confirm import**.
6. Import the approved opening-balance/journal batch before go-live.
7. Open **Rekonsiliasi Excel** and resolve every difference.

The import flow is preview-first and idempotent for COA rows. Historical journals are posted through the same double-entry engine as new transactions.

## Backup

- Use Convex Dashboard export/snapshot for the database and File Storage evidence.
- Store exports in an access-controlled, versioned location with at least daily database backups and longer retention for audit evidence.
- Keep the original workbook unchanged under `data/`.
- Test a restore quarterly and record the restore result in the operations log.

## Deployment prerequisite

The static hosting build is configured as `bun run build`. A production deployment also needs a real Convex cloud deployment URL. The local Convex deployment created by the CLI is only for local development and must not be used as the public API URL. Set `VITE_CONVEX_URL` through the production environment after deploying the Convex functions.

## PIAT 6 Super App integration

The ledger remains the single source of truth. Other modules call the integration event intake with:

- `sourceSystem`
- `eventType`
- `sourceId`
- `idempotencyKey`
- `payload`

The event is stored before processing, then linked to the resulting `transactions` record after the accounting engine posts the journal. This keeps HRD, Madrasah, Wallet, 6Mart, and future Super App modules from creating a second ledger.
