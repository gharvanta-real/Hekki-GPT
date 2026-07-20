"""MARIANO Core Skill — Live weather data."""
from __future__ import annotations
import asyncio
import httpx
from mariano.skills._base import BaseSkill, SkillResult

class WeatherSkill(BaseSkill):
    name = "weather"
    description = "Get current weather and forecast for any city. Returns temperature, humidity, wind, conditions."
    version = "1.0.0"
    tags = ["weather", "climate", "forecast", "temperature"]

    def get_parameters_schema(self) -> dict:
        return {
            "city": {"type": "string", "description": "City name e.g. Mumbai, Delhi, London", "required": True},
            "days": {"type": "integer", "description": "Forecast days (1-7)", "default": 1},
        }

    async def execute(self, city: str, days: int = 1) -> SkillResult:
        try:
            # Using Open-Meteo (free, no API key) + geocoding
            geo_url = f"https://geocoding-api.open-meteo.com/v1/search?name={city}&count=1&language=en&format=json"
            async with httpx.AsyncClient(timeout=10) as client:
                geo_resp = await client.get(geo_url)
                geo_data = geo_resp.json()
                if not geo_data.get("results"):
                    return SkillResult(success=False, data=None, error=f"City '{city}' not found")
                loc = geo_data["results"][0]
                lat, lon = loc["latitude"], loc["longitude"]
                country = loc.get("country", "")

                weather_url = (
                    f"https://api.open-meteo.com/v1/forecast?"
                    f"latitude={lat}&longitude={lon}"
                    f"&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code,apparent_temperature"
                    f"&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weather_code"
                    f"&forecast_days={min(days,7)}&timezone=auto"
                )
                w_resp = await client.get(weather_url)
                w = w_resp.json()

            cur = w["current"]
            wcode = cur.get("weather_code", 0)
            condition = self._wcode_to_desc(wcode)
            lines = [
                f"**Weather: {city}, {country}**",
                f"Condition: {condition}",
                f"Temperature: {cur['temperature_2m']}°C (Feels like {cur['apparent_temperature']}°C)",
                f"Humidity: {cur['relative_humidity_2m']}%",
                f"Wind: {cur['wind_speed_10m']} km/h",
            ]
            if days > 1 and "daily" in w:
                lines.append(f"\n**{days}-Day Forecast:**")
                daily = w["daily"]
                for i in range(min(days, len(daily["time"]))):
                    lines.append(
                        f"  {daily['time'][i]}: {self._wcode_to_desc(daily['weather_code'][i])} "
                        f"↑{daily['temperature_2m_max'][i]}°C ↓{daily['temperature_2m_min'][i]}°C "
                        f"Rain:{daily['precipitation_sum'][i]}mm"
                    )
            return SkillResult(success=True, data="\n".join(lines), metadata={"city": city, "lat": lat, "lon": lon})
        except Exception as exc:
            return SkillResult(success=False, data=None, error=str(exc))

    def _wcode_to_desc(self, code: int) -> str:
        mapping = {
            0: "☀️ Clear sky", 1: "🌤️ Mainly clear", 2: "⛅ Partly cloudy", 3: "☁️ Overcast",
            45: "🌫️ Foggy", 48: "🌫️ Icy fog", 51: "🌦️ Light drizzle", 61: "🌧️ Light rain",
            63: "🌧️ Moderate rain", 65: "🌧️ Heavy rain", 71: "🌨️ Light snow", 80: "🌦️ Rain showers",
            95: "⛈️ Thunderstorm", 99: "⛈️ Heavy thunderstorm",
        }
        return mapping.get(code, f"Code {code}")
