import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, resolve } from "node:path";
import { test } from "node:test";
import assert from "node:assert/strict";
import nextRoutes from "../src/index.js";

// `getAppDirectory()` reads this value when the React Router compiler loads
// `routes.ts`. The test runner is outside that compiler context.
(globalThis as { __reactRouterAppDirectory?: string }).__reactRouterAppDirectory =
  resolve("app");

function fixture(files: string[]) {
  const dir = mkdtempSync(join(tmpdir(), "next-routes-"));
  for (const file of files) {
    const path = join(dir, file);
    mkdirSync(join(path, ".."), { recursive: true });
    writeFileSync(path, "export default function Route() { return null; }");
  }
  return dir;
}

function optionsFor(dir: string) {
  return { rootDirectory: relative(resolve("app"), dir) };
}

test("generates pages, route groups, and layouts", () => {
  const dir = fixture([
    "page.tsx",
    "about/page.tsx",
    "blog/layout.tsx",
    "blog/[slug]/page.tsx",
    "(marketing)/pricing/page.tsx",
  ]);
  const routes = nextRoutes(optionsFor(dir));
  const serialized = JSON.stringify(routes);
  assert.match(serialized, /"index":true/);
  assert.match(serialized, /"path":"about"/);
  assert.match(serialized, /"path":"pricing"/);
  assert.match(serialized, /"path":"blog\/:slug"/);
  assert.match(serialized, /blog\/\[slug\]\/page\.tsx/);
  assert.match(serialized, /blog\/layout\.tsx/);
});

test("allows a page and layout in the same directory", () => {
  const dir = fixture(["layout.tsx", "page.tsx"]);
  const serialized = JSON.stringify(nextRoutes(optionsFor(dir)));

  assert.match(serialized, /layout\.tsx/);
  assert.match(serialized, /page\.tsx/);
  assert.match(serialized, /"index":true/);
});

test("does not duplicate nested layout route ids", () => {
  const dir = fixture([
    "admin/layout.tsx",
    "admin/page.tsx",
    "admin/users/page.tsx",
  ]);
  const routes = nextRoutes(optionsFor(dir));
  const serialized = JSON.stringify(routes);

  assert.match(serialized, /admin\/layout\.tsx/);
  assert.match(serialized, /admin\/page\.tsx/);
  assert.match(serialized, /admin\/users\/page\.tsx/);
  assert.equal(serialized.match(/admin\/layout\.tsx/g)?.length, 1);
});

test("maps dynamic, optional, and catch-all segments", () => {
  const dir = fixture([
    "users/[id]/page.tsx",
    "docs/[[lang]]/page.tsx",
    "files/[...path]/page.tsx",
  ]);
  const serialized = JSON.stringify(nextRoutes(optionsFor(dir)));

  assert.match(serialized, /"path":"users\/:id"/);
  assert.match(serialized, /"path":"docs\/:lang\?"/);
  assert.match(serialized, /"path":"files\/\*"/);
});

test("supports route.ts modules and ignores private or unsupported files", () => {
  const dir = fixture([
    "api/health/route.ts",
    "_components/Button.tsx",
    "@modal/page.tsx",
    "notes.md",
    "+types.ts",
  ]);
  const serialized = JSON.stringify(nextRoutes(optionsFor(dir)));

  assert.match(serialized, /api\/health\/route\.ts/);
  assert.doesNotMatch(serialized, /Button|modal|notes|types/);
});

test("supports custom extensions and app-relative root directories", () => {
  const dir = fixture(["page.mdx", "ignored.tsx"]);
  const serialized = JSON.stringify(
    nextRoutes({
      rootDirectory: relative(resolve("app"), dir),
      extensions: [".mdx"],
    }),
  );

  assert.match(serialized, /page\.mdx/);
  assert.doesNotMatch(serialized, /ignored\.tsx/);
});

test("returns an empty config for a missing routes directory", () => {
  const rootDirectory = join(
    "..",
    "tmp",
    "next-routes-does-not-exist",
    String(Date.now()),
  );
  assert.deepEqual(nextRoutes({ rootDirectory }), []);
});

test("rejects duplicate route patterns", () => {
  const rootDirectory = relative(resolve("app"), fixture(["[id]/page.tsx", "[slug]/page.tsx"]));
  assert.throws(() => nextRoutes({ rootDirectory }), /Duplicate route pattern/);
});

test("rejects multiple route modules in one directory", () => {
  const rootDirectory = relative(resolve("app"), fixture(["page.tsx", "route.ts"]));
  assert.throws(() => nextRoutes({ rootDirectory }), /Multiple page route modules/);
});
