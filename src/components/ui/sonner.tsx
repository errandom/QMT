import { useTheme } from "next-themes"
import { CSSProperties } from "react"
import { Toaster as Sonner, ToasterProps } from "sonner"

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "z-index": "999999",
        } as CSSProperties
      }
      toastOptions={{
        style: {
          zIndex: 999999,
        },
        className: 'toast-message',
      }}
      {...props}
    />
  )
}

export { Toaster }
