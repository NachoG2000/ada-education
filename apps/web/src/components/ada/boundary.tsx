/* Error boundary: the last line before a blank screen.

   In connected mode the ids come from another process, and the provider's
   lookups throw on one that doesn't resolve (lib/community.tsx). api.ts cleans
   what it can before it reaches the state; this catches whatever it couldn't
   foresee and keeps it inside one message or one panel instead of taking the
   whole app down. */

import { Component, type ErrorInfo, type ReactNode } from "react"

interface Props {
  /** what to draw instead of the children that broke */
  fallback: (error: Error, reset: () => void) => ReactNode
  children: ReactNode
}

export class ErrorBoundary extends Component<Props, { error: Error | null }> {
  state: { error: Error | null } = { error: null }

  static getDerivedStateFromError(error: unknown) {
    return { error: error instanceof Error ? error : new Error(String(error)) }
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    // Whoever is running the course sees this in the console: it always means
    // the data is inconsistent, not that the person did something wrong.
    console.error("ada: a piece of the screen broke and was isolated.", error, info.componentStack)
  }

  reset = () => this.setState({ error: null })

  render() {
    const { error } = this.state
    return error ? this.props.fallback(error, this.reset) : this.props.children
  }
}
