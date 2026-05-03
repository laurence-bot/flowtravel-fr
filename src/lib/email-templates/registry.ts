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
import { template as bulletinToSign } from './bulletin-to-sign'
import { template as bulletinSigned } from './bulletin-signed'
import { template as bulletinRelance } from './bulletin-relance'
import { template as agentEvent } from './agent-event'
import { template as acompteRelance } from './acompte-relance'

export const TEMPLATES: Record<string, TemplateEntry> = {
  'payroll-monthly': payrollMonthly,
  'contract-to-sign': contractToSign,
  'leave-decision': leaveDecision,
  'bulletin-to-sign': bulletinToSign,
  'bulletin-signed': bulletinSigned,
  'bulletin-relance': bulletinRelance,
  'agent-event': agentEvent,
  'acompte-relance': acompteRelance,
}
