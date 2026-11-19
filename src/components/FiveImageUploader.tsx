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
import { apiRequest } from '../lib/api';
import type { ProductImage } from '../types';

interface UploadTask {
  id: string;
  file: File;
  previewUrl: string;
  progress: number;
  status: 'uploading' | 'done' | 'failed';
  error?: string;
  uploadedUrl?: string;
  publicId?: string;
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
  const [cloudinaryWarning, setCloudinaryWarning] = useState('');
  const [manualUrl, setManualUrl] = useState('');

  const uploadSingleToCloudinary = (
    task: UploadTask,
    sig: {
      signature: string;
      timestamp: number;
      folder: string;
      cloudName: string;
      apiKey: string;
    }
  ): Promise<{ url: string; publicId: string }> => {
    return new Promise((resolve, reject) => {
      const formData = new FormData();
      formData.append('file', task.file);
      formData.append('api_key', sig.apiKey);
      formData.append('timestamp', String(sig.timestamp));
      formData.append('signature', sig.signature);
      formData.append('folder', sig.folder);

      const xhr = new XMLHttpRequest();
      xhr.open('POST', `https://api.cloudinary.com/v1_1/${sig.cloudName}/image/upload`);

      xhr.upload.onprogress = (evt) => {
        if (evt.lengthComputable) {
          const pct = Math.round((evt.loaded / evt.total) * 100);
          setTasks((prev) =>
            prev.map((t) => (t.id === task.id ? { ...t, progress: pct } : t))
          );
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const json = JSON.parse(xhr.responseText);
            const optimized = String(json.secure_url || '').replace(
              '/upload/',
              '/upload/f_auto,q_auto,w_1200,h_1200,c_fill/'
            );
            resolve({ url: optimized, publicId: json.public_id || '' });
          } catch {
            reject(new Error('Invalid Cloudinary response'));
          }
        } else {
          reject(new Error(`Upload failed (${xhr.status})`));
        }
      };

      xhr.onerror = () => reject(new Error('Network error during upload'));
      xhr.send(formData);
    });
  };

  const processFiles = async (fileList: FileList | File[]) => {
    setCloudinaryWarning('');
    const remainingSlots = MAX_IMAGES - images.length;
    if (remainingSlots <= 0) {
      setCloudinaryWarning('Maximum 5 square product images reached. Remove or replace one first.');
      return;
    }

    const incoming = Array.from(fileList).slice(0, remainingSlots);
    const validFiles: File[] = [];
    for (const file of incoming) {
      if (!ALLOWED_TYPES.includes(file.type)) {
        setCloudinaryWarning(`Skipped ${file.name}: Only JPG, PNG, WebP, or AVIF allowed.`);
        continue;
      }
      if (file.size > MAX_SIZE_BYTES) {
        setCloudinaryWarning(`Skipped ${file.name}: Maximum file size is 8 MB.`);
        continue;
      }
      validFiles.push(file);
    }

    if (validFiles.length === 0) return;

    let sig: any;
    try {
      sig = await apiRequest('/api/admin/cloudinary/signature', {
        method: 'POST',
        body: JSON.stringify({ folder: 'products' }),
      });
    } catch (err: any) {
      setCloudinaryWarning(
        err?.message ||
          'Cloudinary is awaiting credentials (CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET). You may add verified studio image URLs below in the meantime.'
      );
      return;
    }

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
          const result = await uploadSingleToCloudinary(task, sig);
          setTasks((prev) =>
            prev.map((t) =>
              t.id === task.id
                ? {
                    ...t,
                    progress: 100,
                    status: 'done',
                    uploadedUrl: result.url,
                    publicId: result.publicId,
                  }
                : t
            )
          );
          completed.push({
            url: result.url,
            cloudinaryPublicId: result.publicId,
            altText: task.file.name.replace(/\.[^.]+$/, ''),
            colorName: '',
            sortOrder: images.length + completed.length,
          });
        } catch (err: any) {
          setTasks((prev) =>
            prev.map((t) =>
              t.id === task.id
                ? { ...t, status: 'failed', error: err?.message || 'Upload failed' }
                : t
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
      const sig = await apiRequest('/api/admin/cloudinary/signature', {
        method: 'POST',
        body: JSON.stringify({ folder: 'products' }),
      });
      setTasks((prev) =>
        prev.map((t) => (t.id === task.id ? { ...t, status: 'uploading', progress: 0, error: '' } : t))
      );
      const result = await uploadSingleToCloudinary(task, sig);
      setTasks((prev) =>
        prev.map((t) =>
          t.id === task.id ? { ...t, status: 'done', progress: 100, uploadedUrl: result.url } : t
        )
      );
      onChange(
        [
          ...images,
          {
            url: result.url,
            cloudinaryPublicId: result.publicId,
            altText: task.file.name,
            colorName: '',
            sortOrder: images.length,
          },
        ].slice(0, MAX_IMAGES)
      );
    } catch (err: any) {
      setTasks((prev) =>
        prev.map((t) => (t.id === task.id ? { ...t, status: 'failed', error: err?.message } : t))
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
        <label className="text-xs font-semibold uppercase tracking-wider text-[#1C1917]">
          Product Gallery (5 Square 1:1 Images) — {images.length} / {MAX_IMAGES}
        </label>
        <span className="text-[11px] text-[#78716C]">Drag &amp; drop up to 5 images together</span>
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
        className={`border-2 border-dashed p-6 text-center cursor-pointer transition-colors ${
          dragActive
            ? 'border-[#B8924A] bg-[#FAF7F2]'
            : 'border-[#DFD3C0] bg-[#FAF7F2]/60 hover:border-[#B8924A]'
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
        <CloudUpload className="w-7 h-7 mx-auto text-[#8A6B2F] mb-2" />
        <p className="text-xs font-medium text-[#1C1917]">
          Select or drag &amp; drop up to 5 square product images for simultaneous Cloudinary upload
        </p>
        <p className="text-[11px] text-[#78716C] mt-1">
          JPG, PNG, WebP, AVIF · Max 8 MB each · Auto-optimized via backend Cloudinary signature
        </p>
      </div>

      {/* Overall & Per-File Upload Progress */}
      {tasks.length > 0 && (
        <div className="bg-white border border-[#E6DDD0] p-4 space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-[#1C1917]">Uploading Product Images</span>
            <span className="tabular-nums font-semibold text-[#8A6B2F]">{overallProgress}%</span>
          </div>
          <div className="w-full h-2 bg-[#EFE8DC] overflow-hidden">
            <div
              style={{ width: `${overallProgress}%` }}
              className="h-full bg-[#B8924A] transition-all duration-150"
            />
          </div>
          <p className="text-[11px] text-[#57534E] tabular-nums">
            {doneCount} of {tasks.length} Images Uploaded
          </p>

          <div className="space-y-2 pt-1">
            {tasks.map((task) => (
              <div
                key={task.id}
                className="flex items-center justify-between gap-3 text-xs border-t border-[#F2ECE1] pt-2"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <img
                    src={task.previewUrl}
                    alt={task.file.name}
                    className="w-8 h-8 object-cover border border-[#E6DDD0] shrink-0"
                  />
                  <span className="truncate text-[#1C1917]">{task.file.name}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {task.status === 'uploading' && (
                    <span className="tabular-nums text-[#8A6B2F]">{task.progress}%</span>
                  )}
                  {task.status === 'done' && (
                    <span className="inline-flex items-center gap-1 text-[#166534]">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Uploaded
                    </span>
                  )}
                  {task.status === 'failed' && (
                    <button
                      type="button"
                      onClick={() => retryTask(task)}
                      className="inline-flex items-center gap-1 text-[#991B1B] underline"
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

      {cloudinaryWarning && (
        <p className="text-xs text-[#8A6B2F] bg-[#FAF7F2] border border-[#DFD3C0] p-3">
          {cloudinaryWarning}
        </p>
      )}

      {/* Manual Studio/Cloudinary Image URL Entry */}
      {images.length < MAX_IMAGES && (
        <div className="flex gap-2">
          <input
            type="text"
            value={manualUrl}
            onChange={(e) => setManualUrl(e.target.value)}
            placeholder="Or paste verified Cloudinary / studio image URL..."
            className="flex-1 px-3 py-2 text-xs bg-[#FAF7F2] border border-[#DFD3C0] outline-none focus:border-[#B8924A]"
          />
          <button
            type="button"
            onClick={addManualUrl}
            className="px-4 py-2 text-xs font-medium border border-[#1C1917] hover:bg-[#1C1917] hover:text-white transition-colors"
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
              className="bg-white border border-[#E6DDD0] p-2 space-y-2"
            >
              <div className="relative aspect-square bg-[#F4EFE6] overflow-hidden">
                <img
                  src={img.url}
                  alt={img.altText || `Slot ${idx + 1}`}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
                <span className="absolute top-1 left-1 bg-[#1C1917]/80 text-white text-[10px] px-1.5 py-0.5 tabular-nums">
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
                  className="w-full text-[10px] bg-[#FAF7F2] border border-[#DFD3C0] px-1.5 py-1"
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
                    className="p-1 border border-[#E6DDD0] disabled:opacity-30"
                  >
                    <ArrowLeft className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    disabled={idx === images.length - 1}
                    onClick={() => moveImage(idx, 1)}
                    aria-label="Move right"
                    className="p-1 border border-[#E6DDD0] disabled:opacity-30"
                  >
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => removeImage(idx)}
                  aria-label="Remove image"
                  className="p-1 text-[#991B1B] hover:bg-red-50"
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
