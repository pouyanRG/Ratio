import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("profile migration safety", () => {
  it("creates the profiles table and permissions when the schema is missing", () => {
    const migrationPath = resolve(
      __dirname,
      "../supabase/migrations/0012_ensure_profiles_table.sql"
    );

    const migration = readFileSync(migrationPath, "utf8");

    expect(migration).toMatch(/create table if not exists public\.profiles/i);
    expect(migration).toMatch(/grant select on public\.profiles to anon, authenticated/i);
    expect(migration).toMatch(/grant insert, update on public\.profiles to authenticated/i);
  });
});
