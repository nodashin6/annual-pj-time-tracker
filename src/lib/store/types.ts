export type Status = "idle" | "loading" | "ready" | "unconfigured" | "error";

/** どのスライスにも属さない共有状態。 */
export type Shared = {
  year: number;
  status: Status;
  error: string | null;
  loaded: boolean;
  setYear: (year: number) => void;
  load: () => Promise<void>;
};
