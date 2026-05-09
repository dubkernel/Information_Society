# Convex schema notes

`schema.ts` is derived from `.dev/schema.ts` and keeps its core tables as the application data foundation: `users`, `people`, `organizations`, `memberships`, `connections`, `events`, `conversationSessions`, and `messages`.

Intentional MVP additions:

- `apiKeys` stores BYO provider key records with encrypted ciphertext fields and redacted metadata only.
- `providerPreferences` models BYO/app-provisioned/disabled inference modes for future provider switching.
- `interestSettings` stores each user's organizations, fields, industries, roles, and networking goals.
- `ingestionRecords` stores user-owned manual/mock LinkedIn, website, and scraped-data records with separate raw and cleaned payloads, status, errors, review decisions, and merge links.

All user-specific tables include `userId` indexes so Convex queries and mutations can scope reads/writes to the authenticated user's Convex `users` record.
