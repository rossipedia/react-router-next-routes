import { readdirSync } from "node:fs";
import { relative, resolve, sep } from "node:path";
import {
  getAppDirectory,
  index,
  layout,
  prefix,
  route,
  type RouteConfig,
} from "@react-router/dev/routes";

const DEFAULT_EXTENSIONS = [".tsx", ".ts", ".jsx", ".js", ".mts", ".cts", ".mjs", ".cjs"];
const SPECIAL_FILES = new Set(["page", "route", "layout"]);

export interface NextRoutesOptions {
  /** Directory containing route files, relative to the app directory. Defaults to `routes`. */
  rootDirectory?: string;
  /** File extensions to scan, including the leading dot. */
  extensions?: string[];
}

interface RouteFile {
  absolute: string;
  relative: string;
  kind: "page" | "layout";
}

interface Directory {
  name: string;
  path: string;
  page?: RouteFile;
  layout?: RouteFile;
  children: Map<string, Directory>;
}

type GeneratedRoute = ReturnType<typeof route>;

/**
 * Scan a Next.js-inspired routes directory and return a React Router
 * framework `RouteConfig` for use in `app/routes.ts`.
 *
 * This function is synchronous so it can be used directly from the
 * framework's route config: `export default nextRoutes()`.
 */
export function nextRoutes(options: NextRoutesOptions = {}): RouteConfig {
  const appDirectory = getAppDirectory();
  const routesDir = resolve(appDirectory, options.rootDirectory ?? "routes");
  const extensions = new Set(options.extensions ?? DEFAULT_EXTENSIONS);
  const root: Directory = { name: "", path: routesDir, children: new Map() };
  const files: RouteFile[] = [];

  collect(routesDir, routesDir, root, extensions, files);
  validate(files, root);

  const result = build(root, appDirectory);
  return result as RouteConfig;
}

function collect(
  directoryPath: string,
  rootPath: string,
  directory: Directory,
  extensions: Set<string>,
  files: RouteFile[],
): void {
  let entries;
  try {
    entries = readdirSync(directoryPath, { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
    throw error;
  }

  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (entry.name.startsWith(".") || entry.name.startsWith("+")) continue;
    const absolute = resolve(directoryPath, entry.name);

    if (entry.isDirectory()) {
      // `(marketing)` is a route group: it organizes files without changing the URL.
      // `_private` follows Next's private-folder convention and is not routable.
      if (entry.name.startsWith("_") || entry.name.startsWith("@")) continue;
      const child: Directory = {
        name: entry.name,
        path: absolute,
        children: new Map(),
      };
      directory.children.set(entry.name, child);
      collect(absolute, rootPath, child, extensions, files);
      continue;
    }

    if (!entry.isFile()) continue;
    const extension = entry.name.slice(entry.name.lastIndexOf("."));
    if (!extensions.has(extension)) continue;
    const basename = entry.name.slice(0, -extension.length);
    if (!SPECIAL_FILES.has(basename)) continue;

    const file: RouteFile = {
      absolute,
      relative: relative(rootPath, absolute).split(sep).join("/"),
      kind: basename === "layout" ? "layout" : "page",
    };
    files.push(file);
    if (file.kind === "layout") directory.layout = file;
    else directory.page = file;
  }
}

function build(directory: Directory, configDir: string): GeneratedRoute[] {
  const children: GeneratedRoute[] = [];

  if (directory.page) children.push(index(modulePath(directory.page, configDir)) as GeneratedRoute);

  for (const child of directory.children.values()) {
    const childRoutes = build(child, configDir);
    const segment = toPathSegment(child.name);
    if (!segment) {
      children.push(...childRoutes);
    } else if (child.layout) {
      children.push(
        ...prefix(segment, [layout(modulePath(child.layout, configDir), childRoutes)]),
      );
    } else {
      children.push(...prefix(segment, childRoutes));
    }
  }

  return directory.layout
    ? [layout(modulePath(directory.layout, configDir), children)]
    : children;
}

function modulePath(file: RouteFile, configDir: string): string {
  // Route config paths are resolved relative to app/routes.ts by default.
  const fromRoutesConfig = relative(configDir, file.absolute).split(sep).join("/");
  return `./${fromRoutesConfig}`;
}

function toPathSegment(segment: string): string {
  if (segment.startsWith("(") && segment.endsWith(")")) return "";
  if (segment === "index") return "";
  if (/^\[\.\.\..+\]$/.test(segment)) return "*";
  if (/^\[\[\.\.\..+\]\]$/.test(segment)) return "*";
  if (/^\[\[.+\]\]$/.test(segment)) return `:${segment.slice(2, -2)}?`;
  if (/^\[.+\]$/.test(segment)) return `:${segment.slice(1, -1)}`;
  return segment;
}

function validate(files: RouteFile[], root: Directory): void {
  const seen = new Map<string, string>();
  const visit = (directory: Directory, path: string) => {
    const routePath = path || "/";
    if (directory.page) add(routePath, directory.page);
    for (const child of directory.children.values()) {
      const segment = toPathSegment(child.name);
      visit(child, segment ? `${path}/${canonicalSegment(segment)}` : path);
    }
  };
  visit(root, "");

  function add(path: string, file: RouteFile) {
    const previous = seen.get(path);
    if (previous) {
      throw new Error(`Duplicate route pattern "${path}" in ${previous} and ${file.relative}`);
    }
    seen.set(path, file.relative);
  }

  // `files` is used here to make duplicate page/route files an explicit error.
  const byDirectory = new Map<string, RouteFile[]>();
  for (const file of files) {
    const key = file.absolute.slice(0, file.absolute.lastIndexOf(sep));
    const existing = byDirectory.get(key) ?? [];
    existing.push(file);
    byDirectory.set(key, existing);
  }
  for (const [directory, entries] of byDirectory) {
    if (entries.length > 1) {
      throw new Error(`Multiple route modules found in ${directory}`);
    }
  }
}

function canonicalSegment(segment: string): string {
  return segment.startsWith(":") ? ":param" : segment;
}

// blah
export default nextRoutes;
