import { Icon } from '@iconify/react'
import dayjs from 'dayjs'
import { DateInput } from 'lifeforge-ui'
import { useState } from 'react'

interface DateRangeCalendarProps {
  dateFrom: string
  dateTo: string
  defaultLabel: string
  onDateFromChange: (value: string) => void
  onDateToChange: (value: string) => void
}

function DateRangeCalendar({
  dateFrom,
  dateTo,
  defaultLabel,
  onDateFromChange,
  onDateToChange
}: DateRangeCalendarProps) {
  const [month, setMonth] = useState(() => {
    const initialDate = dateFrom || dateTo
    const parsed = initialDate ? dayjs(initialDate) : dayjs()

    return parsed.isValid() ? parsed : dayjs()
  })

  const startOfMonth = month.startOf('month')
  const firstGridDay = startOfMonth.startOf('week')
  const parsedStart = dateFrom ? dayjs(dateFrom) : null
  const parsedEnd = dateTo ? dayjs(dateTo) : null
  const selectedStart = parsedStart?.isValid() ? parsedStart : null
  const selectedEnd = parsedEnd?.isValid() ? parsedEnd : null
  const days = Array.from({ length: 42 }, (_, index) => firstGridDay.add(index, 'day'))

  const selectDay = (value: dayjs.Dayjs) => {
    const formatted = value.format('YYYY-MM-DD')

    if (!selectedStart || selectedEnd) {
      onDateFromChange(formatted)
      onDateToChange('')
      return
    }

    if (value.isBefore(selectedStart, 'day')) {
      onDateFromChange(formatted)
      onDateToChange(selectedStart.format('YYYY-MM-DD'))
      return
    }

    onDateToChange(formatted)
  }

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-bg-500/10 bg-component-bg p-3">
        <div className="mb-3 flex items-center justify-between gap-2">
          <button
            className="hover:bg-component-bg-lighter flex size-8 items-center justify-center rounded-lg transition-colors"
            type="button"
            onClick={() => setMonth(current => current.subtract(1, 'month'))}
          >
            <Icon className="size-4" icon="tabler:chevron-left" />
          </button>
          <span className="text-sm font-semibold">{month.format('MMMM YYYY')}</span>
          <button
            className="hover:bg-component-bg-lighter flex size-8 items-center justify-center rounded-lg transition-colors"
            type="button"
            onClick={() => setMonth(current => current.add(1, 'month'))}
          >
            <Icon className="size-4" icon="tabler:chevron-right" />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-semibold text-bg-400">
          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => (
            <span key={`${day}-${index}`}>{day}</span>
          ))}
        </div>

        <div className="mt-1 grid grid-cols-7 gap-1">
          {days.map(day => {
            const inMonth = day.isSame(month, 'month')
            const isStart = selectedStart?.isSame(day, 'day')
            const isEnd = selectedEnd?.isSame(day, 'day')
            const inRange =
              selectedStart &&
              selectedEnd &&
              day.isAfter(selectedStart, 'day') &&
              day.isBefore(selectedEnd, 'day')

            return (
              <button
                key={day.format('YYYY-MM-DD')}
                className={`flex aspect-square items-center justify-center rounded-lg text-xs transition-colors ${
                  isStart || isEnd
                    ? 'bg-custom-500 text-white'
                    : inRange
                      ? 'bg-custom-500/10 text-custom-500'
                      : inMonth
                        ? 'hover:bg-component-bg-lighter text-bg'
                        : 'text-bg-300'
                }`}
                type="button"
                onClick={() => selectDay(day)}
              >
                {day.date()}
              </button>
            )
          })}
        </div>
      </div>

      <div className="grid gap-2">
        <DateInput
          icon="tabler:calendar-event"
          label="Start date"
          value={dateFrom ? dayjs(dateFrom).toDate() : null}
          onChange={value => {
            const next = value ? dayjs(value).format('YYYY-MM-DD') : ''
            onDateFromChange(next)
            if (next && dayjs(next).isValid()) setMonth(dayjs(next))
          }}
        />
        <DateInput
          icon="tabler:calendar-check"
          label="End date"
          value={dateTo ? dayjs(dateTo).toDate() : null}
          onChange={value => {
            const next = value ? dayjs(value).format('YYYY-MM-DD') : ''
            onDateToChange(next)
            if (next && dayjs(next).isValid()) setMonth(dayjs(next))
          }}
        />
      </div>

      <div className="text-bg-500 rounded-lg bg-component-bg px-3 py-2 text-xs">
        {defaultLabel}
      </div>
    </div>
  )
}

export default DateRangeCalendar
