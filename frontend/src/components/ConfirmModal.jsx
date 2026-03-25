import Modal from './Modal.jsx'

export default function ConfirmModal({ isOpen, onClose, onConfirm, title = 'Confirmar ação', message = 'Tem certeza que deseja continuar?', confirmText = 'Confirmar', confirmColor = 'bg-red-600 hover:bg-red-700' }) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} maxWidth="max-w-sm">
      <div className="flex flex-col items-center text-center">
        <p className="text-gray-600 dark:text-gray-300 mb-6 whitespace-pre-line">{message}</p>
        <div className="flex gap-3 w-full">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            className={`flex-1 px-4 py-2.5 text-white rounded-lg transition-colors ${confirmColor}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </Modal>
  )
}
