// round the time to the last 10 minutes
export const getTruncatedTime = () => {
  const currentTime = new Date()
  const d = new Date(currentTime)

  d.setMinutes(Math.floor(d.getMinutes() / 10) * 10)
  d.setSeconds(0)
  d.setMilliseconds(0)

  return d
}
