import React, { useState, useEffect, useRef } from 'react';
import {
  Folder,
  File,
  Upload,
  Download,
  Trash2,
  RefreshCw,
  Search,
  ChevronRight,
  HardDrive,
  Smartphone,
  Laptop,
  CheckCircle2,
  AlertCircle,
  FileText,
  FileCode,
  Image,
  Video,
  Music,
  Archive,
  ArrowUp,
  X
} from 'lucide-react';
import { api } from '../services/api';
import { useApp } from '../context/AppContext';

interface FileItem {
  name: string;
  path: string;
  is_dir: boolean;
  size: number;
  modified: number;
  extension?: string;
}

interface TransferProgress {
  type: 'upload' | 'download';
  filename: string;
  percent: number;
  loadedBytes: number;
  totalBytes: number;
  speedMbps?: number;
  status: 'transferring' | 'completed' | 'error';
  errorMessage?: string;
}

export const FinderView: React.FC = () => {
  const { triggerHaptic, addNotification } = useApp();

  const [deviceScope, setDeviceScope] = useState<'laptop' | 'oppo'>('laptop');
  const [currentPath, setCurrentPath] = useState<string>('/home/aryan');
  const [files, setFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedFile, setSelectedFile] = useState<FileItem | null>(null);

  // Transfer Progress State
  const [activeTransfer, setActiveTransfer] = useState<TransferProgress | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Format bytes helper
  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  // Fetch Directory Files
  const fetchDirectory = async (path: string) => {
    setLoading(true);
    try {
      if (deviceScope === 'laptop') {
        const res: any = await api.listFiles(path);
        const fileList = res.items || res.files || [];
        if (fileList) {
          // Map to FileItem
          const mapped: FileItem[] = fileList.map((f: any) => ({
            name: f.name,
            path: f.path,
            is_dir: Boolean(f.is_directory || f.is_dir),
            size: f.size_bytes || f.size || 0,
            modified: f.modified || Date.now() / 1000,
            extension: f.name.includes('.') ? f.name.split('.').pop()?.toLowerCase() : ''
          }));
          setFiles(mapped);
          setCurrentPath(path);
        }
      } else {
        // Phone files
        const res = await api.listPhoneFiles(path, 'oppo');
        if (res && res.files) {
          const mapped: FileItem[] = res.files.map((f: any) => ({
            name: f.name,
            path: f.path,
            is_dir: Boolean(f.is_dir),
            size: f.size || 0,
            modified: f.modified || Date.now() / 1000,
            extension: f.name.includes('.') ? f.name.split('.').pop()?.toLowerCase() : ''
          }));
          setFiles(mapped);
          setCurrentPath(path);
        }
      }
    } catch (err: any) {
      addNotification('Finder Error', err.message || 'Failed to list directory', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDirectory(deviceScope === 'laptop' ? '/home/aryan' : '/storage/emulated/0');
  }, [deviceScope]);

  // Navigate folder
  const handleOpenItem = (item: FileItem) => {
    triggerHaptic(30);
    if (item.is_dir) {
      fetchDirectory(item.path);
    } else {
      setSelectedFile(item);
    }
  };

  // Navigate up one folder
  const handleNavigateUp = () => {
    triggerHaptic(30);
    const parts = currentPath.split('/').filter(Boolean);
    if (parts.length > 0) {
      parts.pop();
      const parent = '/' + parts.join('/');
      fetchDirectory(parent || '/');
    }
  };

  // Handle Real Progress Upload
  const handleUploadFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    triggerHaptic(40);
    const startTime = performance.now();

    setActiveTransfer({
      type: 'upload',
      filename: file.name,
      percent: 0,
      loadedBytes: 0,
      totalBytes: file.size,
      status: 'transferring'
    });

    const xhr = new XMLHttpRequest();
    const formData = new FormData();
    formData.append('path', currentPath);
    formData.append('file', file);

    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable) {
        const percent = Math.round((event.loaded / event.total) * 100);
        const elapsedSec = (performance.now() - startTime) / 1000;
        const speed = elapsedSec > 0 ? (event.loaded * 8) / (elapsedSec * 1000000) : 0;

        setActiveTransfer({
          type: 'upload',
          filename: file.name,
          percent,
          loadedBytes: event.loaded,
          totalBytes: event.total,
          speedMbps: Math.round(speed * 10) / 10,
          status: 'transferring'
        });
      }
    });

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        setActiveTransfer((prev) => (prev ? { ...prev, percent: 100, status: 'completed' } : null));
        addNotification('Upload Complete', `${file.name} saved successfully`, 'success');
        fetchDirectory(currentPath);
        setTimeout(() => setActiveTransfer(null), 3500);
      } else {
        setActiveTransfer((prev) =>
          prev ? { ...prev, status: 'error', errorMessage: `Failed: HTTP ${xhr.status}` } : null
        );
      }
    });

    xhr.addEventListener('error', () => {
      setActiveTransfer((prev) =>
        prev ? { ...prev, status: 'error', errorMessage: 'Network connection interrupted' } : null
      );
    });

    xhr.open('POST', '/api/files/upload');
    const token = localStorage.getItem('smart_remote_auth_token');
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.send(formData);

    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Handle Real Progress Download
  const handleDownloadFile = (item: FileItem) => {
    triggerHaptic(40);
    const startTime = performance.now();

    setActiveTransfer({
      type: 'download',
      filename: item.name,
      percent: 0,
      loadedBytes: 0,
      totalBytes: item.size || 1024,
      status: 'transferring'
    });

    const xhr = new XMLHttpRequest();
    xhr.open('GET', `/api/files/raw?path=${encodeURIComponent(item.path)}`);
    xhr.responseType = 'blob';

    const token = localStorage.getItem('smart_remote_auth_token');
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);

    xhr.addEventListener('progress', (event) => {
      if (event.lengthComputable) {
        const percent = Math.round((event.loaded / event.total) * 100);
        const elapsedSec = (performance.now() - startTime) / 1000;
        const speed = elapsedSec > 0 ? (event.loaded * 8) / (elapsedSec * 1000000) : 0;

        setActiveTransfer({
          type: 'download',
          filename: item.name,
          percent,
          loadedBytes: event.loaded,
          totalBytes: event.total,
          speedMbps: Math.round(speed * 10) / 10,
          status: 'transferring'
        });
      }
    });

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        const blob = xhr.response;
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = item.name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);

        setActiveTransfer((prev) => (prev ? { ...prev, percent: 100, status: 'completed' } : null));
        addNotification('Download Finished', `${item.name} downloaded`, 'success');
        setTimeout(() => setActiveTransfer(null), 3000);
      } else {
        setActiveTransfer((prev) =>
          prev ? { ...prev, status: 'error', errorMessage: `Download error HTTP ${xhr.status}` } : null
        );
      }
    });

    xhr.addEventListener('error', () => {
      setActiveTransfer((prev) =>
        prev ? { ...prev, status: 'error', errorMessage: 'Network download failed' } : null
      );
    });

    xhr.send();
  };

  // Delete file
  const handleDeleteItem = async (item: FileItem) => {
    if (!confirm(`Delete ${item.name}?`)) return;
    triggerHaptic(50);
    try {
      await api.deleteItem(item.path, true);
      addNotification('Item Deleted', item.name, 'info');
      fetchDirectory(currentPath);
      if (selectedFile?.path === item.path) setSelectedFile(null);
    } catch {
      addNotification('Delete Failed', 'Could not delete item', 'error');
    }
  };

  // Get file icon helper
  const getFileIcon = (item: FileItem) => {
    if (item.is_dir) return <Folder className="w-5 h-5 text-blue-500 fill-blue-500/20" />;
    const ext = item.extension || '';
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)) {
      return <Image className="w-5 h-5 text-emerald-500" />;
    }
    if (['mp4', 'mkv', 'webm', 'mov'].includes(ext)) {
      return <Video className="w-5 h-5 text-purple-500" />;
    }
    if (['mp3', 'wav', 'aac', 'flac'].includes(ext)) {
      return <Music className="w-5 h-5 text-pink-500" />;
    }
    if (['zip', 'tar', 'gz', 'rar', '7z'].includes(ext)) {
      return <Archive className="w-5 h-5 text-amber-500" />;
    }
    if (['py', 'js', 'ts', 'tsx', 'html', 'css', 'json', 'sh'].includes(ext)) {
      return <FileCode className="w-5 h-5 text-indigo-500" />;
    }
    return <FileText className="w-5 h-5 text-slate-500" />;
  };

  const filteredFiles = files.filter((f) =>
    f.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="w-full h-full flex flex-col bg-[#F2F2F7] overflow-hidden">
      {/* Hidden File Input */}
      <input type="file" ref={fileInputRef} onChange={handleUploadFile} className="hidden" />

      {/* Top macOS Toolbar */}
      <div className="bg-white/80 backdrop-blur-xl border-b border-black/5 px-4 py-3 shrink-0 flex flex-wrap items-center justify-between gap-3">
        {/* Device Switcher (pearOS Laptop vs Oppo Phone) */}
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-slate-100 p-1 rounded-2xl border border-slate-200">
            <button
              onClick={() => {
                triggerHaptic(20);
                setDeviceScope('laptop');
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                deviceScope === 'laptop'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Laptop className="w-3.5 h-3.5" />
              <span>pearOS</span>
            </button>
            <button
              onClick={() => {
                triggerHaptic(20);
                setDeviceScope('oppo');
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                deviceScope === 'oppo'
                  ? 'bg-white text-emerald-600 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>Oppo Phone</span>
            </button>
          </div>

          {/* Quick APK Download Button */}
          <a
            href="/app-debug.apk"
            download
            className="hidden sm:flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-3 py-1.5 rounded-xl transition-all shadow-xs"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download APK</span>
          </a>
        </div>

        {/* Path Bar & Actions */}
        <div className="flex items-center gap-2">
          {/* Navigate Up */}
          <button
            onClick={handleNavigateUp}
            className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-all"
            title="Go to parent directory"
          >
            <ArrowUp className="w-4 h-4" />
          </button>

          {/* Upload Button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-sm transition-all active:scale-95"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Upload File</span>
          </button>

          {/* Refresh */}
          <button
            onClick={() => fetchDirectory(currentPath)}
            className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-all"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-blue-600' : ''}`} />
          </button>
        </div>
      </div>

      {/* Active Transfer Progress Banner */}
      {activeTransfer && (
        <div className="bg-white/95 backdrop-blur-xl border-b border-black/5 px-4 py-3 shadow-md animate-in slide-in-from-top-2">
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-2">
              {activeTransfer.status === 'transferring' ? (
                <div className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-ping" />
              ) : activeTransfer.status === 'completed' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-500" />
              )}
              <span className="text-xs font-bold text-slate-900">
                {activeTransfer.type === 'upload' ? 'Uploading' : 'Downloading'}: {activeTransfer.filename}
              </span>
            </div>

            <div className="flex items-center gap-3 text-[11px] font-mono text-slate-600">
              {activeTransfer.speedMbps && <span>{activeTransfer.speedMbps} Mbps</span>}
              <span>
                {formatBytes(activeTransfer.loadedBytes)} / {formatBytes(activeTransfer.totalBytes)}
              </span>
              <span className="font-bold text-blue-600">{activeTransfer.percent}%</span>
              <button
                onClick={() => setActiveTransfer(null)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Real-time Percentage Bar */}
          <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
            <div
              className={`h-full transition-all duration-150 ${
                activeTransfer.status === 'error'
                  ? 'bg-rose-500'
                  : activeTransfer.status === 'completed'
                  ? 'bg-emerald-500'
                  : 'bg-gradient-to-r from-blue-500 to-indigo-600'
              }`}
              style={{ width: `${activeTransfer.percent}%` }}
            />
          </div>
        </div>
      )}

      {/* Path Breadcrumbs & Search */}
      <div className="bg-slate-50/80 px-4 py-2 border-b border-black/5 flex items-center justify-between gap-3 text-xs text-slate-600">
        <div className="flex items-center gap-1.5 overflow-x-auto font-mono text-[11px] text-slate-700">
          <span className="font-semibold text-blue-600">{deviceScope === 'laptop' ? 'pearOS' : 'Oppo'}</span>
          <span>:</span>
          <span>{currentPath}</span>
        </div>

        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter files..."
            className="w-40 sm:w-56 bg-white text-xs px-3 py-1 rounded-xl border border-slate-200 outline-none focus:border-blue-500 shadow-inner"
          />
        </div>
      </div>

      {/* Files Grid / List */}
      <div className="flex-1 overflow-y-auto p-4">
        {filteredFiles.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-400">
            <Folder className="w-12 h-12 stroke-[1.2] mb-2 opacity-50" />
            <p className="text-xs">This folder is empty</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
            {filteredFiles.map((item, idx) => (
              <div
                key={idx}
                onDoubleClick={() => handleOpenItem(item)}
                onClick={() => setSelectedFile(item)}
                className={`group flex flex-col items-center justify-center p-3 rounded-2xl cursor-pointer transition-all ${
                  selectedFile?.path === item.path
                    ? 'bg-blue-100/80 border border-blue-400 shadow-sm'
                    : 'bg-white/80 hover:bg-white border border-black/5 shadow-xs'
                }`}
              >
                <div className="w-12 h-12 flex items-center justify-center mb-1.5 group-hover:scale-105 transition-transform">
                  {getFileIcon(item)}
                </div>
                <span className="text-[11px] font-medium text-slate-800 text-center truncate w-full">
                  {item.name}
                </span>
                <span className="text-[10px] text-slate-400 font-mono mt-0.5">
                  {item.is_dir ? 'Folder' : formatBytes(item.size)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Selected Item Action Bar */}
      {selectedFile && (
        <div className="bg-white/90 backdrop-blur-xl border-t border-black/5 px-4 py-3 shrink-0 flex items-center justify-between animate-in slide-in-from-bottom-2">
          <div className="flex items-center gap-2.5 min-w-0">
            {getFileIcon(selectedFile)}
            <div className="min-w-0">
              <p className="text-xs font-semibold text-slate-900 truncate">{selectedFile.name}</p>
              <p className="text-[10px] text-slate-500 font-mono">
                {formatBytes(selectedFile.size)} • {selectedFile.path}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {selectedFile.is_dir ? (
              <button
                onClick={() => handleOpenItem(selectedFile)}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-xl shadow-xs"
              >
                Open Folder
              </button>
            ) : (
              <button
                onClick={() => handleDownloadFile(selectedFile)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-xl shadow-xs"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download</span>
              </button>
            )}

            <button
              onClick={() => handleDeleteItem(selectedFile)}
              className="p-2 text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
              title="Delete"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
