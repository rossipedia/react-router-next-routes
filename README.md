> :robot: **Disclaimer**
> This package was built with OpenAI's GPT 5.6 Luna model.

# @rossipedia/react-router-next-routes

Next.js-inspired file-system routing for React Router framework mode.

## Install

```sh
pnpm add @rossipedia/react-router-next-routes
```

## Usage

```ts
// app/routes.ts
import type { RouteConfig } from '@react-router/dev/routes'
import nextRoutes from '@rossipedia/react-router-next-routes'

export default nextRoutes() satisfies RouteConfig
```

Optionally, you can specify a `rootDirectory` option to load routes from a folder other than the default `routes` folder (relative to your [app folder](https://reactrouter.com/api/framework-conventions/react-router.config.ts#appdirectory)):

```ts
// app/routes.ts
import type { RouteConfig } from '@react-router/dev/routes'
import nextRoutes from '@rossipedia/react-router-next-routes'

export default nextRoutes({ rootDirectory: 'pages' }) satisfies RouteConfig
```

## Convention

A route module is a `page.tsx` or `route.ts` file:

```text
app/routes/
├── page.tsx                         # /
├── about/page.tsx                   # /about
├── blog/layout.tsx                  # layout for /blog/*
├── blog/page.tsx                    # /blog
├── blog/[slug]/page.tsx             # /blog/:slug
├── docs/[[lang]]/page.tsx           # /docs/:lang?
├── files/[...path]/page.tsx         # /files/*
├── (marketing)/pricing/page.tsx     # /pricing (group omitted)
└── _components/Button.tsx           # ignored (private folder)
```

`layout.tsx` files become React Router layout routes; they must render an
`<Outlet />` for their children. Directories without a layout are flattened,
so a page module is never accidentally used as a layout. `page.tsx` takes
precedence as the readable page convention, while `route.ts` is an alias for
resource/page modules that do not render a component.

The generated module paths are relative to `app/routes.ts`, matching the
paths expected by React Router's compiler.

## Supported names

| File-system name            | React Router path/config                          |
| --------------------------- | ------------------------------------------------- |
| `page.tsx` / `route.ts`     | leaf route; directory root becomes an index route |
| `layout.tsx`                | pathless `layout()` route with children           |
| `[id]`                      | `:id`                                             |
| `[[id]]`                    | `:id?`                                            |
| `[...slug]` / `[[...slug]]` | `*` splat                                         |
| `(group)`                   | omitted from the URL                              |
| `_private` / `@slot`        | ignored                                           |
