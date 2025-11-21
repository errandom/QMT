/// <reference path="../vite-end.d.ts" />
import { WeatherForecast } from './types'

interface WeatherCache {
  [key: string]: {
    forecast: WeatherForecast
    timestamp: number
  }
}

const weatherCache: WeatherCache = {}
const CACHE_DURATION = 30 * 60 * 1000 // 30 minutes

export async function getWeatherForecast(
  date: string,
  time: string,
  city: string,
  zipCode: string
): Promise<WeatherForecast> {
  const cacheKey = `${date}-${time}-${city}-${zipCode}`

  // Check cache
  const cached = weatherCache[cacheKey]
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.forecast
  }

  const eventDateTime = new Date(`${date} ${time}`)
  const now = new Date()
  const daysUntil = Math.ceil((eventDateTime.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  const monthName = eventDateTime.toLocaleDateString('en-US', { month: 'long' })
  const season = getSeasonForMonth(eventDateTime.getMonth())

  const prompt = window.spark.llmPrompt`
You are a weather forecasting service. Generate a realistic weather forecast for ${city}, Switzerland (postal code: ${zipCode}).
Event date and time: ${eventDateTime.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })} at ${time}
Days until event: ${daysUntil} days
Season: ${season}
Based on typical weather patterns for Switzerland in ${monthName}, provide a realistic forecast.
Return ONLY a valid JSON object with these exact properties:
{ "temperature": <number in Celsius>, "condition": "<Sunny|Cloudy|Rainy|Snowy|Partly Cloudy>" }
`

  try {
    const response = await window.spark.llm(prompt, 'gpt-4o-mini', true)
    const forecast = JSON.parse(response) as WeatherForecast

    weatherCache[cacheKey] = {
      forecast,
      timestamp: Date.now()
    }

    return forecast
  } catch (error) {
    console.error('Weather forecast failed, using fallback:', error)
    return getFallbackWeather(season)
  }
}

function getSeasonForMonth(month: number): string {
  if (month >= 2 && month <= 4) return 'Spring'
  if (month >= 5 && month <= 7) return 'Summer'
  if (month >= 8 && month <= 10) return 'Autumn'
  return 'Winter'
}

function getFallbackWeather(season: string): WeatherForecast {
  const fallbacks: Record<string, WeatherForecast> = {
    Spring: { temperature: 15, condition: 'Partly Cloudy' },
    Summer: { temperature: 25, condition: 'Sunny' },
    Autumn: { temperature: 12, condition: 'Cloudy' },
    Winter: { temperature: 3, condition: 'Snowy' }
  }
  return fallbacks[season] || fallbacks['Spring']
}
``
