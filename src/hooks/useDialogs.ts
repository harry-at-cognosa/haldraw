import { useRef, useState, useCallback } from 'react';
import type { PromptRequest } from '@/panels/PromptModal';

export function useDialogs() {
  const [request, setRequest] = useState<PromptRequest | null>(null);
  const resolverRef = useRef<((v: string | boolean | null) => void) | null>(null);

  const ask = useCallback(
    (req: Omit<PromptRequest, 'kind'> & { kind: 'prompt' }) =>
      new Promise<string | null>((resolve) => {
        setRequest({ ...req });
        resolverRef.current = (v) => resolve((v as string) ?? null);
      }),
    []
  );

  const confirm = useCallback(
    (req: Omit<PromptRequest, 'kind'> & { kind: 'confirm' }) =>
      new Promise<boolean>((resolve) => {
        setRequest({ ...req });
        resolverRef.current = (v) => resolve(Boolean(v));
      }),
    []
  );

  const onResolve = (v: string | boolean | null) => {
    resolverRef.current?.(v);
    resolverRef.current = null;
    setRequest(null);
  };

  return { request, ask, confirm, onResolve };
}
