import { FiX } from 'react-icons/fi'

export default function Modal({ isOpen, onClose, title, children, footer, maxWidth = 'max-w-md', maxHeight }) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fadeIn" onClick={onClose} />
      <div className={`relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full ${maxWidth} mx-4 overflow-hidden animate-slideDown flex flex-col`} style={maxHeight ? { maxHeight } : undefined}>
        <div className="flex items-center justify-between px-6 py-4 border-b bg-gray-50 dark:bg-gray-700 dark:border-gray-600 shrink-0">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-white">{title}</h2>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors">
            <FiX size={20} />
          </button>
        </div>
        <div className={`p-6 ${maxHeight ? 'overflow-y-auto' : ''}`}>
          {children}
        </div>
        {footer && (
          <div className="px-6 py-4 border-t bg-gray-50 dark:bg-gray-700 dark:border-gray-600 shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}
