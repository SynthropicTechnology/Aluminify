"use client"

import * as React from "react"
import ReactPlayer from "react-player"
import { cn } from "@/app/shared/library/utils"
import { Skeleton } from "@/app/shared/components/feedback/skeleton"
import { AlertTriangle, ExternalLink } from "lucide-react"

interface VideoPlayerProps {
  url: string
  light?: boolean
  className?: string
}

export function VideoPlayer({ url, light = false, className }: VideoPlayerProps) {
  const [ready, setReady] = React.useState(false)
  const [hasError, setHasError] = React.useState(false)
  const [debouncedUrl, setDebouncedUrl] = React.useState(url)

  React.useEffect(() => {
    setHasError(false)
    setReady(false)
    const timer = setTimeout(() => setDebouncedUrl(url), 500)
    return () => clearTimeout(timer)
  }, [url])

  const canPlay = ReactPlayer.canPlay?.(debouncedUrl) ?? false

  if (!debouncedUrl || !canPlay) {
    return null
  }

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

  return (
    <div className={cn("w-full aspect-video rounded-lg overflow-hidden relative bg-muted", className)}>
      {!ready && !light && (
        <Skeleton className="absolute inset-0 rounded-lg" />
      )}
      <ReactPlayer
        src={debouncedUrl}
        width="100%"
        height="100%"
        light={light}
        controls
        playing={false}
        onReady={() => setReady(true)}
        onError={() => setHasError(true)}
      />
    </div>
  )
}
