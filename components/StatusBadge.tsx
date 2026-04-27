import { RequestStatus } from '@/lib/types'

const labels: Record<RequestStatus, string> = {
  pending: 'ממתין',
  approved: 'אושר',
  rejected: 'נדחה',
}

export default function StatusBadge({ status }: { status: RequestStatus }) {
  return <span className={`badge-${status}`}>{labels[status]}</span>
}
