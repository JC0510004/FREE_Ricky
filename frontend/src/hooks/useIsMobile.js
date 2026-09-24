import { useSyncExternalStore } from 'react'

const MOBILE_QUERY = '(max-width: 1023px)'

function subscribe(callback) {
  if (typeof window.matchMedia !== 'function') return () => {}
  const mql = window.matchMedia(MOBILE_QUERY)
  mql.addEventListener('change', callback)
  return () => mql.removeEventListener('change', callback)
}

function getSnapshot() {
  if (typeof window.matchMedia !== 'function') return false
  return window.matchMedia(MOBILE_QUERY).matches
}

function getServerSnapshot() {
  return false
}

export function useIsMobile() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}