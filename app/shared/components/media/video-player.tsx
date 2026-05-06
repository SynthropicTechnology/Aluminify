"use client"

import * as React from "react"
import { cn } from "@/app/shared/library/utils"
import { Skeleton } from "@/app/shared/components/feedback/skeleton"
import { AlertTriangle, ExternalLink } from "lucide-react"

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

export function VideoPlayer({ url, className }: VideoPlayerProps) {
  const [ready, setReady] = React.useState(false)
  const [hasError, setHasError] = React.useState(false)
  const [debouncedUrl, setDebouncedUrl] = React.useState(url)

  React.useEffect(() => {
    setHasError(false)
    setReady(false)
    const timer = setTimeout(() => setDebouncedUrl(url), 300)
    return () => clearTimeout(timer)
  }, [url])

  if (!debouncedUrl) return null

  const youtubeId = extractYouTubeId(debouncedUrl)

  if (hasError) {
    return (
      <div
        className={cn(
          "flex items-center gap-3 rounded-lg border border-dashed border-muted-foreground/30 bg-muted/20 px-4 py-3",
          className,
        )}
      >
        <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm text-muted-foreground">
            Não foi possível carregar o vídeo.
          </p>
          <a
            href={debouncedUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-primary hover:underline inline-flex items-center gap-1 mt-1"
          >
            Abrir em nova aba <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </div>
    )
  }

  if (youtubeId) {
    return (
      <div className={cn("w-full aspect-video rounded-lg overflow-hidden relative bg-muted", className)}>
        {!ready && <Skeleton className="absolute inset-0 rounded-lg" />}
        <iframe
          src={`https://www.youtube.com/embed/${youtubeId}?rel=0&origin=${typeof window !== "undefined" ? window.location.origin : ""}`}
          className="absolute inset-0 w-full h-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          onLoad={() => setReady(true)}
          onError={() => setHasError(true)}
        />
      </div>
    )
  }

  return (
    <div className={cn("w-full aspect-video rounded-lg overflow-hidden relative bg-muted", className)}>
      {!ready && <Skeleton className="absolute inset-0 rounded-lg" />}
      <video
        src={debouncedUrl}
        className="w-full h-full"
        controls
        onLoadedData={() => setReady(true)}
        onError={() => setHasError(true)}
      />
    </div>
  )
}
