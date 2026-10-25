import { useState, useEffect } from 'react'

/* ---------- small helpers ---------- */

const read = (key, fallback) => {
  try {
    const value = localStorage.getItem(key)
    return value ? JSON.parse(value) : fallback
  } catch {
    return fallback
  }
}

const write = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // storage not available, ignore
  }
}

// Turns Open-Meteo weather codes into a label and an icon
const getWeather = (code, isDay = 1) => {
  if (code === 0) return { label: isDay ? 'Clear sky' : 'Clear night', icon: isDay ? '☀️' : '🌙' }
  if (code === 1) return { label: 'Mainly clear', icon: isDay ? '🌤️' : '🌙' }
  if (code === 2) return { label: 'Partly cloudy', icon: '⛅' }
  if (code === 3) return { label: 'Overcast', icon: '☁️' }
  if (code === 45 || code === 48) return { label: 'Fog', icon: '🌫️' }
  if (code >= 51 && code <= 57) return { label: 'Drizzle', icon: '🌦️' }
  if (code >= 61 && code <= 67) return { label: 'Rain', icon: '🌧️' }
  if (code >= 71 && code <= 77) return { label: 'Snow', icon: '❄️' }
  if (code >= 80 && code <= 82) return { label: 'Rain showers', icon: '🌧️' }
  if (code === 85 || code === 86) return { label: 'Snow showers', icon: '🌨️' }
  if (code >= 95) return { label: 'Thunderstorm', icon: '⛈️' }
  return { label: 'Unknown', icon: '🌡️' }
}

// Page background changes with the weather and with day / night
const getTheme = (code, isDay) => {
  if (!isDay) return 'linear-gradient(160deg, #0f172a, #312e81)'
  if (code <= 1) return 'linear-gradient(160deg, #38bdf8, #2563eb)'
  if (code <= 3) return 'linear-gradient(160deg, #64748b, #38bdf8)'
  if (code <= 48) return 'linear-gradient(160deg, #94a3b8, #64748b)'
  if (code <= 86) return 'linear-gradient(160deg, #475569, #1e293b)'
  return 'linear-gradient(160deg, #1e293b, #4c1d95)'
}

const toF = (c) => (c * 9) / 5 + 32
const toMph = (kmh) => kmh / 1.609
const compass = (deg) =>
  ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round(deg / 45) % 8]

// "2026-10-24T06:20" -> "6:20 AM"
const fmtTime = (iso) => {
  const [h, m] = iso.slice(11, 16).split(':').map(Number)
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`
}

// "2026-10-24T19:00" -> "7 PM"
const fmtHour = (iso) => {
  const h = Number(iso.slice(11, 13))
  return `${((h + 11) % 12) + 1} ${h >= 12 ? 'PM' : 'AM'}`
}

const dayName = (dateStr, index) =>
  index === 0
    ? 'Today'
    : new Date(`${dateStr}T00:00:00`).toLocaleDateString('en-US', { weekday: 'short' })

const glass = 'bg-white/15 backdrop-blur-md border border-white/20 rounded-3xl shadow-lg'

function Stat({ icon, label, value }) {
  return (
    <div className={`${glass} p-4`}>
      <p className="text-xs uppercase tracking-wide text-white/70">
        {icon} {label}
      </p>
      <p className="mt-1 text-xl font-semibold">{value}</p>
    </div>
  )
}

const DEFAULT_PLACE = {
  name: 'Mumbai',
  admin: 'Maharashtra',
  country: 'India',
  latitude: 19.076,
  longitude: 72.8777,
}

/* ---------- main component ---------- */

function App() {
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [place, setPlace] = useState(null)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [unit, setUnit] = useState(() => read('weather-unit', 'C'))
  const [recent, setRecent] = useState(() => read('weather-recent', []))

  // Get the weather for a place
  const loadWeather = async (p) => {
    setLoading(true)
    setError('')
    setSuggestions([])
    setQuery('')
    try {
      const url =
        `https://api.open-meteo.com/v1/forecast?latitude=${p.latitude}&longitude=${p.longitude}` +
        `&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,pressure_msl,wind_speed_10m,wind_direction_10m` +
        `&hourly=temperature_2m,weather_code,precipitation_probability,is_day` +
        `&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,uv_index_max,precipitation_probability_max` +
        `&timezone=auto&forecast_days=7`
      const res = await fetch(url)
      if (!res.ok) throw new Error('Bad response')
      const json = await res.json()
      setData(json)
      setPlace(p)
      write('weather-last', p)

      const next = [
        p,
        ...recent.filter((r) => !(r.name === p.name && r.country === p.country)),
      ].slice(0, 5)
      setRecent(next)
      write('weather-recent', next)
    } catch {
      setError('Could not load the weather. Check your internet and try again.')
    } finally {
      setLoading(false)
    }
  }

  // Load the last searched city when the app opens
  useEffect(() => {
    loadWeather(read('weather-last', DEFAULT_PLACE))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // City suggestions while typing
  useEffect(() => {
    if (query.trim().length < 2) {
      setSuggestions([])
      return
    }
    let cancelled = false
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query.trim())}&count=5`
        )
        const json = await res.json()
        if (!cancelled) setSuggestions(json.results || [])
      } catch {
        if (!cancelled) setSuggestions([])
      }
    }, 300)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [query])

  const pick = (s) =>
    loadWeather({
      name: s.name,
      admin: s.admin1,
      country: s.country,
      latitude: s.latitude,
      longitude: s.longitude,
    })

  const handleSubmit = async (e) => {
    e.preventDefault()
    const q = query.trim()
    if (!q) return
    if (suggestions.length > 0) {
      pick(suggestions[0])
      return
    }
    try {
      const res = await fetch(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=1`
      )
      const json = await res.json()
      if (!json.results) {
        setError('City not found. Check the spelling and try again.')
        return
      }
      pick(json.results[0])
    } catch {
      setError('Search failed. Check your internet and try again.')
    }
  }

  // Use the device location
  const locateMe = () => {
    if (!navigator.geolocation) {
      setError('Your browser does not support location.')
      return
    }
    setLoading(true)
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords
        let name = 'Your location'
        let country = ''
        try {
          const r = await fetch(
            `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`
          )
          const j = await r.json()
          name = j.city || j.locality || name
          country = j.countryName || ''
        } catch {
          // keep the default name
        }
        loadWeather({ name, country, latitude, longitude })
      },
      () => {
        setLoading(false)
        setError('Location permission was denied. Search for a city instead.')
      }
    )
  }

  const changeUnit = (u) => {
    setUnit(u)
    write('weather-unit', u)
  }

  /* ---------- values used for display ---------- */

  const temp = (c) => `${Math.round(unit === 'F' ? toF(c) : c)}°`

  const cur = data?.current
  const isDay = cur?.is_day ?? 1
  const code = cur?.weather_code ?? 0
  const w = getWeather(code, isDay)
  const background = getTheme(code, isDay)

  let hours = []
  let days = []
  if (data) {
    const now = `${data.current.time.slice(0, 13)}:00`
    const start = Math.max(0, data.hourly.time.findIndex((t) => t >= now))
    hours = data.hourly.time.slice(start, start + 24).map((t, i) => ({
      time: t,
      temp: data.hourly.temperature_2m[start + i],
      code: data.hourly.weather_code[start + i],
      day: data.hourly.is_day[start + i],
      rain: data.hourly.precipitation_probability[start + i],
    }))
    days = data.daily.time.map((d, i) => ({
      date: d,
      code: data.daily.weather_code[i],
      max: data.daily.temperature_2m_max[i],
      min: data.daily.temperature_2m_min[i],
      rain: data.daily.precipitation_probability_max[i],
    }))
  }

  /* ---------- screen ---------- */

  return (
    <div className="min-h-screen px-4 py-6 text-white" style={{ background }}>
      <div className="mx-auto max-w-3xl">
        {/* top bar */}
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-xl font-bold">🌦️ Weather</h1>
          <div className="flex rounded-full border border-white/30 bg-white/10 p-1">
            {['C', 'F'].map((u) => (
              <button
                key={u}
                onClick={() => changeUnit(u)}
                className={`rounded-full px-3 py-1 text-sm font-semibold ${
                  unit === u ? 'bg-white text-slate-800' : 'text-white'
                }`}
              >
                °{u}
              </button>
            ))}
          </div>
        </div>

        {/* search */}
        <form onSubmit={handleSubmit} className="relative">
          <div className="flex gap-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search for a city..."
              className="min-w-0 flex-1 rounded-2xl bg-white/90 px-4 py-3 text-slate-800 placeholder-slate-400 outline-none focus:ring-2 focus:ring-white"
            />
            <button
              type="submit"
              className="rounded-2xl bg-white px-5 font-semibold text-slate-800"
            >
              Search
            </button>
            <button
              type="button"
              onClick={locateMe}
              title="Use my location"
              className="rounded-2xl border border-white/30 bg-white/20 px-4"
            >
              📍
            </button>
          </div>

          {suggestions.length > 0 && (
            <ul className="absolute z-10 mt-2 w-full overflow-hidden rounded-2xl bg-white text-slate-800 shadow-xl">
              {suggestions.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => pick(s)}
                    className="w-full px-4 py-2 text-left hover:bg-slate-100"
                  >
                    {s.name}
                    <span className="text-sm text-slate-500">
                      {' '}
                      — {[s.admin1, s.country].filter(Boolean).join(', ')}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </form>

        {/* recent searches */}
        {recent.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {recent.map((r) => (
              <button
                key={`${r.name}-${r.latitude}`}
                onClick={() => loadWeather(r)}
                className="rounded-full border border-white/20 bg-white/15 px-3 py-1 text-sm hover:bg-white/25"
              >
                {r.name}
              </button>
            ))}
          </div>
        )}

        {error && (
          <p className="mt-3 rounded-xl border border-red-300/40 bg-red-500/30 px-4 py-2 text-sm">
            {error}
          </p>
        )}

        {!data && loading && <p className="mt-10 animate-pulse text-center">Loading weather...</p>}

        {data && place && (
          <div className={loading ? 'opacity-60' : ''}>
            {/* current weather */}
            <section className={`${glass} mt-6 p-6 text-center`}>
              <h2 className="text-2xl font-semibold">{place.name}</h2>
              <p className="text-sm text-white/70">
                {[place.admin, place.country].filter(Boolean).join(', ')}
              </p>
              <p className="mt-4 text-7xl">{w.icon}</p>
              <p className="text-7xl font-light tracking-tight">{temp(cur.temperature_2m)}</p>
              <p className="mt-1 text-lg">{w.label}</p>
              <p className="text-sm text-white/70">
                H: {temp(days[0].max)} &nbsp; L: {temp(days[0].min)} &nbsp;·&nbsp; Feels like{' '}
                {temp(cur.apparent_temperature)}
              </p>
              <p className="mt-2 text-xs text-white/60">
                Updated {fmtTime(cur.time)} (local time)
              </p>
            </section>

            {/* hourly */}
            <section className={`${glass} mt-4 p-4`}>
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-white/70">
                Next 24 hours
              </h3>
              <div className="flex gap-4 overflow-x-auto pb-2">
                {hours.map((h, i) => (
                  <div
                    key={h.time}
                    className="flex w-14 shrink-0 flex-col items-center gap-1 text-center"
                  >
                    <span className="text-xs text-white/70">{i === 0 ? 'Now' : fmtHour(h.time)}</span>
                    <span className="text-2xl">{getWeather(h.code, h.day).icon}</span>
                    <span className="font-semibold">{temp(h.temp)}</span>
                    <span className="text-xs text-sky-200">💧{h.rain ?? 0}%</span>
                  </div>
                ))}
              </div>
            </section>

            {/* 7-day forecast */}
            <section className={`${glass} mt-4 p-4`}>
              <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-white/70">
                7-day forecast
              </h3>
              <ul className="divide-y divide-white/10">
                {days.map((d, i) => (
                  <li key={d.date} className="flex items-center justify-between py-2">
                    <span className="w-16">{dayName(d.date, i)}</span>
                    <span className="text-2xl">{getWeather(d.code).icon}</span>
                    <span className="w-12 text-sm text-sky-200">💧{d.rain ?? 0}%</span>
                    <span className="w-24 text-right">
                      <span className="font-semibold">{temp(d.max)}</span>{' '}
                      <span className="text-white/60">{temp(d.min)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </section>

            {/* details */}
            <section className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat icon="🌡️" label="Feels like" value={temp(cur.apparent_temperature)} />
              <Stat icon="💧" label="Humidity" value={`${cur.relative_humidity_2m}%`} />
              <Stat
                icon="💨"
                label="Wind"
                value={`${Math.round(unit === 'F' ? toMph(cur.wind_speed_10m) : cur.wind_speed_10m)} ${
                  unit === 'F' ? 'mph' : 'km/h'
                } ${compass(cur.wind_direction_10m)}`}
              />
              <Stat icon="🧭" label="Pressure" value={`${Math.round(cur.pressure_msl)} hPa`} />
              <Stat icon="☀️" label="UV index" value={Math.round(data.daily.uv_index_max[0] * 10) / 10} />
              <Stat icon="🌧️" label="Rain chance" value={`${data.daily.precipitation_probability_max[0] ?? 0}%`} />
              <Stat icon="🌅" label="Sunrise" value={fmtTime(data.daily.sunrise[0])} />
              <Stat icon="🌇" label="Sunset" value={fmtTime(data.daily.sunset[0])} />
            </section>
          </div>
        )}

        <p className="mt-8 text-center text-xs text-white/60">
          Weather data by Open-Meteo.com
        </p>
      </div>
    </div>
  )
}

export default App