/**
 * DB (snake_case) → アプリ型 (camelCase) の変換。
 * snake_case を書いてよいのはこのファイルと各スライスの書き込み部分だけ。
 */
import type {
  Worker,
  Pj,
  PjMember,
  Tracker,
  Issue,
  IssueStatus,
  Task,
  TaskEntry,
} from "../types";
import { ISSUE_STATUSES } from "../types";
import type {
  DbWorker,
  DbPj,
  DbPjMember,
  DbTracker,
  DbIssue,
  DbTask,
  DbTaskEntry,
} from "../supabase";

/** numeric 列は string で返ることがある。null/undefined は 0 に落とす。 */
export const num = (v: number | string | null | undefined): number =>
  v == null ? 0 : Number(v);

/** null を undefined に。0 や空文字は保つ。 */
const opt = <T>(v: T | null): T | undefined => (v === null ? undefined : v);

const optNum = (v: number | string | null): number | undefined =>
  v === null ? undefined : Number(v);

const toIssueStatus = (v: string): IssueStatus =>
  (ISSUE_STATUSES as readonly string[]).includes(v)
    ? (v as IssueStatus)
    : "open";

export const toWorker = (r: DbWorker): Worker => ({ id: r.id, name: r.name });

export const toPj = (r: DbPj): Pj => ({
  id: r.id,
  parentId: opt(r.parent_id),
  name: r.name,
  color: r.color,
  ownerWorkerId: opt(r.owner_worker_id),
  fiscalYear: opt(r.fiscal_year),
  budgetAmount: optNum(r.budget_amount),
});

export const toPjMember = (r: DbPjMember): PjMember => ({
  pjId: r.pj_id,
  workerId: r.worker_id,
});

export const toTracker = (r: DbTracker): Tracker => ({
  pjId: r.pj_id,
  startDate: opt(r.start_date),
  endDate: opt(r.end_date),
});

export const toIssue = (r: DbIssue): Issue => ({
  id: r.id,
  trackerPjId: r.tracker_pj_id,
  parentId: opt(r.parent_id),
  assigneeId: opt(r.assignee_id),
  title: r.title,
  dueDate: opt(r.due_date),
  status: toIssueStatus(r.status),
});

export const toTask = (r: DbTask): Task => ({
  id: r.id,
  trackerPjId: r.tracker_pj_id,
  issueId: opt(r.issue_id),
  assigneeId: r.assignee_id,
  title: r.title,
  startAt: r.start_at,
  endAt: r.end_at,
});

export const toTaskEntry = (r: DbTaskEntry): TaskEntry => ({
  id: r.id,
  taskId: r.task_id,
  year: r.year,
  month: r.month,
  hours: num(r.hours),
});
