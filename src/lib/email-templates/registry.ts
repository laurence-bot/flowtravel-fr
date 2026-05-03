import type { ComponentType } from 'react'

export interface TemplateEntry {
  component: ComponentType<any>
  subject: string | ((data: Record<string, any>) => string)
  displayName?: string
  previewData?: Record<string, any>
  to?: string
}

import { template as payrollMonthly } from './payroll-monthly'
import { template as contractToSign } from './contract-to-sign'
import { template as leaveDecision } from './leave-decision'

export const TEMPLATES: Record<string, TemplateEntry> = {
  'payroll-monthly': payrollMonthly,
  'contract-to-sign': contractToSign,
  'leave-decision': leaveDecision,
}
