import { useTheme } from "next-themes"
import { CSSProperties } from "react"
import { Toaster as Sonner, ToasterProps } from "sonner"

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      position="top-center"
      expand={true}
      richColors
      style={
        {
          "--normal-bg": "#1a1a2e",
          "--normal-text": "#ffffff",
          "--normal-border": "rgba(255, 255, 255, 0.2)",
          "--success-bg": "#065f46",
          "--success-text": "#ffffff",
          "--error-bg": "#991b1b",
          "--error-text": "#ffffff",
          "zIndex": "2147483647",
        } as CSSProperties
      }
      toastOptions={{
        style: {
          zIndex: 2147483647,
          background: '#1a1a2e',
          color: '#ffffff',
          border: '1px solid rgba(255, 255, 255, 0.2)',
        },
        className: 'toast-message',
      }}
      {...props}
    />
  )
}

export { Toaster }
