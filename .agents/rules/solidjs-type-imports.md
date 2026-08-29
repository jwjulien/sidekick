# Rule: Mandatory Type-Only Imports in TypeScript / SolidJS

When importing TypeScript types, interfaces, or type aliases from `solid-js` or custom local modules in `.ts` and `.tsx` files, you MUST ALWAYS use explicit type-only imports (`import type { ... }` or `import { type MyType, MyFunction } from "..."`).

## Background & Rationale
Vite / ESBuild transpiles TypeScript by stripping type annotations per-file without full type-checking graphs. If a type or interface (e.g., `JSX`, `ToastAction`, `ToastVariant`, `Accessor`) is imported as a standard value import (`import { ToastAction } from "./ToastNotification"`), the bundler leaves a runtime JavaScript import. At runtime in the browser, JavaScript modules do not export types, causing a fatal browser exception:

`Uncaught SyntaxError: The requested module '...' does not provide an export named 'Type'`

## Required Practice
1. **Always Use `type` Keyword for Types & Interfaces:**
   - **Correct**: `import type { JSX } from "solid-js";`
   - **Correct**: `import { ToastNotification, type ToastAction, type ToastVariant } from "./ToastNotification";`
   - **Incorrect**: `import { ToastNotification, ToastAction, ToastVariant } from "./ToastNotification";`
2. Applies universally to all SolidJS components, contexts, hooks, utilities, and models in `.tsx` and `.ts` files.
