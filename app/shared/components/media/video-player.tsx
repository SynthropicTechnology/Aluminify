"use client"

import * as React from "react"
import { cn } from "@/app/shared/library/utils"
import { Skeleton } from "@/app/shared/components/feedback/skeleton"
import { Play, ExternalLink, AlertTriangle } from "lucide-react"

interface VideoPlayerProps {
  url: string
  light?: boolean
  className?: string
}

const YOUTUBE_REGEX = /(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:embed\/|v\/|watch\/|watch\?v=|watch\?.+&v=|shorts\/|live\/))(([\w-]){11})/

function extractYouTubeId(url: string): string | null {
  const match = url.match(YOUTUBE_REGEX)
  return match ? match[1] : null
}

declare global {
  interface Window {
    onYouTubeIframeAPIReady?: () => void
  }
}

let ytApiLoaded = false
let ytApiLoading = false
const ytApiCallbacks: (() => void)[] = []

function loadYouTubeApi(): Promise<void> {
  if (ytApiLoaded && window.YT?.Player) return Promise.resolve()
  return new Promise((resolve) => {
    ytApiCallbacks.push(resolve)
    if (ytApiLoading) return
    ytApiLoading = true

    const existing = document.getElementById("youtube-iframe-api")
    if (existing && window.YT?.Player) {
      ytApiLoaded = true
      ytApiCallbacks.forEach((cb) => cb())
      ytApiCallbacks.length = 0
      return
    }

    window.onYouTubeIframeAPIReady = () => {
      ytApiLoaded = true
      ytApiCallbacks.forEach((cb) => cb())
      ytApiCallbacks.length = 0
    }

    if (!existing) {
      const script = document.createElement("script")
      script.id = "youtube-iframe-api"
      script.src = "https://www.youtube.com/iframe_api"
      document.head.appendChild(script)
    }
  })
}

function YouTubeEmbed({ videoId, className }: { videoId: string; className?: string }) {
  const containerRef = React.useRef<HTMLDivElement>(null)
  const playerRef = React.useRef<YT.Player | null>(null)
  const [state, setState] = React.useState<"loading" | "ready" | "error">("loading")
  const idRef = React.useRef(0)

  React.useEffect(() => {
    const currentId = ++idRef.current
    let mounted = true

    async function init() {
      try {
        await loadYouTubeApi()
        if (!mounted || currentId !== idRef.current || !containerRef.current) return

        const div = document.createElement("div")
        containerRef.current.innerHTML = ""
        containerRef.current.appendChild(div)

        playerRef.current = new window.YT.Player(div, {
          videoId,
          width: "100%",
          height: "100%",
          playerVars: {
            rel: 0,
            modestbranding: 1,
            playsinline: 1,
          },
          events: {
            onReady: () => {
              if (mounted && currentId === idRef.current) setState("ready")
            },
            onError: () => {
              if (mounted && currentId === idRef.current) setState("error")
            },
          },
        })
      } catch {
        if (mounted && currentId === idRef.current) setState("error")
      }
    }

    setState("loading")
    init()

    return () => {
      mounted = false
      try { playerRef.current?.destroy() } catch { /* noop */ }
    }
  }, [videoId])

  if (state === "error") {
    return <YouTubeFallback videoId={videoId} className={className} />
  }

  return (
    <div className={cn("w-full aspect-video rounded-lg overflow-hidden relative bg-muted", className)}>
      {state === "loading" && <Skeleton className="absolute inset-0 rounded-lg" />}
      <div ref={containerRef} className="absolute inset-0 [&_iframe]:w-full [&_iframe]:h-full" />
    </div>
  )
}

function YouTubeFallback({ videoId, className }: { videoId: string; className?: string }) {
  const watchUrl = `https://www.youtube.com/watch?v=${videoId}`

  return (
    <div className={cn("w-full aspect-video rounded-lg overflow-hidden relative bg-black", className)}>
      <img
        src={`https://img.youtube.com/vi/${videoId}/hqdefault.jpg`}
        alt="Thumbnail do vídeo"
        className="w-full h-full object-cover opacity-40"
      />
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-4">
        <div className="flex items-center gap-2 text-amber-400">
          <AlertTriangle className="h-5 w-5" />
          <span className="text-sm font-medium">Vídeo com incorporação desabilitada</span>
        </div>
        <p className="text-xs text-white/70 text-center max-w-sm">
          O proprietário deste vídeo não permite reprodução em sites externos.
          Peça ao professor para habilitar a incorporação nas configurações do YouTube.
        </p>
        <a
          href={watchUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1 inline-flex items-center gap-2 rounded-full bg-red-600 hover:bg-red-500 transition-colors px-5 py-2.5 text-white text-sm font-medium shadow-lg"
        >
          <Play className="h-4 w-4 fill-white" />
          Assistir no YouTube
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>
    </div>
  )
}

export function VideoPlayer({ url, className }: VideoPlayerProps) {
  if (!url) return null

  const youtubeId = extractYouTubeId(url)

  if (youtubeId) {
    return <YouTubeEmbed videoId={youtubeId} className={className} />
  }

  return (
    <div className={cn("w-full aspect-video rounded-lg overflow-hidden relative bg-muted", className)}>
      <video src={url} className="w-full h-full" controls />
    </div>
  )
}
