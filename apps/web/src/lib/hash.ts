/* The hash is the whole router (App.tsx picks the screen, the community
   provider picks the view inside the shell). Both read it through this one
   subscription so there is a single place that knows how it's listened to. */

export function subscribeToHash(onChange: () => void) {
  window.addEventListener("hashchange", onChange)
  return () => window.removeEventListener("hashchange", onChange)
}

export const readHash = () => location.hash
