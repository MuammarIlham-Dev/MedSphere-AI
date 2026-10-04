/// <reference lib="webworker" />
declare var self: ServiceWorkerGlobalScope;

import { clientsClaim } from 'workbox-core';
import { precacheAndRoute, createHandlerBoundToURL } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';

void (self as any).skipWaiting();
clientsClaim();

precacheAndRoute(self.__WB_MANIFEST);

const handler = createHandlerBoundToURL('/offline.html');
const navigationRoute = new NavigationRoute(handler, {
  denylist: [/^\/api/, /^\/login/, /^\/app/, /^\/$/],
});
registerRoute(navigationRoute);

// Sensitive healthcare APIs are deliberately not cached and their mutations are never
// replayed automatically. Domain services must implement explicit offline commands with
// idempotency and server-side revalidation when offline workflows are introduced.
