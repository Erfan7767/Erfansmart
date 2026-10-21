import { useEffect, useState } from 'react';

type WeatherState =
  | { phase: 'loading' }
  | { phase: 'ready'; temp: number; code: number; location: string }
  | { phase: 'unavailable'; message: string };

const WEATHER: Record<number, string> = {
  0: 'Clear', 1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast', 45: 'Fog', 48: 'Fog',
  51: 'Drizzle', 53: 'Drizzle', 55: 'Drizzle', 61: 'Rain', 63: 'Rain', 65: 'Heavy rain',
  71: 'Snow', 73: 'Snow', 75: 'Snow', 80: 'Showers', 81: 'Showers', 82: 'Showers', 95: 'Storm', 96: 'Storm', 99: 'Storm',
};

function useClock() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);
  return now;
}

function useWeather() {
  const [weather, setWeather] = useState<WeatherState>({ phase: 'loading' });
  useEffect(() => {
    let current = true;
    const unavailable = (message: string) => { if (current) setWeather({ phase: 'unavailable', message }); };
    if (!navigator.geolocation) {
      unavailable('LOCATION UNAVAILABLE');
      return () => { current = false; };
    }
    const locate = () => navigator.geolocation.getCurrentPosition(async ({ coords }) => {
      try {
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${encodeURIComponent(coords.latitude)}&longitude=${encodeURIComponent(coords.longitude)}&current=temperature_2m,weather_code&timezone=auto`;
        const response = await fetch(url);
        if (!response.ok) throw new Error('weather request failed');
        const data = await response.json() as { current?: { temperature_2m?: number; weather_code?: number } };
        const temp = data.current?.temperature_2m;
        const code = data.current?.weather_code;
        if (!current) return;
        if (typeof temp !== 'number' || typeof code !== 'number') throw new Error('weather data unavailable');
        setWeather({ phase: 'ready', temp, code, location: `${coords.latitude.toFixed(1)}°, ${coords.longitude.toFixed(1)}°` });
      } catch {
        unavailable('WEATHER UNAVAILABLE');
      }
    }, (error) => {
      unavailable(error.code === error.PERMISSION_DENIED ? 'LOCATION PERMISSION DENIED' : 'LOCATION UNAVAILABLE');
    }, { enableHighAccuracy: false, timeout: 10_000, maximumAge: 600_000 });
    locate();
    return () => { current = false; };
  }, []);
  return weather;
}

export default function OverviewPanel() {
  const now = useClock();
  const weather = useWeather();
  const [expanded, setExpanded] = useState(false);
  const date = now?.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).toUpperCase() ?? '—';
  const time = now?.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) ?? '--:--';
  return (
    <aside className="overview" aria-label="Local overview">
      <div className="overview-glow" style={{ opacity: expanded ? .9 : .55 }} />
      <button
        className="overview-toggle"
        type="button"
        aria-expanded={expanded}
        aria-label={`${expanded ? 'Close' : 'Open'} overview panel`}
        data-testid="button-toggle-overview"
        onClick={() => setExpanded((v) => !v)}
      >
        <span className="overview-line" />
        <span className="overview-node" />
        <span className="overview-label">OVERVIEW</span>
      </button>
      <div className="overview-content">
        <div className="clock-weather">
          <div>
            <div className="clock-time" data-testid="text-live-clock" aria-label="Local time">{time}</div>
            <div className="clock-date" data-testid="text-live-date">{date}</div>
          </div>
          <div aria-live="polite" data-testid="weather-current">
            <div className="weather-temp">
              {weather.phase === 'ready' ? `${Math.round(weather.temp)}°C` : weather.phase === 'loading' ? '···' : '—'}
            </div>
            <div className="weather-caption">
              {weather.phase === 'ready'
                ? `${weather.location} · ${WEATHER[weather.code] ?? 'Current conditions'}`
                : weather.phase === 'loading' ? 'LOCATING · OPEN-METEO' : weather.message}
            </div>
          </div>
        </div>
        {expanded && (
          <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid rgba(0,229,255,.15)', color: 'rgba(220,238,246,.55)', font: '9px var(--app-font-mono)', letterSpacing: '.12em', lineHeight: 1.7 }} data-testid="text-weather-source">
            WEATHER · OPEN-METEO<br />LOCATION · BROWSER PERMISSION
          </div>
        )}
      </div>
    </aside>
  );
}
