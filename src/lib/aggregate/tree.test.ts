import { describe, it, expect } from "vitest";
import type { Pj, PjMember, Tracker } from "../types";
import {
  isContractNode,
  isLeaf,
  leafPjs,
  childrenOf,
  descendantIds,
  ancestorIds,
  breadcrumb,
  effectiveMembers,
  contractNodes,
} from "./tree";

const pj = (id: string, parentId?: string, extra: Partial<Pj> = {}): Pj => ({
  id,
  parentId,
  name: id,
  color: "#6366f1",
  ...extra,
});

//  客 ─ 受注 ─ サブ ─ 葉1
//              └───── 葉2
//  孤立（親IDが存在しないノード）
const PJS: Pj[] = [
  pj("客"),
  pj("受注", "客", { fiscalYear: 2026, budgetAmount: 1000 }),
  pj("サブ", "受注"),
  pj("葉1", "サブ"),
  pj("葉2", "サブ"),
  pj("孤立", "存在しない親"),
];

const TRACKERS: Tracker[] = [{ pjId: "葉1" }, { pjId: "葉2" }];

describe("isContractNode", () => {
  it("fiscalYear だけでも契約ノード", () => {
    expect(isContractNode(pj("x", undefined, { fiscalYear: 2026 }))).toBe(true);
  });

  it("budgetAmount だけでも契約ノード", () => {
    expect(isContractNode(pj("x", undefined, { budgetAmount: 1 }))).toBe(true);
  });

  it("budgetAmount が 0 でも契約ノード（未入力と区別する）", () => {
    expect(isContractNode(pj("x", undefined, { budgetAmount: 0 }))).toBe(true);
  });

  it("どちらも無ければ契約ノードではない", () => {
    expect(isContractNode(pj("x"))).toBe(false);
  });
});

describe("isLeaf / leafPjs", () => {
  it("tracker がある pj が葉", () => {
    expect(isLeaf("葉1", TRACKERS)).toBe(true);
    expect(isLeaf("サブ", TRACKERS)).toBe(false);
  });

  it("葉の一覧を返す", () => {
    expect(leafPjs(PJS, TRACKERS).map((p) => p.id)).toEqual(["葉1", "葉2"]);
  });

  it("tracker が空なら葉はゼロ", () => {
    expect(leafPjs(PJS, [])).toEqual([]);
  });
});

describe("childrenOf", () => {
  it("直下の子だけを返す", () => {
    expect(childrenOf("サブ", PJS).map((p) => p.id)).toEqual(["葉1", "葉2"]);
  });

  it("undefined でルートノードを返す", () => {
    expect(childrenOf(undefined, PJS).map((p) => p.id)).toEqual(["客"]);
  });
});

describe("descendantIds", () => {
  it("自分自身を含む（深さ3以上を辿る）", () => {
    expect(descendantIds("客", PJS).sort()).toEqual(
      ["サブ", "受注", "客", "葉1", "葉2"].sort()
    );
  });

  it("葉なら自分だけ", () => {
    expect(descendantIds("葉1", PJS)).toEqual(["葉1"]);
  });
});

describe("ancestorIds", () => {
  it("近い順に祖先を返す。自分は含まない", () => {
    expect(ancestorIds("葉1", PJS)).toEqual(["サブ", "受注", "客"]);
  });

  it("ルートなら空", () => {
    expect(ancestorIds("客", PJS)).toEqual([]);
  });

  it("親IDが存在しないノードでも無限ループしない", () => {
    expect(ancestorIds("孤立", PJS)).toEqual([]);
  });

  it("循環していても無限ループせず打ち切る", () => {
    const cyclic: Pj[] = [pj("a", "b"), pj("b", "a")];
    expect(ancestorIds("a", cyclic).length).toBeLessThanOrEqual(2);
  });
});

describe("breadcrumb", () => {
  it("ルートから自分までを順に返す", () => {
    expect(breadcrumb("葉1", PJS).map((p) => p.id)).toEqual([
      "客",
      "受注",
      "サブ",
      "葉1",
    ]);
  });
});

describe("effectiveMembers", () => {
  const MEMBERS: PjMember[] = [
    { pjId: "受注", workerId: "w1" },
    { pjId: "サブ", workerId: "w2" },
    { pjId: "葉1", workerId: "w1" },
    { pjId: "葉1", workerId: "w3" },
  ];

  it("自ノード + 全祖先の和集合を返す", () => {
    expect(effectiveMembers("葉1", PJS, MEMBERS).sort()).toEqual([
      "w1",
      "w2",
      "w3",
    ]);
  });

  it("重複を排除する", () => {
    const ids = effectiveMembers("葉1", PJS, MEMBERS);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("祖先にしかいないメンバーも継承する", () => {
    expect(effectiveMembers("葉2", PJS, MEMBERS).sort()).toEqual(["w1", "w2"]);
  });
});

describe("contractNodes", () => {
  it("契約ノードだけを抜き出す", () => {
    expect(contractNodes(PJS).map((p) => p.id)).toEqual(["受注"]);
  });
});
