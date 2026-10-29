'use client';

import { useEffect, useState } from 'react';
import { Textarea } from '@/components/ui/textarea';

/** Practice writing is local to this browser and exact published revision. */
export function AuthoredNotes({ storageKey, label }: { storageKey: string; label: string }) {
  const [text, setText] = useState('');
  const [storageAvailable, setStorageAvailable] = useState(true);
  useEffect(() => {
    try { setText(localStorage.getItem(storageKey) ?? ''); } catch { setStorageAvailable(false); }
  }, [storageKey]);
  return <div className="space-y-2">
    <label htmlFor={storageKey} className="text-sm font-medium">{label}</label>
    <Textarea id={storageKey} rows={4} value={text} onChange={e => { setText(e.target.value); try { localStorage.setItem(storageKey, e.target.value); } catch { setStorageAvailable(false); } }} />
    <p className="text-xs text-ink-muted">{storageAvailable ? 'Your writing is saved in this browser. It is not submitted or graded.' : 'Browser storage is unavailable. Copy your writing before leaving this page.'}</p>
  </div>;
}
