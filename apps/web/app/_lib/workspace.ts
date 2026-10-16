import type { ReactNode } from "react";
import type { PageName, PolicyState, Status } from "./api";

/** Shared actions and state handed to every workspace screen. */
export type Workspace = {
  busy: boolean;
  status: Status;
  policy: PolicyState;
  setPolicy: (policy: PolicyState) => void;
  run: (work: () => Promise<void>) => Promise<void>;
  call: <T = unknown>(op: string, input?: unknown) => Promise<T>;
  request: <T = unknown>(path: string, body?: unknown) => Promise<T>;
  refresh: () => Promise<void>;
  setPage: (page: PageName) => void;
  go: (page: PageName) => void;
  setMessage: (message: string) => void;
  signOut: () => void;
  /** Forget the local session after the server has already ended it. */
  clearSession: () => void;
  confirm: (options: {
    title: string;
    body: ReactNode;
    confirmLabel: string;
    tone?: "default" | "danger";
    phrase?: string;
  }) => Promise<string | null>;
};
