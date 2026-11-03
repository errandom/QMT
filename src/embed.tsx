import { createRoot } from 'react-dom/client'
import { ErrorBoundary } from 'react-error-boundary'
import WeeklyWidget from './components/WeeklyWidget'
import './components/WeeklyWidget.css'

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary fallback={<p role="alert">The weekly widget could not be displayed. Reload this page to retry.</p>}>
    <WeeklyWidget />
  </ErrorBoundary>
)
