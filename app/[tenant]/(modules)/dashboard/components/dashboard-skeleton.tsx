'use client'

import { Skeleton } from '@/app/shared/components/feedback/skeleton'
import { Card, CardContent, CardHeader } from '@/components/ui/card'

export function DashboardSkeleton() {
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pb-6 space-y-6 md:space-y-8">
      {/* Header Skeleton */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Skeleton className="h-11 w-11 rounded-xl shrink-0" />
          <div className="flex flex-col gap-1.5">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-30 rounded-md" />
          <Skeleton className="h-9 w-9 rounded-md" />
        </div>
      </div>

      {/* Metrics Cards Skeleton */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Card key={index}>
            <CardContent className="p-4 md:p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <Skeleton className="h-4 w-24 mb-2" />
                  <Skeleton className="h-8 w-20" />
                  <Skeleton className="h-4 w-16 mt-2" />
                </div>
                <Skeleton className="size-10 rounded-xl shrink-0" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Engajamento Diário Skeleton */}
      <div className="grid grid-cols-1 gap-4 md:gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardContent className="p-4 md:p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <Skeleton className="h-4 w-32 mb-2" />
                <Skeleton className="h-8 w-16" />
                <Skeleton className="h-3 w-24 mt-2" />
              </div>
              <Skeleton className="size-10 rounded-xl shrink-0" />
            </div>
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardContent className="p-4 md:p-5">
            <div className="flex items-center gap-3 mb-4">
              <Skeleton className="size-9 rounded-xl shrink-0" />
              <div className="flex-1">
                <Skeleton className="h-4 w-40 mb-1.5" />
                <Skeleton className="h-3 w-28" />
              </div>
            </div>
            <Skeleton className="h-44 w-full rounded" />
          </CardContent>
        </Card>
      </div>

      {/* Heatmap Skeleton */}
      <Card>
        <CardContent className="p-4 md:p-5">
          <div className="flex justify-between items-center mb-4">
            <Skeleton className="h-4 w-36" />
            <div className="flex gap-1">
              <Skeleton className="h-7 w-18" />
              <Skeleton className="h-7 w-18" />
              <Skeleton className="h-7 w-18" />
            </div>
          </div>
          <Skeleton className="h-16 w-full rounded" />
          <div className="flex items-center justify-end gap-2 mt-3">
            <Skeleton className="h-3 w-8" />
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="size-3 rounded-[2px]" />
            ))}
            <Skeleton className="h-3 w-8" />
          </div>
        </CardContent>
      </Card>

      {/* Adoção de Serviços Skeleton */}
      <Card>
        <CardContent className="p-4 md:p-5">
          <div className="flex items-center gap-3 mb-4">
            <Skeleton className="size-9 rounded-xl shrink-0" />
            <div className="flex-1">
              <Skeleton className="h-4 w-44 mb-1.5" />
              <Skeleton className="h-3 w-32" />
            </div>
          </div>
          <Skeleton className="h-56 w-full rounded" />
        </CardContent>
      </Card>

      {/* Two-column sections skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
        {Array.from({ length: 2 }).map((_, cardIdx) => (
          <Card key={cardIdx}>
            <CardHeader className="pb-3 pt-4 px-4 md:px-5">
              <Skeleton className="h-4 w-28" />
            </CardHeader>
            <CardContent className="pt-0 px-4 md:px-5 pb-4">
              <div className="space-y-0.5">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div key={index} className="flex items-center gap-3 py-2.5 px-2.5">
                    <Skeleton className="h-7 w-7 rounded-full" />
                    <Skeleton className="h-8 w-8 rounded-full" />
                    <div className="flex-1">
                      <Skeleton className="h-4 w-28 mb-1" />
                      <Skeleton className="h-3 w-20" />
                    </div>
                    <Skeleton className="h-4 w-14" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Performance Skeleton */}
      <Card>
        <CardHeader className="pb-3 pt-4 px-4 md:px-5">
          <Skeleton className="h-4 w-44" />
        </CardHeader>
        <CardContent className="pt-0 px-4 md:px-5 pb-4">
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1">
                    <Skeleton className="h-4 w-36 mb-1" />
                    <Skeleton className="h-3 w-28" />
                  </div>
                  <Skeleton className="h-4 w-10" />
                </div>
                <Skeleton className="h-2 w-full rounded-full" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
