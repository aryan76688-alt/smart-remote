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
    <div className="w-full h-full px-3 pb-4 flex flex-col items-center">
      <div className="w-full max-w-md h-full flex flex-col gap-3">
        {/* Path Pill Header */}
        <div className="liquid-glass rounded-2xl p-2.5 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <button
              type="button"
              onClick={() => loadDirectory(parentPath)}
              disabled={currentPath === '/home/aryan'}
              aria-label="Go up directory"
              className="w-9 h-9 rounded-xl liquid-btn flex items-center justify-center text-stitch-text disabled:opacity-30 shrink-0"
            >
              <ArrowLeft size={15} />
            </button>
            <div className="flex items-center gap-1.5 font-mono text-xs text-stitch-text truncate">
              <HardDrive size={14} className="text-stitch-primary shrink-0" />
              <span className="truncate">{currentPath}</span>
            </div>
          </div>
          <span className="font-mono text-[10px] uppercase tracking-wider text-stitch-primary shrink-0 pr-1">
            pearDrop
          </span>
        </div>

        {/* Crystal File List */}
        <div className="flex-1 liquid-glass rounded-3xl p-2.5 overflow-y-auto flex flex-col gap-1.5">
          {loading ? (
            <div className="h-full flex items-center justify-center text-xs text-stitch-outline font-mono">
              Loading vault...
            </div>
          ) : items.length === 0 ? (
            <div className="h-full flex items-center justify-center text-xs text-stitch-outline font-mono">
              Directory is empty
            </div>
          ) : (
            items.map((item) => (
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
                className="liquid-glass-deep rounded-2xl px-3 py-2.5 flex items-center justify-between gap-2 hover:bg-white/10 active:scale-[0.99] transition-all text-left"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  {item.is_dir ? (
                    <Folder size={17} className="text-stitch-primary shrink-0" />
                  ) : (
                    <File size={17} className="text-stitch-muted shrink-0" />
                  )}
                  <span className="text-xs font-medium text-stitch-text truncate">{item.name}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="font-mono text-[10px] text-stitch-outline">{formatSize(item.size_bytes)}</span>
                  {!item.is_dir && <Download size={14} className="text-stitch-secondary" />}
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
