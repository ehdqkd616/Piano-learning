import type { Verdict } from '@/types'
import './VerdictBadge.css'

const LABELS: Record<Verdict, string> = {
  perfect: 'PERFECT!',
  good: 'GOOD',
  late: 'LATE',
  early: 'EARLY',
  miss: 'MISS',
  skip: 'SKIP',
}

interface Props {
  verdict: Verdict | null
}

export function VerdictBadge({ verdict }: Props) {
  if (!verdict) return null
  return (
    <div className={`verdict-badge verdict-badge--${verdict}`}>
      {LABELS[verdict]}
    </div>
  )
}
