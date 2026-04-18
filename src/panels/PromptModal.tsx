import { useEffect, useRef, useState } from 'react';

export type PromptRequest = {
  title: string;
  placeholder?: string;
  initial?: string;
  confirmLabel?: string;
  destructive?: boolean;
  kind: 'prompt' | 'confirm';
  message?: string;
};

type Props = {
  request: PromptRequest | null;
  onResolve: (value: string | boolean | null) => void;
};

export default function PromptModal({ request, onResolve }: Props) {
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (request?.kind === 'prompt') {
      setValue(request.initial ?? '');
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 10);
    }
  }, [request]);

  if (!request) return null;

  const confirm = () => {
    if (request.kind === 'prompt') {
      const trimmed = value.trim();
      if (!trimmed) return;
      onResolve(trimmed);
    } else {
      onResolve(true);
    }
  };
  const cancel = () => onResolve(request.kind === 'prompt' ? null : false);

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
      onClick={cancel}
    >
      <div
        className="w-[420px] max-w-[92%] bg-panel border border-border rounded-xl shadow-panel p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-sm font-semibold mb-1">{request.title}</div>
        {request.message ? (
          <div className="text-sm text-fg-muted mb-3">{request.message}</div>
        ) : null}
        {request.kind === 'prompt' ? (
          <input
            ref={inputRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                confirm();
              } else if (e.key === 'Escape') {
                e.preventDefault();
                cancel();
              }
              e.stopPropagation();
            }}
            placeholder={request.placeholder}
            className="w-full bg-canvas rounded-md px-3 py-2 border border-border outline-none focus:border-accent text-sm"
          />
        ) : null}
        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={cancel}
            className="px-3 h-8 rounded-md text-fg-muted hover:bg-panel-hover text-sm"
          >
            Cancel
          </button>
          <button
            onClick={confirm}
            className={`px-3 h-8 rounded-md text-white text-sm font-medium ${
              request.destructive ? 'bg-red-500 hover:bg-red-600' : 'bg-accent hover:opacity-90'
            }`}
          >
            {request.confirmLabel ?? (request.kind === 'prompt' ? 'Create' : 'Confirm')}
          </button>
        </div>
      </div>
    </div>
  );
}
