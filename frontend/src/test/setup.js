import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// React 19 exige que el entorno de test declare soporte de act().
// Sin este flag, act() no garantiza el flush de updates y los tests pueden
// pasar por casualidad en vez de por determinismo. Además emite el warning
// "The current testing environment is not configured to support act(...)"
// a stderr, que ensucia el log de CI.
globalThis.IS_REACT_ACT_ENVIRONMENT = true

afterEach(() => {
  cleanup()
})

// Mock básico de IntersectionObserver para tests de landing page
// (usado por los animations de fade-up en App.jsx)
if (typeof globalThis.IntersectionObserver === 'undefined') {
  globalThis.IntersectionObserver = class {
    constructor() {}
    observe() {}
    unobserve() {}
    disconnect() {}
  }
}

// Mock de matchMedia (necesario para responsive/CSS media queries en jsdom)
if (typeof globalThis.matchMedia === 'undefined') {
  globalThis.matchMedia = () => ({
    matches: false,
    addListener() {},
    removeListener() {},
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent() { return false },
  })
}
