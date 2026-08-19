// ========== コア層 ==========
// この層は工数を一切知らない。実績拡張層を削除しても成立する。

/** ワーカー（作業者）。pj_members で pj へアサインする。 */
export type Worker = {
  id: string;
  name: string;
};

/**
 * pj: 顧客・受注・プロジェクトを統合した再帰ツリーのノード。
 * fiscalYear / budgetAmount が入っているノードを「契約単位（受注）」とみなす。
 * 判定は aggregate/tree.ts の isContractNode() でのみ行う。
 */
export type Pj = {
  id: string;
  parentId?: string;
  name: string;
  /** グラフ表示用のカラー（HEX） */
  color: string;
  ownerWorkerId?: string;
  fiscalYear?: number;
  budgetAmount?: number;
};

export type PjMember = {
  pjId: string;
  workerId: string;
};

/**
 * tracker: 「この pj は葉である」という事実そのもの。旧 milestones の吸収先。
 * 行の存在が葉の定義であり、kind のような宣言フラグは持たない。
 */
export type Tracker = {
  pjId: string;
  /** YYYY-MM-DD */
  startDate?: string;
  /** YYYY-MM-DD */
  endDate?: string;
};

/** issue: GitHub issue 相当。階層あり・期日あり・担当者は宙ぶらりん可。 */
export type Issue = {
  id: string;
  trackerPjId: string;
  parentId?: string;
  assigneeId?: string;
  title: string;
  /** YYYY-MM-DD */
  dueDate?: string;
  status: IssueStatus;
};

export const ISSUE_STATUSES = ["open", "closed"] as const;
export type IssueStatus = (typeof ISSUE_STATUSES)[number];

/**
 * task: Google Calendar のイベント相当。階層なし・時刻付き期間・担当者1名必須。
 * 予定工数は期間から導出するため、工数の項目を持たない。
 */
export type Task = {
  id: string;
  trackerPjId: string;
  issueId?: string;
  assigneeId: string;
  title: string;
  /** ISO8601 */
  startAt: string;
  /** ISO8601 */
  endAt: string;
};

// ========== 実績拡張層 ==========
// コア層を一方向に参照する。担当者は task.assigneeId から引くため持たない。

export type TaskEntry = {
  id: string;
  taskId: string;
  year: number;
  /** 1-12 */
  month: number;
  hours: number;
};

export const MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;

export const MONTH_LABELS = [
  "1月",
  "2月",
  "3月",
  "4月",
  "5月",
  "6月",
  "7月",
  "8月",
  "9月",
  "10月",
  "11月",
  "12月",
] as const;
