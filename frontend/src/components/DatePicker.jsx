import { useState, useRef, useEffect } from 'react'
import { FiChevronLeft, FiChevronRight, FiCalendar } from 'react-icons/fi'

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
]

function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate()
}

function getFirstDayOfMonth(year, month) {
  return new Date(year, month, 1).getDay()
}

function formatDate(year, month, day) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function parseDate(str) {
  if (!str) return null
  const [y, m, d] = str.split('-').map(Number)
  return { year: y, month: m - 1, day: d }
}

export default function DatePicker({ value, onChange, placeholder = 'Selecionar data' }) {
  const [open, setOpen] = useState(false)
  const parsed = parseDate(value)
  const today = new Date()
  const [viewYear, setViewYear] = useState(parsed?.year || today.getFullYear())
  const [viewMonth, setViewMonth] = useState(parsed?.month ?? today.getMonth())
  const ref = useRef(null)
  const [dropPos, setDropPos] = useState({ top: 0, left: 0 })

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  useEffect(() => {
    if (parsed) {
      setViewYear(parsed.year)
      setViewMonth(parsed.month)
    }
  }, [value])

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(viewYear - 1) }
    else setViewMonth(viewMonth - 1)
  }

  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(viewYear + 1) }
    else setViewMonth(viewMonth + 1)
  }

  function selectDay(day) {
    onChange(formatDate(viewYear, viewMonth, day))
    setOpen(false)
  }

  function goToday() {
    const t = new Date()
    setViewYear(t.getFullYear())
    setViewMonth(t.getMonth())
    onChange(formatDate(t.getFullYear(), t.getMonth(), t.getDate()))
    setOpen(false)
  }

  const daysInMonth = getDaysInMonth(viewYear, viewMonth)
  const firstDay = getFirstDayOfMonth(viewYear, viewMonth)
  const todayStr = formatDate(today.getFullYear(), today.getMonth(), today.getDate())

  const displayValue = parsed
    ? `${String(parsed.day).padStart(2, '0')}/${String(parsed.month + 1).padStart(2, '0')}/${parsed.year}`
    : ''

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => {
          if (!open && ref.current) {
            const rect = ref.current.getBoundingClientRect()
            const spaceBelow = window.innerHeight - rect.bottom
            const dropH = 360
            const goUp = spaceBelow < dropH && rect.top > dropH
            setDropPos({
              top: goUp ? rect.top - dropH - 8 : rect.bottom + 8,
              left: Math.min(rect.right - 300, window.innerWidth - 316),
            })
          }
          setOpen(!open)
        }}
        className={`flex items-center gap-2 px-3 py-3 rounded-lg border transition-all
          ${open
            ? 'border-pink-500 ring-2 ring-pink-500/20'
            : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
          }
          bg-white dark:bg-gray-800 text-gray-800 dark:text-white outline-none min-w-[160px]`}
      >
        <FiCalendar size={16} className={value ? 'text-pink-500' : 'text-gray-400'} />
        <span className={value ? 'text-sm' : 'text-sm text-gray-400'}>
          {displayValue || placeholder}
        </span>
      </button>

      {open && (
        <div className="fixed z-[100] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl shadow-black/10 dark:shadow-black/30 p-4 w-[300px] animate-slideDown" style={{ top: dropPos.top, left: dropPos.left }}>
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <button
              type="button"
              onClick={prevMonth}
              className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 transition-colors"
            >
              <FiChevronLeft size={18} />
            </button>
            <span className="text-sm font-semibold text-gray-800 dark:text-white">
              {MONTHS[viewMonth]} {viewYear}
            </span>
            <button
              type="button"
              onClick={nextMonth}
              className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 transition-colors"
            >
              <FiChevronRight size={18} />
            </button>
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
          <div className="grid grid-cols-7 gap-0.5">
            {Array.from({ length: firstDay }).map((_, i) => (
              <div key={`empty-${i}`} />
            ))}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1
              const dateStr = formatDate(viewYear, viewMonth, day)
              const isSelected = value === dateStr
              const isToday = dateStr === todayStr

              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => selectDay(day)}
                  className={`relative h-9 w-full rounded-lg text-sm font-medium transition-all
                    ${isSelected
                      ? 'bg-pink-500 text-white shadow-sm shadow-pink-500/30'
                      : isToday
                        ? 'bg-pink-50 dark:bg-pink-900/20 text-pink-600 dark:text-pink-400 hover:bg-pink-100 dark:hover:bg-pink-900/30'
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                >
                  {day}
                  {isToday && !isSelected && (
                    <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-pink-500" />
                  )}
                </button>
              )
            })}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
            <button
              type="button"
              onClick={goToday}
              className="text-xs font-medium text-pink-500 hover:text-pink-600 dark:hover:text-pink-400 transition-colors"
            >
              Hoje
            </button>
            {value && (
              <button
                type="button"
                onClick={() => { onChange(''); setOpen(false) }}
                className="text-xs text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors"
              >
                Limpar
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
