import { FiGift } from 'react-icons/fi'

export default function EventBadge({ name }) {
  return (
    <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 text-xs rounded-full bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300">
      <FiGift size={11} /> {name}
    </span>
  )
}
