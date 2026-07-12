"use client";

/**
 * 軽量トースト通知ストア。
 * ストア/フォームからの成功・失敗を UI へ非侵襲に伝える。
 * React 外（zustand ストアのアクション内）からも push できるよう
 * getState() 経由のヘルパ（notify）を用意する。
 */
import { create } from "zustand";

export type ToastKind = "success" | "error" | "info";

export type Toast = {
  id: string;
  kind: ToastKind;
  message: string;
};

type NotifyState = {
  toasts: Toast[];
  push: (kind: ToastKind, message: string) => void;
  dismiss: (id: string) => void;
};

let seq = 0;
const nextId = () => `t${++seq}`;

export const useNotify = create<NotifyState>((set) => ({
  toasts: [],
  push: (kind, message) =>
    set((s) => ({ toasts: [...s.toasts, { id: nextId(), kind, message }] })),
  dismiss: (id) =>
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

/** React 外から呼べる薄いヘルパ。 */
export const notify = {
  success: (message: string) => useNotify.getState().push("success", message),
  error: (message: string) => useNotify.getState().push("error", message),
  info: (message: string) => useNotify.getState().push("info", message),
};
