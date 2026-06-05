import { useState, useEffect } from "react"
import App from "./App"
import { Landing } from "./pages/Landing"
import { Docs } from "./pages/Docs"

export default function Root() {
  const [view, setView] = useState<"landing" | "app" | "methodology" | "layers">("landing")

  // Check URL parameters on mount to support opening in a new tab
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const viewParam = params.get("view")
    if (viewParam === "methodology") {
      setView("methodology")
    } else if (viewParam === "layers") {
      setView("layers")
    } else if (viewParam === "app") {
      setView("app")
    }
  }, [])

  // Overflow management: landing and docs scroll, map application is fixed
  useEffect(() => {
    const isScrollable = view === "landing" || view === "methodology" || view === "layers"
    document.documentElement.style.overflow = isScrollable ? "auto" : "hidden"
    document.body.style.overflow            = isScrollable ? "auto" : "hidden"
    document.getElementById("root")!.style.overflow = isScrollable ? "visible" : "hidden"
    document.getElementById("root")!.style.height   = isScrollable ? "auto" : "100%"
  }, [view])

  if (view === "app") {
    return <App onBack={() => setView("landing")} />
  }
  
  if (view === "methodology" || view === "layers") {
    return <Docs type={view} onBack={() => setView("landing")} onEnter={() => setView("app")} />
  }

  return <Landing onEnter={() => setView("app")} />
}
