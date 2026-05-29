---
"@repo/web": patch
---

Prisma → Drizzle ORM 完全移行（einja-ai-base スタック準拠）。`@prisma/client` を撤去し、`drizzle-orm` + `drizzle-kit` + `@neondatabase/serverless` ベースに切替。NextAuth CredentialsProvider と signup route を `userRepository` 経由に統一。テンプレートリポジトリ原本の steering / Skill / docs / examples / instructions も drizzle 化済み。
