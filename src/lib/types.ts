export type Team = {
  id: string;
  name: string;
};

/**
 * ワーカー（作業者）。assignments でプロジェクトへ直接アサインする。
 * 稼働キャパは持たない（本システムはプロジェクト工数の充足が主眼）。
 */
export type Worker = {
  id: string;
  name: string;
};

export type Client = {
  id: string;
  name: string;
};

/**
 * 受注（order）: 顧客からの受注。複数年度にまたがるプロジェクトを束ねる契約単位。
 * 1つの受注が N 個の細分化されたプロジェクトを持つ。
 */
export type Order = {
  id: string;
  clientId?: string;
  name: string;
  /** 会計年度（受注の基点） */
  fiscalYear?: number;
  /** 社内担当ワーカー */
  ownerWorkerId?: string;
  /** 当初工数（受注時点の初期見積, 時間） */
  initialHours: number;
  /** 予定工数（現時点の予定, 時間） */
  plannedHours: number;
  /** 予算（金額） */
  budgetAmount?: number;
};

/** プロジェクト: 受注を細分化した作業単位。1チームが担当する。 */
export type Project = {
  id: string;
  orderId: string;
  teamId?: string;
  name: string;
  /** グラフ表示用のカラー（HEX） */
  color: string;
  /** 当初工数（プロジェクト固有の初期見積, 時間）。受注や他PJとは独立。 */
  initialHours: number;
  /** 予定工数（プロジェクト固有の現時点の予定, 時間） */
  plannedHours: number;
};

/** マイルストーン（プロジェクトの区間）。日付で区間を指定する（メンバー非依存）。 */
export type Milestone = {
  id: string;
  projectId: string;
  name?: string;
  /** 区間開始日（YYYY-MM-DD） */
  startDate: string;
  /** 区間終了日（YYYY-MM-DD） */
  endDate: string;
};

/**
 * アサインメント（worker × project の多対多）。
 * worker をプロジェクトへ直接アサインする。担当チームの全員が自動参加ではなく、一部を割り当てる。
 * 将来 role / allocationPct などを足せる拡張ポイント。
 */
export type Assignment = {
  id: string;
  workerId: string;
  projectId: string;
};

/**
 * アチーブメント（アサイン × マイルストーンの許容工数）。
 * 「あるメンバー(assignment)がその区間(milestone)でどれだけ働いてよいか」を表す。
 */
export type Achievement = {
  id: string;
  assignmentId: string;
  milestoneId: string;
  /** 働いてよい上限工数（時間） */
  allowedHours: number;
};

/**
 * 工数エントリ: あるワーカーが、ある年月に、あるプロジェクトへ投下した時間。
 * 月単位で管理する（年間稼働の集計が主目的のため）。
 */
export type Entry = {
  id: string;
  workerId: string;
  projectId: string;
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
