/**
 * Domain layer — pure business types and interfaces.
 *
 * Layering rule: this directory MUST NOT import from `@/lib/infrastructure/*`,
 * `@/lib/services/*`, `@/db/*`, or anything else outside the domain. Domain
 * types depend only on language primitives and other domain types.
 */

export type { Cache } from "@/lib/domain/cache/cache";
