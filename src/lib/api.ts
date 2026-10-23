import { useEffect, useState } from "react";

const KEY = "smash-token";
const EMAIL = "smash-email";
const listeners = new Set<() => void>();

export const getToken = () => (typeof window === "undefined" ? null : localStorage.getItem(KEY));
export function setSession(token: string | null, email?: string) {
  if (token) {
    localStorage.setItem(KEY, token);
    if (email) localStorage.setItem(EMAIL, email);
  } else {
    localStorage.removeItem(KEY);
    localStorage.removeItem(EMAIL);
  }
  listeners.forEach((l) => l());
}

export function useAuth() {
  const [state, setState] = useState<{
    ready: boolean;
    token: string | null;
    email: string | null;
  }>({
    ready: false,
    token: null,
    email: null,
  });
  useEffect(() => {
    const read = () =>
      setState({ ready: true, token: getToken(), email: localStorage.getItem(EMAIL) });
    read();
    listeners.add(read);
    return () => void listeners.delete(read);
  }, []);
  return { ...state, isOrganizer: !!state.token };
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function api<T = any>(
  path: string,
  opts: { method?: string; body?: unknown } = {},
): Promise<T> {
  const token = getToken();
  const res = await fetch(`/api${path}`, {
    method: opts.method ?? (opts.body ? "POST" : "GET"),
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: opts.body ? JSON.stringify(opts.body) : null,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && token) setSession(null);
    throw new ApiError(res.status, data.error ?? "Something went wrong. Please try again.");
  }
  return data as T;
}
