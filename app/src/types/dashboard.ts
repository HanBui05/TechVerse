export type DashboardUsers = {
  total?: number
  active?: number
  locked?: number
  newLast7Days?: number
}

export type DashboardAuthors = {
  approved?: number
  suspended?: number
  pendingApplications?: number
}

export type DashboardContent = {
  articles?: number
  courses?: number
  exerciseSets?: number
  interviewQuestions?: number
  forumQuestions?: number
}

export type DashboardOrders = {
  awaitingConfirmation?: number
  needsReconciliation?: number
}

export type DashboardRevenuePeriod = {
  paidOrders?: number
  grossAmount?: number
  platformAmount?: number
  authorAmount?: number
}

export type DashboardRevenue = {
  allTime?: DashboardRevenuePeriod
  last30Days?: DashboardRevenuePeriod
}

export type AdminDashboard = {
  users?: DashboardUsers
  authors?: DashboardAuthors
  content?: DashboardContent
  orders?: DashboardOrders
  revenue?: DashboardRevenue
}

export type DashboardPending = {
  articles?: number
  courses?: number
  exerciseSets?: number
  interviewQuestions?: number
}

export type DashboardReports = {
  open?: number
  hiddenPosts?: number
}

export type ModeratorDashboard = {
  pending?: DashboardPending
  reports?: DashboardReports
}
