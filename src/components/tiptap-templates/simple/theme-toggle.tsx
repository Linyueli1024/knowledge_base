import { Button } from "@/components/tiptap-ui-primitive/button"

// --- Icons ---
import { EyeCareIcon } from "@/components/tiptap-icons/eye-care-icon"
import { MoonStarIcon } from "@/components/tiptap-icons/moon-star-icon"
import { SunIcon } from "@/components/tiptap-icons/sun-icon"
import { useEffect, useState } from "react"

type ThemeMode = "light" | "eye-care" | "dark"

const THEME_STORAGE_KEY = "knowledge-base-theme-mode"

export function ThemeToggle() {
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
    if (typeof window === "undefined") {
      return "light"
    }

    const storedMode = window.localStorage.getItem(THEME_STORAGE_KEY) as
      | ThemeMode
      | null

    if (storedMode === "light" || storedMode === "eye-care" || storedMode === "dark") {
      return storedMode
    }

    const prefersDarkMode =
      !!document.querySelector('meta[name="color-scheme"][content="dark"]') ||
      window.matchMedia("(prefers-color-scheme: dark)").matches

    return prefersDarkMode ? "dark" : "light"
  })

  useEffect(() => {
    document.documentElement.classList.toggle("dark", themeMode === "dark")
    document.documentElement.classList.toggle("eye-care", themeMode === "eye-care")
    window.localStorage.setItem(THEME_STORAGE_KEY, themeMode)
  }, [themeMode])

  const cycleThemeMode = () => {
    setThemeMode((currentMode) => {
      if (currentMode === "light") return "eye-care"
      if (currentMode === "eye-care") return "dark"
      return "light"
    })
  }

  const nextModeLabel =
    themeMode === "light" ? "护眼模式" : themeMode === "eye-care" ? "深色模式" : "浅色模式"

  return (
    <Button
      onClick={cycleThemeMode}
      aria-label={`Switch to ${nextModeLabel}`}
      variant="ghost"
    >
      {themeMode === "dark" ? (
        <MoonStarIcon className="tiptap-button-icon" />
      ) : themeMode === "eye-care" ? (
        <EyeCareIcon className="tiptap-button-icon" />
      ) : (
        <SunIcon className="tiptap-button-icon" />
      )}
    </Button>
  )
}
