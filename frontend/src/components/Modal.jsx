import { FiX } from 'react-icons/fi'

export default function Modal({ isOpen, onClose, title, children, footer, headerExtra, maxWidth = 'max-w-md', maxHeight, alignTop, alignTopMobile }) {
  if (!isOpen) return null

  const alignClass = alignTop
    ? 'items-start pt-16'
    : alignTopMobile
      ? 'items-start pt-8 md:items-center md:pt-0'
      : 'items-center'

  return (
    <div className={`fixed inset-0 z-50 flex ${alignClass} justify-center`}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fadeIn" onClick={onClose} />
      <div
        className={`relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full ${maxWidth} mx-4 overflow-hidden animate-slideDown flex flex-col max-h-[calc(100vh-2rem)] md:max-h-[90vh]`}
        style={maxHeight ? { maxHeight } : undefined}
      >
        {title !== '' ? (
          <div className="flex items-center justify-between px-6 py-4 border-b bg-gray-50 dark:bg-gray-700 dark:border-gray-600 shrink-0">
            <h2 className="text-lg font-semibold text-gray-800 dark:text-white">{title}</h2>
            <div className="flex items-center gap-2">
              {headerExtra}
              <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors">
              <FiX size={20} />
            </button>
            </div>
          </div>
        ) : (
          <div className="flex justify-end px-4 pt-3 shrink-0">
            <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors">
              <FiX size={20} />
            </button>
          </div>
        )}
        <div className="p-6 overflow-y-auto flex-1 min-h-0">
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
