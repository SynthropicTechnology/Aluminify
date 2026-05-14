import { DashboardAnalyticsService } from './dashboard-analytics.service'
import { InstitutionAnalyticsService } from './institution-analytics.service'
import { ProfessorAnalyticsService } from './professor-analytics.service'
import { StudentEngagementService } from './student-engagement.service'

let _dashboardAnalyticsService: DashboardAnalyticsService | null = null
let _institutionAnalyticsService: InstitutionAnalyticsService | null = null
let _professorAnalyticsService: ProfessorAnalyticsService | null = null
let _studentEngagementService: StudentEngagementService | null = null

function getDashboardAnalyticsService(): DashboardAnalyticsService {
  if (!_dashboardAnalyticsService) {
    _dashboardAnalyticsService = new DashboardAnalyticsService()
  }
  return _dashboardAnalyticsService
}

function getInstitutionAnalyticsService(): InstitutionAnalyticsService {
  if (!_institutionAnalyticsService) {
    _institutionAnalyticsService = new InstitutionAnalyticsService()
  }
  return _institutionAnalyticsService
}

function getProfessorAnalyticsService(): ProfessorAnalyticsService {
  if (!_professorAnalyticsService) {
    _professorAnalyticsService = new ProfessorAnalyticsService()
  }
  return _professorAnalyticsService
}

function getStudentEngagementService(): StudentEngagementService {
  if (!_studentEngagementService) {
    _studentEngagementService = new StudentEngagementService()
  }
  return _studentEngagementService
}

export const dashboardAnalyticsService = new Proxy(
  {} as DashboardAnalyticsService,
  {
    get(_target, prop) {
      const service = getDashboardAnalyticsService()
      return service[prop as keyof DashboardAnalyticsService]
    },
  }
)

export const institutionAnalyticsService = new Proxy(
  {} as InstitutionAnalyticsService,
  {
    get(_target, prop) {
      const service = getInstitutionAnalyticsService()
      return service[prop as keyof InstitutionAnalyticsService]
    },
  }
)

export const professorAnalyticsService = new Proxy(
  {} as ProfessorAnalyticsService,
  {
    get(_target, prop) {
      const service = getProfessorAnalyticsService()
      return service[prop as keyof ProfessorAnalyticsService]
    },
  }
)

export const studentEngagementService = new Proxy(
  {} as StudentEngagementService,
  {
    get(_target, prop) {
      const service = getStudentEngagementService()
      return service[prop as keyof StudentEngagementService]
    },
  }
)

export {
  DashboardAnalyticsService,
  InstitutionAnalyticsService,
  ProfessorAnalyticsService,
  StudentEngagementService,
}













