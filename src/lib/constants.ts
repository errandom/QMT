export const COLORS = {
  NAVY: '#001f3f',
  CHARCOAL: '#3e4347',
  ACCENT: '#248bcc',
  WHITE: '#f5f5f5',
} as const

export const SIZES = {
  BORDER_RADIUS: '8pt',
  BUTTON_HEIGHT: '40px',
  ICON_SIZE: 18,
  ICON_SIZE_LARGE: 28,
  ICON_SIZE_MEDIUM: 22,
  ICON_SIZE_SMALL: 16,
  ICON_SIZE_MINI: 14,
} as const

export const STYLES = {
  BUTTON_BASE: {
    borderRadius: SIZES.BORDER_RADIUS,
    height: SIZES.BUTTON_HEIGHT,
    fontSize: '0.875rem',
  },
  NAVY_BUTTON: {
    background: COLORS.NAVY,
    boxShadow: `0 0 15px rgba(0, 31, 63, 0.6)`,
  },
  CHARCOAL_BUTTON: {
    background: COLORS.CHARCOAL,
    boxShadow: `0 0 15px rgba(62, 67, 71, 0.6)`,
  },
} as const

export const SPORT_TYPES = {
  ALL: 'All Sports',
  TACKLE: 'Tackle Football',
  FLAG: 'Flag Football',
} as const

export const EVENT_TYPES = {
  GAME: 'Game',
  PRACTICE: 'Practice',
  MEETING: 'Meeting',
  OTHER: 'Other',
} as const
