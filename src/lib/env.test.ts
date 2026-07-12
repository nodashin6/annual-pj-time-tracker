import { describe, it, expect, afterEach, vi } from "vitest";
import { readEnv } from "./env";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("readEnv", () => {
  it("URL と ANON_KEY が揃えば configured=true", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://ref.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "a".repeat(40));
    const r = readEnv();
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.configured).toBe(true);
  });

  it("未設定なら ok だが configured=false（デモモード）", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");
    const r = readEnv();
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.configured).toBe(false);
  });

  it("URL 形式が不正なら ok=false", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "not-a-url");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "a".repeat(40));
    const r = readEnv();
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.issues.length).toBeGreaterThan(0);
  });

  it("ANON_KEY が短すぎると ok=false", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://ref.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "short");
    const r = readEnv();
    expect(r.ok).toBe(false);
  });
});
