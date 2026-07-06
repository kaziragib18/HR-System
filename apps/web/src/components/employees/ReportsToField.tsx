'use client'

import { useState, useEffect } from 'react'
import { useEmployeeSearch } from '@/lib/api/hooks/useDepartments'
import { Search, X, Check } from 'lucide-react'

export function ReportsToField({
  currentName,
  currentId,
  onChange,
}: {
  currentName: string
  currentId: string
  onChange: (id: string, name: string) => void
}) {
  const [query, setQuery] = useState(currentName)
  const [open, setOpen] = useState(false)
  const { data: results = [], isFetching } = useEmployeeSearch(query)

  useEffect(() => { setQuery(currentName) }, [currentName])

  return (
    <div className="relative">
      <label className="text-xs uppercase tracking-wide text-muted-foreground">Reports to</label>
      <div className="relative mt-0.5">
        <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <input
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          placeholder="Search employee…"
          className="h-8 w-full rounded border bg-background pl-7 pr-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        />
        {currentId && query && (
          <button
            onClick={() => { onChange('', ''); setQuery('') }}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>
      {open && query.trim().length > 0 && (
        <div className="absolute z-10 mt-1 w-full rounded-md border bg-background shadow-md">
          {isFetching ? (
            <p className="px-3 py-2 text-xs text-muted-foreground">Searching…</p>
          ) : results.length === 0 ? (
            <p className="px-3 py-2 text-xs text-muted-foreground">No results</p>
          ) : (
            <ul className="max-h-40 overflow-y-auto py-1">
              {results.map(e => (
                <li key={e.id}>
                  <button
                    onMouseDown={() => {
                      onChange(e.id, `${e.firstName} ${e.lastName}`)
                      setQuery(`${e.firstName} ${e.lastName}`)
                      setOpen(false)
                    }}
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-muted"
                  >
                    <span className="text-xs font-medium">{e.firstName} {e.lastName}</span>
                    {e.jobTitle && (
                      <span className="text-[10px] text-muted-foreground">· {e.jobTitle.name}</span>
                    )}
                    {e.id === currentId && <Check className="ml-auto h-3 w-3 text-primary" />}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
