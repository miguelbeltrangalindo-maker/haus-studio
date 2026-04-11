import { useState, useEffect } from 'react'

// Detects a real touch phone/tablet — never matches on Mac/PC browsers
// regardless of window size. (hover:none) + (pointer:coarse) = touch device.
const QUERY = '(hover: none) and (pointer: coarse)'

export function useIsMobile() {
  const [isMobile, setIsMobile] = useState(
    () => window.matchMedia(QUERY).matches
  )
  useEffect(() => {
    const mq = window.matchMedia(QUERY)
    const handler = (e) => setIsMobile(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])
  return isMobile
}
