'use client'

import { FileText, ExternalLink, Trash2, Upload } from 'lucide-react'

export function fmtSize(bytes?: number | null): string {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function AttachedFileRow({
  fileName,
  fileSize,
  onDownload,
  onRemove,
  removing,
}: {
  fileName: string
  fileSize?: number | null
  mimeType?: string | null
  onDownload: () => void
  onRemove?: () => void
  removing?: boolean
}) {
  return (
    <div className="flex items-center gap-2 rounded-md border bg-muted/30 px-2.5 py-1.5">
      <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1 truncate text-xs">{fileName}</span>
      {fileSize ? <span className="shrink-0 text-[10px] text-muted-foreground">{fmtSize(fileSize)}</span> : null}
      <button
        type="button"
        onClick={onDownload}
        className="shrink-0 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
        title="Download"
      >
        <ExternalLink className="h-3.5 w-3.5" />
      </button>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          disabled={removing}
          className="shrink-0 rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
          title="Remove"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  )
}

export function FileInputButton({
  label = 'Attach file',
  accept,
  onChange,
  disabled,
}: {
  label?: string
  accept?: string
  onChange: (file: File) => void
  disabled?: boolean
}) {
  return (
    <label className="flex w-fit cursor-pointer items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-muted disabled:opacity-50">
      <Upload className="h-3.5 w-3.5" />
      {label}
      <input
        type="file"
        accept={accept}
        disabled={disabled}
        className="hidden"
        onChange={e => {
          const file = e.target.files?.[0]
          if (file) onChange(file)
          e.target.value = ''
        }}
      />
    </label>
  )
}
