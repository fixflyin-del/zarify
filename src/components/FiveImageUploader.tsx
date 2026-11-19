import React, { useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  CloudUpload,
  RefreshCw,
  Trash2,
  XCircle,
} from 'lucide-react';
import { deleteMediaFile, uploadMediaFile } from '../lib/mediaStorage';
import type { ProductImage } from '../types';

interface UploadTask {
  id: string;
  file: File;
  previewUrl: string;
  progress: number;
  status: 'uploading' | 'done' | 'failed';
  error?: string;
  uploadedUrl?: string;
  storagePath?: string;
}

interface FiveImageUploaderProps {
  images: ProductImage[];
  onChange: (next: ProductImage[]) => void;
  availableColors: string[];
  onUploadingChange?: (busy: boolean) => void;
}

const MAX_IMAGES = 5;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];
const MAX_SIZE_BYTES = 8 * 1024 * 1024;

export function FiveImageUploader({
  images,
  onChange,
  availableColors,
  onUploadingChange,
}: FiveImageUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [tasks, setTasks] = useState<UploadTask[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [storageNotice, setStorageNotice] = useState('');
  const [manualUrl, setManualUrl] = useState('');

  const processFiles = async (fileList: FileList | File[]) => {
    setStorageNotice('');
    const remainingSlots = MAX_IMAGES - images.length;
    if (remainingSlots <= 0) {
      setStorageNotice('Maximum 5 square product images reached. Remove or replace one first.');
      return;
    }

    const incoming = Array.from(fileList).slice(0, remainingSlots);
    const validFiles: File[] = [];
    for (const file of incoming) {
      if (!ALLOWED_TYPES.includes(file.type)) {
        setStorageNotice(`Skipped ${file.name}: Only JPG, PNG, WebP, or AVIF allowed.`);
        continue;
      }
      if (file.size > MAX_SIZE_BYTES) {
        setStorageNotice(`Skipped ${file.name}: Maximum file size is 8 MB.`);
        continue;
      }
      validFiles.push(file);
    }

    if (validFiles.length === 0) return;

    const initialTasks: UploadTask[] = validFiles.map((file, idx) => ({
      id: `${Date.now()}-${idx}-${file.name}`,
      file,
      previewUrl: URL.createObjectURL(file),
      progress: 0,
      status: 'uploading',
    }));

    setTasks(initialTasks);
    onUploadingChange?.(true);

    const completed: ProductImage[] = [];

    await Promise.all(
      initialTasks.map(async (task) => {
        try {
          const result = await uploadMediaFile(task.file, 'products', (pct) => {
            setTasks((prev) =>
              prev.map((t) => (t.id === task.id ? { ...t, progress: pct } : t))
            );
          });
          setTasks((prev) =>
            prev.map((t) =>
              t.id === task.id
                ? {
                    ...t,
                    progress: 100,
                    status: 'done',
                    uploadedUrl: result.url,
                    storagePath: result.storagePath,
                  }
                : t
            )
          );
          completed.push({
            url: result.url,
            storagePath: result.storagePath,
            altText: task.file.name.replace(/\.[^.]+$/, ''),
            colorName: '',
            sortOrder: images.length + completed.length,
          });
        } catch (err: any) {
          const msg = err?.message || 'Upload failed';
          setStorageNotice(msg);
          setTasks((prev) =>
            prev.map((t) =>
              t.id === task.id ? { ...t, status: 'failed', error: msg } : t
            )
          );
        }
      })
    );

    if (completed.length > 0) {
      onChange(
        [...images, ...completed]
          .slice(0, MAX_IMAGES)
          .map((img, i) => ({ ...img, sortOrder: i }))
      );
    }
    onUploadingChange?.(false);
  };

  const retryTask = async (task: UploadTask) => {
    try {
      setStorageNotice('');
      setTasks((prev) =>
        prev.map((t) =>
          t.id === task.id ? { ...t, status: 'uploading', progress: 0, error: '' } : t
        )
      );
      const result = await uploadMediaFile(task.file, 'products', (pct) => {
        setTasks((prev) =>
          prev.map((t) => (t.id === task.id ? { ...t, progress: pct } : t))
        );
      });
      setTasks((prev) =>
        prev.map((t) =>
          t.id === task.id
            ? {
                ...t,
                status: 'done',
                progress: 100,
                uploadedUrl: result.url,
                storagePath: result.storagePath,
              }
            : t
        )
      );
      onChange(
        [
          ...images,
          {
            url: result.url,
            storagePath: result.storagePath,
            altText: task.file.name.replace(/\.[^.]+$/, ''),
            colorName: '',
            sortOrder: images.length,
          },
        ]
          .slice(0, MAX_IMAGES)
          .map((img, i) => ({ ...img, sortOrder: i }))
      );
    } catch (err: any) {
      setStorageNotice(err?.message || 'Retry failed');
      setTasks((prev) =>
        prev.map((t) =>
          t.id === task.id ? { ...t, status: 'failed', error: err?.message } : t
        )
      );
    }
  };

  const moveImage = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= images.length) return;
    const copy = [...images];
    [copy[idx], copy[target]] = [copy[target], copy[idx]];
    onChange(copy.map((img, i) => ({ ...img, sortOrder: i })));
  };

  const removeImage = (idx: number) => {
    const removed = images[idx];
    if (removed?.storagePath) {
      void deleteMediaFile(removed.storagePath);
    }
    onChange(images.filter((_, i) => i !== idx).map((img, i) => ({ ...img, sortOrder: i })));
  };

  const addManualUrl = () => {
    if (!manualUrl.trim() || images.length >= MAX_IMAGES) return;
    onChange([
      ...images,
      {
        url: manualUrl.trim(),
        altText: `Product image ${images.length + 1}`,
        colorName: '',
        sortOrder: images.length,
      },
    ]);
    setManualUrl('');
  };

  const overallProgress =
    tasks.length > 0
      ? Math.round(tasks.reduce((sum, t) => sum + t.progress, 0) / tasks.length)
      : 0;
  const doneCount = tasks.filter((t) => t.status === 'done').length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold uppercase tracking-wider text-[#181326]">
          Product Gallery (5 Square 1:1 Images) — {images.length} / {MAX_IMAGES}
        </label>
        <span className="text-[11px] text-[#7E7394]">Firebase Storage · Drag &amp; drop up to 5 images</span>
      </div>

      {/* Drop Zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragActive(false);
          if (e.dataTransfer.files?.length) processFiles(e.dataTransfer.files);
        }}
        onClick={() => fileInputRef.current?.click()}
        className={`rounded-2xl border-2 border-dashed p-6 text-center cursor-pointer transition-colors ${
          dragActive
            ? 'border-[#FF4D8D] bg-[#FFF0F6]'
            : 'border-[#E6DDF5] bg-[#FAFAFF] hover:border-[#7C3AED]'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp,image/avif"
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) processFiles(e.target.files);
            e.target.value = '';
          }}
        />
        <CloudUpload className="w-7 h-7 mx-auto text-[#7C3AED] mb-2" />
        <p className="text-xs font-semibold text-[#181326]">
          Select or drag &amp; drop up to 5 square product images for Firebase Storage upload
        </p>
        <p className="text-[11px] text-[#7E7394] mt-1">
          JPG, PNG, WebP, AVIF · Max 8 MB each · Simultaneous uploads with live progress &amp; retry
        </p>
      </div>

      {/* Overall & Per-File Upload Progress */}
      {tasks.length > 0 && (
        <div className="bg-white rounded-2xl border border-[#EFE7F8] p-4 space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-[#181326]">Uploading to Firebase Storage</span>
            <span className="tabular-nums font-semibold text-[#7C3AED]">{overallProgress}%</span>
          </div>
          <div className="w-full h-2 rounded-full bg-[#F3EDFF] overflow-hidden">
            <div
              style={{ width: `${overallProgress}%` }}
              className="h-full bg-gradient-to-r from-[#FF4D8D] to-[#7C3AED] transition-all duration-150"
            />
          </div>
          <p className="text-[11px] text-[#5B526E] tabular-nums">
            {doneCount} of {tasks.length} Images Uploaded
          </p>

          <div className="space-y-2 pt-1">
            {tasks.map((task) => (
              <div
                key={task.id}
                className="flex items-center justify-between gap-3 text-xs border-t border-[#F4EFFC] pt-2"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <img
                    src={task.previewUrl}
                    alt={task.file.name}
                    className="w-8 h-8 rounded-lg object-cover border border-[#EFE7F8] shrink-0"
                  />
                  <span className="truncate text-[#181326]">{task.file.name}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {task.status === 'uploading' && (
                    <span className="tabular-nums text-[#7C3AED] font-semibold">{task.progress}%</span>
                  )}
                  {task.status === 'done' && (
                    <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Uploaded
                    </span>
                  )}
                  {task.status === 'failed' && (
                    <button
                      type="button"
                      onClick={() => retryTask(task)}
                      className="inline-flex items-center gap-1 text-rose-700 underline cursor-pointer"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      Retry
                      <RefreshCw className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {storageNotice && (
        <p className="text-xs text-[#9D174D] bg-[#FFF0F6] border border-[#FBCFE8] rounded-xl p-3">
          {storageNotice}
        </p>
      )}

      {/* Manual Studio/Firebase Image URL Entry */}
      {images.length < MAX_IMAGES && (
        <div className="flex gap-2">
          <input
            type="text"
            value={manualUrl}
            onChange={(e) => setManualUrl(e.target.value)}
            placeholder="Or paste Firebase Storage / studio image URL..."
            className="flex-1 px-3 py-2 text-xs rounded-xl bg-[#FAFAFF] border border-[#E6DDF5] outline-none focus:border-[#7C3AED]"
          />
          <button
            type="button"
            onClick={addManualUrl}
            className="px-4 py-2 text-xs font-semibold rounded-xl border border-[#181326] hover:bg-[#181326] hover:text-white transition-colors cursor-pointer"
          >
            Add URL
          </button>
        </div>
      )}

      {/* Preview, Reorder, Color-Link, and Remove Grid */}
      {images.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {images.map((img, idx) => (
            <div
              key={`${img.url}-${idx}`}
              className="bg-white rounded-xl border border-[#EFE7F8] p-2 space-y-2"
            >
              <div className="relative aspect-square rounded-lg bg-[#F5F0FF] overflow-hidden">
                <img
                  src={img.url}
                  alt={img.altText || `Slot ${idx + 1}`}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
                <span className="absolute top-1 left-1 bg-[#181326]/80 text-white text-[10px] px-1.5 py-0.5 rounded-md tabular-nums">
                  #{idx + 1}
                </span>
              </div>

              {availableColors.length > 0 && (
                <select
                  value={img.colorName || ''}
                  onChange={(e) => {
                    const copy = [...images];
                    copy[idx] = { ...copy[idx], colorName: e.target.value };
                    onChange(copy);
                  }}
                  className="w-full text-[10px] rounded-lg bg-[#FAFAFF] border border-[#E6DDF5] px-1.5 py-1"
                >
                  <option value="">All colours</option>
                  {availableColors.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              )}

              <div className="flex items-center justify-between pt-0.5">
                <div className="flex gap-1">
                  <button
                    type="button"
                    disabled={idx === 0}
                    onClick={() => moveImage(idx, -1)}
                    aria-label="Move left"
                    className="p-1 rounded-md border border-[#EFE7F8] disabled:opacity-30 cursor-pointer"
                  >
                    <ArrowLeft className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    disabled={idx === images.length - 1}
                    onClick={() => moveImage(idx, 1)}
                    aria-label="Move right"
                    className="p-1 rounded-md border border-[#EFE7F8] disabled:opacity-30 cursor-pointer"
                  >
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => removeImage(idx)}
                  aria-label="Remove image"
                  className="p-1 rounded-md text-rose-700 hover:bg-rose-50 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
