'use client'

import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@/lib/api/client'
import { Card, Spinner } from '@/components/ui/primitives'
import { FileText, ShieldCheck, Coins, Award, Download } from 'lucide-react'

interface ComplianceDoc {
  id: string
  title: string
  description?: string | null
  mimeType?: string | null
  fileSize?: number | null
  createdAt: string
}

export function ComplianceDocsCard() {
  const { data: docs = [], isLoading } = useQuery({
    queryKey: ['compliance-docs'],
    queryFn: async () => {
      const { data } = await apiClient.get('/company/compliance-docs')
      return data.data as ComplianceDoc[]
    },
  })

  async function handleDownload(id: string) {
    const { data } = await apiClient.get(`/company/compliance-docs/${id}/download-url`)
    window.open(data.data.downloadUrl, '_blank')
  }

  function fmtSize(bytes?: number | null) {
    if (!bytes) return ''
    if (bytes < 1024 * 1024) return ` · ${(bytes / 1024).toFixed(0)} KB`
    return ` · ${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  if (!isLoading && docs.length === 0) {
    return (
      <Card>
        <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Compliance &amp; Policy Documents
        </p>
        <div className="max-h-[190px] space-y-1 overflow-y-auto overflow-x-hidden scrollbar-thin pr-1">
          {[
            { icon: FileText,    title: 'Leave & attendance policy',      desc: 'Encashment, carry-forward, WFH' },
            { icon: ShieldCheck, title: 'Code of conduct & IT security',  desc: 'Data handling, device use' },
            { icon: Coins,       title: 'Payroll & tax policy',           desc: 'Payslip schedule, TDS rules' },
            { icon: Award,       title: 'Performance & appraisal',        desc: 'KPI framework, review cycle' },
          ].map((p) => (
            <div key={p.title} className="flex items-start gap-2 border-b py-2 last:border-0">
              <p.icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <div>
                <p className="text-sm font-medium leading-tight">{p.title}</p>
                <p className="text-[11px] text-muted-foreground">{p.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </Card>
    )
  }

  return (
    <Card>
      <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Compliance &amp; Policy Documents
      </p>
      {isLoading ? (
        <Spinner />
      ) : (
        <div className="max-h-[190px] space-y-1 overflow-y-auto overflow-x-hidden scrollbar-thin pr-1">
          {docs.map((doc) => (
            <div
              key={doc.id}
              onClick={() => handleDownload(doc.id)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  handleDownload(doc.id)
                }
              }}
              className="-mx-2 flex cursor-pointer items-center gap-2 rounded-md border-b px-2 py-2 last:border-0 hover:bg-muted/50"
            >
              <FileText className="h-4 w-4 shrink-0 text-primary" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{doc.title}</p>
                {doc.description && (
                  <p className="truncate text-[11px] text-muted-foreground">{doc.description}</p>
                )}
                <p className="text-[10px] text-muted-foreground">
                  {new Date(doc.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                  {fmtSize(doc.fileSize)}
                </p>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  handleDownload(doc.id)
                }}
                className="shrink-0 rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                title="Download"
              >
                <Download className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}
