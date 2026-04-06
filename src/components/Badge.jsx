import { statusClass } from '../lib/utils'

export default function Badge({ status }) {
  return <span className={`badge badge-${statusClass(status)}`}>{status}</span>
}
