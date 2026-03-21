import { useState, useEffect } from 'react'
import { FiChevronLeft, FiChevronRight, FiX, FiZap, FiCopy, FiCheck } from 'react-icons/fi'
import api from '../services/api.js'
import toast from 'react-hot-toast'

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const WEEKDAYS_FULL = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']
const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate()
}

function getFirstDayOfMonth(year, month) {
  return new Date(year, month, 1).getDay()
}

function formatDateKey(year, month, day) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function formatDateBR(dateStr) {
  const [y, m, d] = dateStr.split('-')
  return `${d}/${m}/${y}`
}

export default function AgendaModal({ isOpen, onClose }) {
  const today = new Date()
  const [viewYear, setViewYear] = useState(today.getFullYear())
  const [viewMonth, setViewMonth] = useState(today.getMonth())
  const [slots, setSlots] = useState({})
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(false)

  // Day edit modal
  const [selectedDate, setSelectedDate] = useState(null)
  const [categoryValues, setCategoryValues] = useState({})

  // Clone modal
  const [showClone, setShowClone] = useState(false)
  const [cloneSelected, setCloneSelected] = useState({}) // { 'yyyy-mm-dd': true }

  // Quick fill
  const [showQuickFill, setShowQuickFill] = useState(false)
  const [quickFillValues, setQuickFillValues] = useState({})

  useEffect(() => {
    if (isOpen) {
      loadSlots()
      loadCategories()
    }
  }, [isOpen, viewYear, viewMonth])

  async function loadCategories() {
    try {
      const { data } = await api.get('/categories')
      setCategories(data.filter(c => c.active))
    } catch {
      // silently fail
    }
  }

  async function loadSlots() {
    try {
      const month = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}`
      const { data } = await api.get(`/agenda?month=${month}`)
      const map = {}
      for (const s of data) {
        map[s.date] = s
      }
      setSlots(map)
    } catch {
      toast.error('Erro ao carregar agenda')
    }
  }

  function openDayModal(dateKey) {
    const slot = slots[dateKey]
    const values = {}
    categories.forEach(cat => {
      const existing = slot?.categories?.find(c => c.categoryId === cat.id)
      values[cat.id] = existing ? String(existing.maxUnits) : ''
    })
    setCategoryValues(values)
    setSelectedDate(dateKey)
    setShowClone(false)
  }

  async function saveDaySlot() {
    const catEntries = categories
      .filter(c => categoryValues[c.id] && Number(categoryValues[c.id]) > 0)
      .map(c => ({ categoryId: c.id, maxUnits: Number(categoryValues[c.id]) }))

    if (catEntries.length === 0) {
      return toast.error('Defina pelo menos uma categoria')
    }

    try {
      setLoading(true)
      await api.post('/agenda', {
        date: selectedDate,
        categories: catEntries,
      })
      await loadSlots()
      toast.success(`Agenda salva para ${formatDateBR(selectedDate)}`)
      setSelectedDate(null)
    } catch {
      toast.error('Erro ao salvar agenda')
    } finally {
      setLoading(false)
    }
  }

  async function removeDaySlot() {
    const slot = slots[selectedDate]
    if (!slot) return
    try {
      setLoading(true)
      await api.delete(`/agenda/${slot.id}`)
      await loadSlots()
      toast.success('Agenda removida')
      setSelectedDate(null)
    } catch {
      toast.error('Erro ao remover')
    } finally {
      setLoading(false)
    }
  }

  // Retorna os dias da semana do selectedDate (Dom-Sáb), excluindo o próprio e passados
  function getWeekDays(dateStr) {
    const d = new Date(dateStr + 'T12:00:00')
    const dayOfWeek = d.getDay()
    const monday = new Date(d)
    monday.setDate(d.getDate() - dayOfWeek) // Vai pro domingo da semana
    const todayStr = formatDateKey(today.getFullYear(), today.getMonth(), today.getDate())
    const days = []
    for (let i = 0; i < 7; i++) {
      const current = new Date(monday)
      current.setDate(monday.getDate() + i)
      const key = formatDateKey(current.getFullYear(), current.getMonth(), current.getDate())
      if (key === dateStr) continue // Pula o dia selecionado
      if (key < todayStr) continue // Pula passados
      days.push({
        dateKey: key,
        day: current.getDate(),
        weekday: WEEKDAYS[current.getDay()],
        weekdayFull: WEEKDAYS_FULL[current.getDay()],
      })
    }
    return days
  }

  async function handleClone() {
    const catEntries = categories
      .filter(c => categoryValues[c.id] && Number(categoryValues[c.id]) > 0)
      .map(c => ({ categoryId: c.id, maxUnits: Number(categoryValues[c.id]) }))

    if (catEntries.length === 0) {
      return toast.error('Defina pelo menos uma categoria antes de clonar')
    }

    const selectedDates = Object.entries(cloneSelected).filter(([, v]) => v).map(([k]) => k)

    if (selectedDates.length === 0) {
      return toast.error('Selecione pelo menos um dia para clonar')
    }

    const bulkSlots = selectedDates.map(date => ({ date, categories: catEntries }))

    try {
      setLoading(true)
      await api.post('/agenda/bulk', { slots: bulkSlots })
      await loadSlots()
      setShowClone(false)
      toast.success(`Agenda clonada para ${bulkSlots.length} dia${bulkSlots.length > 1 ? 's' : ''}!`)
    } catch {
      toast.error('Erro ao clonar agenda')
    } finally {
      setLoading(false)
    }
  }

  async function handleQuickFill() {
    const catEntries = categories
      .filter(c => quickFillValues[c.id] && Number(quickFillValues[c.id]) > 0)
      .map(c => ({ categoryId: c.id, maxUnits: Number(quickFillValues[c.id]) }))

    if (catEntries.length === 0) {
      return toast.error('Defina pelo menos uma categoria')
    }

    const daysInMonth = getDaysInMonth(viewYear, viewMonth)
    const todayStr = formatDateKey(today.getFullYear(), today.getMonth(), today.getDate())
    const bulkSlots = []

    for (let d = 1; d <= daysInMonth; d++) {
      const dateKey = formatDateKey(viewYear, viewMonth, d)
      if (dateKey < todayStr) continue
      const dayOfWeek = new Date(viewYear, viewMonth, d).getDay()
      if (dayOfWeek === 0) continue // Pula domingos
      bulkSlots.push({ date: dateKey, categories: catEntries })
    }

    if (bulkSlots.length === 0) return toast.error('Nenhum dia útil futuro neste mês')

    try {
      setLoading(true)
      await api.post('/agenda/bulk', { slots: bulkSlots })
      await loadSlots()
      setShowQuickFill(false)
      setQuickFillValues({})
      toast.success(`${bulkSlots.length} dias configurados!`)
    } catch {
      toast.error('Erro ao preencher agenda')
    } finally {
      setLoading(false)
    }
  }

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(viewYear - 1) }
    else setViewMonth(viewMonth - 1)
  }

  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(viewYear + 1) }
    else setViewMonth(viewMonth + 1)
  }

  if (!isOpen) return null

  const daysInMonth = getDaysInMonth(viewYear, viewMonth)
  const firstDay = getFirstDayOfMonth(viewYear, viewMonth)
  const todayStr = formatDateKey(today.getFullYear(), today.getMonth(), today.getDate())

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fadeIn" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden animate-slideDown max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b bg-gray-50 dark:bg-gray-700 dark:border-gray-600">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-white">Agenda de Disponibilidade</h2>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors">
            <FiX size={20} />
          </button>
        </div>

        <div className="p-5 overflow-y-auto flex-1">
          {/* Month navigation */}
          <div className="flex items-center justify-between mb-4">
            <button onClick={prevMonth} className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300 transition-colors">
              <FiChevronLeft size={20} />
            </button>
            <span className="text-base font-semibold text-gray-800 dark:text-white">
              {MONTHS[viewMonth]} {viewYear}
            </span>
            <button onClick={nextMonth} className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300 transition-colors">
              <FiChevronRight size={20} />
            </button>
          </div>

          {/* Quick fill */}
          <div className="mb-4">
            {!showQuickFill ? (
              <button
                onClick={() => { setShowQuickFill(true); setQuickFillValues({}) }}
                className="flex items-center gap-1.5 text-sm text-pink-500 hover:text-pink-600 font-medium transition-colors"
              >
                <FiZap size={14} /> Preencher dias úteis do mês
              </button>
            ) : (
              <div className="bg-pink-50 dark:bg-pink-900/20 p-4 rounded-lg space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Unidades por categoria:</span>
                  <button onClick={() => { setShowQuickFill(false); setQuickFillValues({}) }} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                    <FiX size={16} />
                  </button>
                </div>
                {categories.map(cat => (
                  <div key={cat.id} className="flex items-center gap-2">
                    <span className="text-sm text-gray-600 dark:text-gray-400 flex-1">{cat.name}</span>
                    <input
                      type="number"
                      min="0"
                      value={quickFillValues[cat.id] || ''}
                      onChange={(e) => setQuickFillValues({ ...quickFillValues, [cat.id]: e.target.value })}
                      placeholder="0"
                      className="w-20 px-2 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-white text-sm focus:ring-2 focus:ring-pink-500 outline-none text-center"
                    />
                  </div>
                ))}
                <button
                  onClick={handleQuickFill}
                  disabled={loading}
                  className="w-full px-3 py-2 bg-pink-500 text-white text-sm rounded-lg hover:bg-pink-600 transition-colors disabled:opacity-50"
                >
                  Aplicar para dias úteis
                </button>
              </div>
            )}
          </div>

          {/* Legend */}
          <div className="flex items-center gap-4 mb-3 text-xs text-gray-500 dark:text-gray-400">
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-green-400 inline-block" /> Disponível</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-yellow-400 inline-block" /> Quase lotado</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-red-400 inline-block" /> Lotado</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-gray-300 dark:bg-gray-600 inline-block" /> Sem agenda</span>
          </div>

          {/* Weekday headers */}
          <div className="grid grid-cols-7 mb-1">
            {WEEKDAYS.map((d) => (
              <div key={d} className="text-center text-xs font-medium text-gray-400 dark:text-gray-500 py-1">
                {d}
              </div>
            ))}
          </div>

          {/* Days grid */}
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: firstDay }).map((_, i) => (
              <div key={`empty-${i}`} />
            ))}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1
              const dateKey = formatDateKey(viewYear, viewMonth, day)
              const slot = slots[dateKey]
              const isPast = dateKey < todayStr
              const isToday = dateKey === todayStr
              const hasCats = slot?.categories?.length > 0

              let bgColor = 'bg-gray-50 dark:bg-gray-700/50'
              let borderColor = 'border-gray-200 dark:border-gray-600'
              if (slot) {
                const usage = slot.maxOrders > 0 ? slot.currentOrders / slot.maxOrders : 0
                if (usage >= 1) {
                  bgColor = 'bg-red-50 dark:bg-red-900/20'
                  borderColor = 'border-red-300 dark:border-red-700'
                } else if (usage >= 0.8) {
                  bgColor = 'bg-yellow-50 dark:bg-yellow-900/20'
                  borderColor = 'border-yellow-300 dark:border-yellow-700'
                } else {
                  bgColor = 'bg-green-50 dark:bg-green-900/20'
                  borderColor = 'border-green-300 dark:border-green-700'
                }
              }

              if (isPast) {
                bgColor = 'bg-gray-100 dark:bg-gray-800 opacity-40'
                borderColor = 'border-gray-200 dark:border-gray-700'
              }

              return (
                <div
                  key={day}
                  onClick={() => !isPast && openDayModal(dateKey)}
                  className={`relative border rounded-lg p-1.5 min-h-[60px] cursor-pointer transition-all hover:shadow-sm ${bgColor} ${borderColor} ${isToday ? 'ring-2 ring-pink-500/50' : ''} ${isPast ? 'cursor-default' : ''}`}
                >
                  <div className={`text-xs font-medium ${isToday ? 'text-pink-600 dark:text-pink-400' : 'text-gray-600 dark:text-gray-300'}`}>
                    {day}
                  </div>
                  {slot && (
                    <div className="mt-0.5">
                      {hasCats ? (
                        <div className="text-[10px] text-gray-500 dark:text-gray-400 leading-tight">
                          {slot.categories.slice(0, 2).map(c => (
                            <div key={c.categoryId} className="truncate">{c.categoryName.slice(0, 6)}: {c.currentUnits}/{c.maxUnits}</div>
                          ))}
                          {slot.categories.length > 2 && <div className="text-gray-400">+{slot.categories.length - 2}</div>}
                        </div>
                      ) : (
                        <div className={`text-xs font-bold ${slot.currentOrders >= slot.maxOrders ? 'text-red-600 dark:text-red-400' : 'text-gray-700 dark:text-gray-200'}`}>
                          {slot.currentOrders}/{slot.maxOrders}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t bg-gray-50 dark:bg-gray-700 dark:border-gray-600 flex justify-between items-center">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Clique em um dia para configurar
          </p>
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors text-sm"
          >
            Fechar
          </button>
        </div>
      </div>

      {/* Day edit modal */}
      {selectedDate && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/30" onClick={() => setSelectedDate(null)} />
          <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden animate-slideDown max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-3 border-b bg-gray-50 dark:bg-gray-700 dark:border-gray-600">
              <div>
                <h3 className="font-semibold text-gray-800 dark:text-white">
                  {formatDateBR(selectedDate)}
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {WEEKDAYS_FULL[new Date(selectedDate + 'T12:00:00').getDay()]}
                </p>
              </div>
              <button onClick={() => setSelectedDate(null)} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors">
                <FiX size={18} />
              </button>
            </div>

            <div className="p-5 space-y-3 overflow-y-auto flex-1">
              <p className="text-sm text-gray-600 dark:text-gray-400 font-medium">Unidades disponíveis por categoria:</p>

              {categories.map(cat => (
                <div key={cat.id} className="flex items-center gap-3">
                  <span className="text-sm text-gray-700 dark:text-gray-300 flex-1">{cat.name}</span>
                  <input
                    type="number"
                    min="0"
                    value={categoryValues[cat.id] || ''}
                    onChange={(e) => setCategoryValues({ ...categoryValues, [cat.id]: e.target.value })}
                    placeholder="0"
                    className="w-24 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-white text-sm focus:ring-2 focus:ring-pink-500 outline-none text-center"
                  />
                </div>
              ))}

              {categories.length === 0 && (
                <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-4">
                  Nenhuma categoria cadastrada
                </p>
              )}

              {/* Clone section */}
              {!showClone ? (
                <button
                  className="flex items-center gap-1.5 text-sm px-3 py-2 bg-gray-100 dark:bg-gray-700 text-pink-500 hover:bg-gray-200 dark:hover:bg-gray-600 font-medium rounded-lg transition-colors mt-2"
                  onClick={() => { setShowClone(true); setCloneSelected({}) }}
                >
                  <FiCopy size={14} /> Clonar para outros dias da semana
                </button>
              ) : (
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 space-y-3 mt-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Clonar para os dias da semana:</span>
                    <button onClick={() => setShowClone(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                      <FiX size={14} />
                    </button>
                  </div>

                  {(() => {
                    const weekDays = getWeekDays(selectedDate)
                    return weekDays.length > 0 ? (
                      <div className="space-y-1.5">
                        {weekDays.map(wd => (
                          <button
                            key={wd.dateKey}
                            onClick={() => setCloneSelected({ ...cloneSelected, [wd.dateKey]: !cloneSelected[wd.dateKey] })}
                            className={`w-full flex items-center justify-between px-3 py-2 rounded-lg border text-sm transition-colors ${
                              cloneSelected[wd.dateKey]
                                ? 'bg-pink-500 text-white border-pink-500'
                                : 'bg-white dark:bg-gray-600 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-500 hover:bg-gray-100 dark:hover:bg-gray-500'
                            }`}
                          >
                            <span>{wd.weekdayFull}</span>
                            <span className="text-xs opacity-80">{wd.day}/{String(viewMonth + 1).padStart(2, '0')}</span>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-gray-400 text-center py-2">Não há outros dias disponíveis nesta semana</p>
                    )
                  })()}

                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        const all = {}
                        getWeekDays(selectedDate).forEach(wd => { all[wd.dateKey] = true })
                        setCloneSelected(all)
                      }}
                      className="text-xs px-3 py-1.5 bg-gray-200 dark:bg-gray-600 text-pink-500 hover:bg-gray-300 dark:hover:bg-gray-500 font-medium rounded-lg transition-colors"
                    >
                      Todos
                    </button>
                    <button
                      onClick={() => setCloneSelected({})}
                      className="text-xs px-3 py-1.5 bg-gray-200 dark:bg-gray-600 text-pink-500 hover:bg-gray-300 dark:hover:bg-gray-500 font-medium rounded-lg transition-colors"
                    >
                      Nenhum
                    </button>
                  </div>

                  <button
                    onClick={handleClone}
                    disabled={loading || !Object.values(cloneSelected).some(Boolean)}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-pink-500 text-white text-sm rounded-lg hover:bg-pink-600 transition-colors disabled:opacity-50"
                  >
                    <FiCopy size={14} /> Clonar neste mês
                  </button>
                </div>
              )}
            </div>

            <div className="px-5 py-3 border-t bg-gray-50 dark:bg-gray-700 dark:border-gray-600 flex gap-2">
              {slots[selectedDate] && (
                <button
                  onClick={removeDaySlot}
                  disabled={loading}
                  className="px-3 py-2 text-sm text-red-600 border border-red-300 dark:border-red-600 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
                >
                  Remover
                </button>
              )}
              <div className="flex-1" />
              <button
                onClick={() => setSelectedDate(null)}
                className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={saveDaySlot}
                disabled={loading}
                className="flex items-center gap-1.5 px-4 py-2 text-sm bg-pink-500 text-white rounded-lg hover:bg-pink-600 transition-colors disabled:opacity-50"
              >
                <FiCheck size={14} /> Salvar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
