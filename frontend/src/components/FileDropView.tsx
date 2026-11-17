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
    <div className="flex flex-col h-full p-4 gap-4">
      {/* Directory Breadcrumb Navigation */}
      <div className="flex items-center justify-between glass-panel p-3 rounded-2xl">
        <div className="flex items-center gap-2 overflow-hidden">
          <button
            onClick={() => loadDirectory(parentPath)}
            disabled={currentPath === '/home/aryan'}
            className="p-1.5 bg-slate-200/60 rounded-xl text-slate-700 disabled:opacity-30 active:scale-95 transition-all shrink-0"
          >
            <ArrowLeft size={16} />
          </button>
          <div className="flex items-center gap-1.5 text-xs font-mono text-slate-700 truncate">
            <HardDrive size={14} className="text-apple-blue shrink-0" />
            <span className="truncate">{currentPath}</span>
          </div>
        </div>

        <span className="text-[10px] uppercase font-bold text-slate-400 shrink-0">pearDrop</span>
      </div>

      {/* File List Container */}
      <div className="flex-1 glass-panel rounded-3xl p-3 overflow-y-auto flex flex-col gap-1 border border-white/80">
        {loading ? (
          <div className="flex items-center justify-center h-full text-slate-400 text-xs">
            Loading directory...
          </div>
        ) : items.length === 0 ? (
          <div className="flex items-center justify-center h-full text-slate-400 text-xs">
            Empty directory
          </div>
        ) : (
          items.map((item) => (
            <div
              key={item.path}
              onClick={() => {
                if (item.is_dir) {
                  loadDirectory(item.path);
                } else {
                  window.open(`${window.location.origin}/api/files/download?path=${encodeURIComponent(item.path)}`, '_blank');
                }
              }}
              className="flex items-center justify-between p-2.5 rounded-2xl hover:bg-white/80 active:scale-99 transition-all cursor-pointer"
            >
              <div className="flex items-center gap-2.5 overflow-hidden">
                {item.is_dir ? (
                  <Folder size={18} className="text-apple-blue shrink-0" />
                ) : (
                  <File size={18} className="text-slate-500 shrink-0" />
                )}
                <span className="text-xs font-medium text-slate-800 truncate">{item.name}</span>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[10px] text-slate-400 font-mono">{formatSize(item.size_bytes)}</span>
                {!item.is_dir && <Download size={14} className="text-apple-blue" />}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
