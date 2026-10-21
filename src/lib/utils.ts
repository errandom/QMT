import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import type { Event } from "./types"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatEventTimeRange(event: Pick<Event, "date" | "endDate" | "startTime" | "endTime">) {
  const end = event.endDate && event.endDate !== event.date
    ? `${event.endDate} ${event.endTime}`
    : event.endTime
  return `${event.startTime} - ${end}`
}
