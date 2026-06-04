import { useState, useEffect } from "react"
import App from "./App"
import { Landing } from "./pages/Landing"

export default function Root() {
  const [view, setView] = useState<"landing" | "app">("landing")

  // Overflow: landing scrolls, app is fixed
  useEffect(() => {
    document.documentElement.style.overflow = view === "landing" ? "auto" : "hidden"
    document.body.style.overflow            = view === "landing" ? "auto" : "hidden"
    document.getElementById("root")!.style.overflow = view === "landing" ? "auto" : "hidden"
    document.getElementById("root")!.style.height   = view === "landing" ? "auto" : "100%"
  }, [view])

  return view === "landing"
    ? <Landing onEnter={() => setView("app")} />
    : <App onBack={() => setView("landing")} />
}
