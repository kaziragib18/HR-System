import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PayrollStatus } from '@hr-system/types'

const { payrollRunFindUnique, payrollRunUpdate } = vi.hoisted(() => ({
  payrollRunFindUnique: vi.fn(),
  payrollRunUpdate: vi.fn(async () => ({})),
}))

vi.mock('../../config/prisma', () => ({
  prisma: {
    payrollRun: {
      findUnique: payrollRunFindUnique,
      update: payrollRunUpdate,
    },
  },
}))

import { processRun, PayrollError } from './payroll.service'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('processRun — tax-engine guard', () => {
  it('rejects with a clean 400 for an office code the tax engine has no logic for, before mutating anything', async () => {
    payrollRunFindUnique.mockResolvedValue({
      id: 'run-1',
      status: PayrollStatus.DRAFT,
      officeId: 'office-us',
      office: { id: 'office-us', code: 'US', name: 'PEN Global US' },
    })

    await expect(processRun('run-1')).rejects.toMatchObject({ status: 400 })
    await expect(processRun('run-1')).rejects.toBeInstanceOf(PayrollError)
    expect(payrollRunUpdate).not.toHaveBeenCalled()
  })

  it('proceeds past the guard (reaches the status update) for a supported office code', async () => {
    payrollRunFindUnique.mockResolvedValue({
      id: 'run-2',
      status: PayrollStatus.DRAFT,
      officeId: 'office-bd',
      office: { id: 'office-bd', code: 'BD', name: 'PEN Global Bangladesh' },
    })

    // No employee/salary mocks are set up, so processRun will throw once it
    // gets past the guard and tries prisma.employee.findMany — that's fine,
    // this test only asserts the guard didn't block a supported office code.
    await expect(processRun('run-2')).rejects.not.toMatchObject({
      message: expect.stringContaining('tax calculation'),
    })
    expect(payrollRunUpdate).toHaveBeenCalledWith({ where: { id: 'run-2' }, data: { status: PayrollStatus.PROCESSING } })
  })
})
