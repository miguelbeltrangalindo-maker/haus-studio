import { useEffect, useState } from 'react'

const getNowMinutes = () => {
  const d = new Date()
  return d.getHours() * 60 + d.getMinutes()
}

export function useNowMinutes() {
  const [nowMinutes, setNowMinutes] = useState(getNowMinutes)

  useEffect(() => {
    const tick = () => setNowMinutes(getNowMinutes())
    const now = new Date()
    const msToNextMinute = (60 - now.getSeconds()) * 1000 - now.getMilliseconds()
    let intervalId
    const timeoutId = setTimeout(() => {
      tick()
      intervalId = setInterval(tick, 60_000)
    }, msToNextMinute)
    return () => {
      clearTimeout(timeoutId)
      if (intervalId) clearInterval(intervalId)
    }
  }, [])

  return nowMinutes
}
