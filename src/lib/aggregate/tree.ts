/**
 * pj ツリーに対する純関数。コア層のみを扱う。
 *
 * このファイルは実績拡張層（TaskEntry / progress.ts）を import しない。
 * 依存の向きは aggregate/layering.test.ts が固定している。
 */
import type { Pj, PjMember, Tracker } from "../types";

/** 循環していた場合の打ち切り上限。 */
const MAX_DEPTH = 1000;

/**
 * 契約（受注）ノードか。
 * fiscalYear / budgetAmount の有無で判定する規則が存在してよいのはここだけ。
 * UI から `pj.fiscalYear != null` を直接書かないこと。
 */
export const isContractNode = (pj: Pj): boolean =>
  pj.fiscalYear != null || pj.budgetAmount != null;

export const contractNodes = (pjs: Pj[]): Pj[] => pjs.filter(isContractNode);

/** 葉か。tracker 行の存在がすべて。 */
export const isLeaf = (pjId: string, trackers: Tracker[]): boolean =>
  trackers.some((t) => t.pjId === pjId);

export const leafPjs = (pjs: Pj[], trackers: Tracker[]): Pj[] =>
  pjs.filter((p) => isLeaf(p.id, trackers));

/** 直下の子。parentId に undefined を渡すとルートノードを返す。 */
export const childrenOf = (parentId: string | undefined, pjs: Pj[]): Pj[] =>
  pjs.filter((p) => p.parentId === parentId);

/** 自分自身を含む子孫の id。 */
export function descendantIds(pjId: string, pjs: Pj[]): string[] {
  const out: string[] = [];
  const queue = [pjId];
  const seen = new Set<string>();
  while (queue.length > 0) {
    const id = queue.shift() as string;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(id);
    for (const child of pjs) {
      if (child.parentId === id) queue.push(child.id);
    }
  }
  return out;
}

/** 祖先の id を近い順に。自分は含まない。循環・親欠落でも停止する。 */
export function ancestorIds(pjId: string, pjs: Pj[]): string[] {
  const byId = new Map(pjs.map((p) => [p.id, p]));
  const out: string[] = [];
  const seen = new Set<string>([pjId]);
  let cur = byId.get(pjId)?.parentId;
  let hops = 0;
  while (cur != null && !seen.has(cur) && hops < MAX_DEPTH) {
    const node = byId.get(cur);
    if (!node) break;
    out.push(node.id);
    seen.add(node.id);
    cur = node.parentId;
    hops += 1;
  }
  return out;
}

/** ルートから自分までのパス。パンくず表示用。 */
export function breadcrumb(pjId: string, pjs: Pj[]): Pj[] {
  const byId = new Map(pjs.map((p) => [p.id, p]));
  const self = byId.get(pjId);
  if (!self) return [];
  const chain = ancestorIds(pjId, pjs)
    .map((id) => byId.get(id))
    .filter((p): p is Pj => p != null)
    .reverse();
  return [...chain, self];
}

/**
 * 有効メンバー = 自ノード + 全祖先の和集合。
 * task の担当者候補はこれで絞る。DB トリガにはしない（メンバーを外した瞬間に
 * 既存 task が更新不能になるため）。
 */
export function effectiveMembers(
  pjId: string,
  pjs: Pj[],
  members: PjMember[]
): string[] {
  const scope = new Set([pjId, ...ancestorIds(pjId, pjs)]);
  const out = new Set<string>();
  for (const m of members) {
    if (scope.has(m.pjId)) out.add(m.workerId);
  }
  return Array.from(out);
}
