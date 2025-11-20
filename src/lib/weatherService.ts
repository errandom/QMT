/// <reference path="../vite-end.d.ts" />
import { WeatherForecast } from './types'

interface WeatherCache {
  [key: string]: {
    forecast: WeatherForecast
    timestamp: number
  }
}

const weatherCache: WeatherCache = {}
const CACHE_DURATION = 30 * 60 * 1000

export async function getWeatherForecast(
  date: string,
  time: string,
  city: string,
  zipCode: string
): Promise<WeatherForecast> {
  const cacheKey = `${date}-${time}-${city}-${zipCode}`
  
  const cached = weatherCache[cacheKey]
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.forecast
  }

  const eventDateTime = new Date(`${date} ${time}`)
  const now = new Date()
  const daysUntil = Math.ceil((eventDateTime.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  const monthName = eventDateTime.toLocaleDateString('en-US', { month: 'long' })
  const season = getSeasonForMonth(eventDateTime.getMonth())

  try {
    const llmPrompt = window.spark.llmPrompt as any
    const prompt = llmPrompt`You are a weather forecasting service. Generate a realistic weather forecast for ${city}, Switzerland (postal code: ${zipCode}).

Event date and time: ${eventDateTime.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })} at ${time}
Days until event: ${daysUntil} days
Season: ${season}

Based on typical weather patterns for Switzerland in ${monthName}, provide a realistic forecast. Consider:
- Switzerland's climate patterns for this season
- Typical temperature ranges for ${season} in Switzerland

Return ONLY a valid JSON object (no markdown, no code blocks) with these exact properties:
{
  "temperature": <number in Celsius>,
  "condition": "<brief condition like 'Sunny', 'Cloudy', 'Rainy', 'Partly Cloudy', 'Snowy', etc.>",
  "icon": "<single weather emoji like ☀️, ⛅, ☁️, 🌧️, ⛈️, 🌨️, 🌦️, etc.>"
}`

    const response = await window.spark.llm(prompt, 'gpt-4o-mini', true)
    const forecast = JSON.parse(response) as WeatherForecast

    weatherCache[cacheKey] = {
      forecast,
      timestamp: Date.now()
    }

    return forecast
  } catch (error) {
    console.error('Weather forecast error:', error)
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
    'Spring': { temperature: 15, condition: 'Partly Cloudy', icon: '⛅' },
    'Summer': { temperature: 22, condition: 'Sunny', icon: '☀️' },
    'Autumn': { temperature: 12, condition: 'Cloudy', icon: '☁️' },
    'Winter': { temperature: 3, condition: 'Snowy', icon: '🌨️' }
  }
  return fallbacks[season] || fallbacks['Spring']
}
