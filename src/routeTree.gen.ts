/* eslint-disable */

// @ts-nocheck

// noinspection JSUnusedGlobalSymbols

// This file was automatically generated by TanStack Router.
// You should NOT make any changes in this file as it will be overwritten.
// Additionally, you should also exclude this file from your linter and/or formatter to prevent it from being checked or modified.

import { createFileRoute } from '@tanstack/react-router'

// Import Routes

import { Route as rootRoute } from './routes/__root'

// Create Virtual Routes

const EmployeeLazyImport = createFileRoute('/employee')()
const DetailsLazyImport = createFileRoute('/details')()
const BroadcastLazyImport = createFileRoute('/broadcast')()
const BotLazyImport = createFileRoute('/bot')()
const AboutLazyImport = createFileRoute('/about')()
const IndexLazyImport = createFileRoute('/')()

// Create/Update Routes

const EmployeeLazyRoute = EmployeeLazyImport.update({
  id: '/employee',
  path: '/employee',
  getParentRoute: () => rootRoute,
} as any).lazy(() => import('./routes/employee.lazy').then((d) => d.Route))

const DetailsLazyRoute = DetailsLazyImport.update({
  id: '/details',
  path: '/details',
  getParentRoute: () => rootRoute,
} as any).lazy(() => import('./routes/details.lazy').then((d) => d.Route))

const BroadcastLazyRoute = BroadcastLazyImport.update({
  id: '/broadcast',
  path: '/broadcast',
  getParentRoute: () => rootRoute,
} as any).lazy(() => import('./routes/broadcast.lazy').then((d) => d.Route))

const BotLazyRoute = BotLazyImport.update({
  id: '/bot',
  path: '/bot',
  getParentRoute: () => rootRoute,
} as any).lazy(() => import('./routes/bot.lazy').then((d) => d.Route))

const AboutLazyRoute = AboutLazyImport.update({
  id: '/about',
  path: '/about',
  getParentRoute: () => rootRoute,
} as any).lazy(() => import('./routes/about.lazy').then((d) => d.Route))

const IndexLazyRoute = IndexLazyImport.update({
  id: '/',
  path: '/',
  getParentRoute: () => rootRoute,
} as any).lazy(() => import('./routes/index.lazy').then((d) => d.Route))

// Populate the FileRoutesByPath interface

declare module '@tanstack/react-router' {
  interface FileRoutesByPath {
    '/': {
      id: '/'
      path: '/'
      fullPath: '/'
      preLoaderRoute: typeof IndexLazyImport
      parentRoute: typeof rootRoute
    }
    '/about': {
      id: '/about'
      path: '/about'
      fullPath: '/about'
      preLoaderRoute: typeof AboutLazyImport
      parentRoute: typeof rootRoute
    }
    '/bot': {
      id: '/bot'
      path: '/bot'
      fullPath: '/bot'
      preLoaderRoute: typeof BotLazyImport
      parentRoute: typeof rootRoute
    }
    '/broadcast': {
      id: '/broadcast'
      path: '/broadcast'
      fullPath: '/broadcast'
      preLoaderRoute: typeof BroadcastLazyImport
      parentRoute: typeof rootRoute
    }
    '/details': {
      id: '/details'
      path: '/details'
      fullPath: '/details'
      preLoaderRoute: typeof DetailsLazyImport
      parentRoute: typeof rootRoute
    }
    '/employee': {
      id: '/employee'
      path: '/employee'
      fullPath: '/employee'
      preLoaderRoute: typeof EmployeeLazyImport
      parentRoute: typeof rootRoute
    }
  }
}

// Create and export the route tree

export interface FileRoutesByFullPath {
  '/': typeof IndexLazyRoute
  '/about': typeof AboutLazyRoute
  '/bot': typeof BotLazyRoute
  '/broadcast': typeof BroadcastLazyRoute
  '/details': typeof DetailsLazyRoute
  '/employee': typeof EmployeeLazyRoute
}

export interface FileRoutesByTo {
  '/': typeof IndexLazyRoute
  '/about': typeof AboutLazyRoute
  '/bot': typeof BotLazyRoute
  '/broadcast': typeof BroadcastLazyRoute
  '/details': typeof DetailsLazyRoute
  '/employee': typeof EmployeeLazyRoute
}

export interface FileRoutesById {
  __root__: typeof rootRoute
  '/': typeof IndexLazyRoute
  '/about': typeof AboutLazyRoute
  '/bot': typeof BotLazyRoute
  '/broadcast': typeof BroadcastLazyRoute
  '/details': typeof DetailsLazyRoute
  '/employee': typeof EmployeeLazyRoute
}

export interface FileRouteTypes {
  fileRoutesByFullPath: FileRoutesByFullPath
  fullPaths: '/' | '/about' | '/bot' | '/broadcast' | '/details' | '/employee'
  fileRoutesByTo: FileRoutesByTo
  to: '/' | '/about' | '/bot' | '/broadcast' | '/details' | '/employee'
  id:
    | '__root__'
    | '/'
    | '/about'
    | '/bot'
    | '/broadcast'
    | '/details'
    | '/employee'
  fileRoutesById: FileRoutesById
}

export interface RootRouteChildren {
  IndexLazyRoute: typeof IndexLazyRoute
  AboutLazyRoute: typeof AboutLazyRoute
  BotLazyRoute: typeof BotLazyRoute
  BroadcastLazyRoute: typeof BroadcastLazyRoute
  DetailsLazyRoute: typeof DetailsLazyRoute
  EmployeeLazyRoute: typeof EmployeeLazyRoute
}

const rootRouteChildren: RootRouteChildren = {
  IndexLazyRoute: IndexLazyRoute,
  AboutLazyRoute: AboutLazyRoute,
  BotLazyRoute: BotLazyRoute,
  BroadcastLazyRoute: BroadcastLazyRoute,
  DetailsLazyRoute: DetailsLazyRoute,
  EmployeeLazyRoute: EmployeeLazyRoute,
}

export const routeTree = rootRoute
  ._addFileChildren(rootRouteChildren)
  ._addFileTypes<FileRouteTypes>()

/* ROUTE_MANIFEST_START
{
  "routes": {
    "__root__": {
      "filePath": "__root.tsx",
      "children": [
        "/",
        "/about",
        "/bot",
        "/broadcast",
        "/details",
        "/employee"
      ]
    },
    "/": {
      "filePath": "index.lazy.tsx"
    },
    "/about": {
      "filePath": "about.lazy.tsx"
    },
    "/bot": {
      "filePath": "bot.lazy.tsx"
    },
    "/broadcast": {
      "filePath": "broadcast.lazy.tsx"
    },
    "/details": {
      "filePath": "details.lazy.tsx"
    },
    "/employee": {
      "filePath": "employee.lazy.tsx"
    }
  }
}
ROUTE_MANIFEST_END */
