'use client'

import type { ReactNode } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/shared/library/utils'
import { Trophy, Medal, Award } from 'lucide-react'

export interface RankingItem {
  id: string
  name: string
  avatarUrl?: string | null
  primaryValue: string
  secondaryValue?: string
  badge?: string
}

interface RankingListProps {
  title: string
  items: RankingItem[]
  emptyMessage?: string
  className?: string
  maxHeight?: string
  accentFrom?: string
  accentTo?: string
  iconGradient?: string
  icon?: ReactNode
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((word) => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

function getRankIcon(position: number) {
  switch (position) {
    case 0:
      return <Trophy className="h-3.5 w-3.5 text-yellow-500" />
    case 1:
      return <Medal className="h-3.5 w-3.5 text-muted-foreground" />
    case 2:
      return <Award className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
    default:
      return null
  }
}

function getRankBadgeColor(position: number): string {
  switch (position) {
    case 0:
      return 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/30'
    case 1:
      return 'bg-muted text-muted-foreground border-border'
    case 2:
      return 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30'
    default:
      return 'bg-muted text-muted-foreground border-border'
  }
}

function getRowHighlight(position: number): string {
  switch (position) {
    case 0:
      return 'bg-yellow-500/5'
    case 1:
      return 'bg-muted/50'
    case 2:
      return 'bg-amber-500/5'
    default:
      return ''
  }
}

export function RankingList({
  title,
  items,
  emptyMessage = 'Nenhum item encontrado',
  className,
  maxHeight: _maxHeight = '240px',
  accentFrom = 'from-violet-400',
  accentTo = 'to-fuchsia-500',
  iconGradient = 'from-violet-500 to-fuchsia-500',
  icon,
}: RankingListProps) {
  return (
    <Card className={cn('overflow-hidden rounded-2xl pt-0 dark:bg-card/80 dark:backdrop-blur-sm dark:border-white/5 hover:shadow-lg flex flex-col', className)}>
      <div className={cn('h-0.5 bg-linear-to-r shrink-0', accentFrom, accentTo)} />
      <CardContent className="p-4 md:p-5 flex flex-col flex-1 min-h-0">
        <div className="flex items-center gap-3 mb-4 shrink-0">
          <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-linear-to-br', iconGradient)}>
            {icon ?? <Trophy className="h-5 w-5 text-white" />}
          </div>
          <h3 className="widget-title">{title}</h3>
        </div>

        {items.length === 0 ? (
          <div className="flex items-center justify-center min-h-25 flex-1">
            <p className="text-sm text-muted-foreground">{emptyMessage}</p>
          </div>
        ) : (
          <ScrollArea className="flex-1 min-h-0 pr-3">
            <div className="space-y-0.5">
              {items.map((item, index) => (
                <div
                  key={item.id}
                  className={cn(
                    'flex items-center gap-3 py-2.5 px-2.5 rounded-lg transition-colors cursor-default',
                    index < 3 ? getRowHighlight(index) : 'hover:bg-muted/50'
                  )}
                >
                  <div
                    className={cn(
                      'flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold border shrink-0',
                      getRankBadgeColor(index)
                    )}
                  >
                    {getRankIcon(index) || <span>{index + 1}</span>}
                  </div>
                  <Avatar className="h-8 w-8 border shrink-0">
                    <AvatarImage src={item.avatarUrl || undefined} alt={item.name} />
                    <AvatarFallback className="text-xs bg-primary/10 text-primary">
                      {getInitials(item.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.name}</p>
                    {item.secondaryValue && (
                      <p className="text-xs text-muted-foreground truncate">{item.secondaryValue}</p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold text-primary">{item.primaryValue}</p>
                    {item.badge && (
                      <p className="text-xs text-muted-foreground">{item.badge}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  )
}
