import React, { useState, useEffect } from 'react';
import { Folder, File, ArrowLeft, Download, HardDrive } from 'lucide-react';
import { api } from '../services/api';

export const FileDropView: React.FC = () => {
  const [currentPath, setCurrentPath] = useState('/home/aryan');
  const [parentPath, setParentPath] = useState('/home/aryan');
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const loadDirectory = async (path: string) => {
    setLoading(true);
    try {
      const res = await api.listFiles(path);
      if (res.success) {
        setCurrentPath(res.current_path);
        setParentPath(res.parent_path);
        setItems(res.items);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDirectory('/home/aryan');
  }, []);

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '-';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="w-full h-full px-4 pb-4 flex flex-col">
      <div className="max-w-[980px] w-full mx-auto h-full flex flex-col gap-3">
        {/* Path Header */}
        <div className="apple-glass-card p-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              onClick={() => loadDirectory(parentPath)}
              disabled={currentPath === '/home/aryan'}
              aria-label="Parent Directory"
              className="apple-btn-pearl w-10 h-10 flex items-center justify-center disabled:opacity-35 shrink-0"
            >
              <ArrowLeft size={16} />
            </button>
            <div className="flex items-center gap-1.5 type-caption font-mono text-apple-ink truncate">
              <HardDrive size={15} className="text-apple-primary shrink-0" />
              <span className="truncate">{currentPath}</span>
            </div>
          </div>
          <span className="type-fine font-semibold text-apple-ink48 shrink-0 pr-1">pearDrop</span>
        </div>

        {/* File List Utility Card */}
        <div className="flex-1 apple-glass-card p-4 overflow-y-auto">
          {loading ? (
            <div className="h-full flex items-center justify-center type-caption text-apple-ink48">
              Loading directory...
            </div>
          ) : items.length === 0 ? (
            <div className="h-full flex items-center justify-center type-caption text-apple-ink48">
              Directory is empty
            </div>
          ) : (
            <div className="flex flex-col divide-y divide-apple-divider">
              {items.map((item) => (
                <button
                  key={item.path}
                  type="button"
                  onClick={() => {
                    if (item.is_dir) {
                      loadDirectory(item.path);
                    } else {
                      window.open(`${window.location.origin}/api/files/download?path=${encodeURIComponent(item.path)}`, '_blank');
                    }
                  }}
                  className="py-3 px-1 flex items-center justify-between gap-3 text-left active:scale-[0.99] transition-transform"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {item.is_dir ? (
                      <Folder size={18} className="text-apple-primary shrink-0" />
                    ) : (
                      <File size={18} className="text-apple-ink48 shrink-0" />
                    )}
                    <span className="type-caption-strong text-apple-ink truncate">{item.name}</span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="type-fine font-mono text-apple-ink48">{formatSize(item.size_bytes)}</span>
                    {!item.is_dir && <Download size={15} className="text-apple-primary" />}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
