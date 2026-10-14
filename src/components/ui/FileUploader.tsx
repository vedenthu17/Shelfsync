import { useId, useRef, useState, type DragEvent } from 'react';
import { UploadCloud, X } from 'lucide-react';
import { cn, readFileAsDataUrl } from '@/lib/utils';

export interface FileUploaderProps {
  label?: string;
  /** Data URLs of the selected images. */
  value: string[];
  onChange: (images: string[]) => void;
  multiple?: boolean;
  maxFiles?: number;
  hint?: string;
}

const MAX_BYTES = 1.5 * 1024 * 1024;

export function FileUploader({ label, value, onChange, multiple = true, maxFiles = 4, hint }: FileUploaderProps) {
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState('');

  const addFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setError('');
    const images = Array.from(files).filter((f) => f.type.startsWith('image/'));
    if (images.length < files.length) setError('Only image files can be attached.');
    const small = images.filter((f) => f.size <= MAX_BYTES);
    if (small.length < images.length) setError('Images must be 1.5 MB or smaller.');
    const urls = await Promise.all(small.map(readFileAsDataUrl));
    const next = multiple ? [...value, ...urls].slice(0, maxFiles) : urls.slice(0, 1);
    onChange(next);
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    void addFiles(e.dataTransfer.files);
  };

  const full = multiple ? value.length >= maxFiles : false;

  return (
    <div>
      {label && (
        <label htmlFor={id} className="mb-1.5 block text-[13px] font-medium text-slate-700">
          {label}
        </label>
      )}
      {!full && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={cn(
            'flex flex-col items-center rounded-lg border border-dashed px-4 py-5 text-center transition-colors',
            dragging ? 'border-brand-500 bg-brand-50' : 'border-slate-300 bg-slate-50/60',
          )}
        >
          <UploadCloud className="h-6 w-6 text-slate-400" aria-hidden />
          <p className="mt-1.5 text-sm text-slate-600">
            Drag images here or{' '}
            <button type="button" className="font-medium text-brand-700 hover:underline" onClick={() => inputRef.current?.click()}>
              browse
            </button>
          </p>
          <p className="mt-0.5 text-xs text-slate-500">{hint ?? `PNG or JPG, up to 1.5 MB${multiple ? ` · max ${maxFiles}` : ''}`}</p>
          <input
            ref={inputRef}
            id={id}
            type="file"
            accept="image/*"
            multiple={multiple}
            className="sr-only"
            onChange={(e) => {
              void addFiles(e.target.files);
              e.target.value = '';
            }}
          />
        </div>
      )}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      {value.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-2">
          {value.map((src, i) => (
            <li key={i} className="group relative h-20 w-20 overflow-hidden rounded-lg border border-slate-200">
              <img src={src} alt={`Attachment ${i + 1}`} className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={() => onChange(value.filter((_, idx) => idx !== i))}
                className="absolute right-1 top-1 rounded-full bg-slate-900/70 p-0.5 text-white hover:bg-slate-900"
                aria-label={`Remove attachment ${i + 1}`}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
