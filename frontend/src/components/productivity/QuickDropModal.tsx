import React, { useState, useRef } from 'react';
import { UploadCloud, CheckCircle2, AlertCircle, File, Image, Music, Video, X } from 'lucide-react';
import { api } from '../../services/api';

interface QuickDropModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const QuickDropModal: React.FC<QuickDropModalProps> = ({ isOpen, onClose }) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState<boolean>(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
      setSuccessMsg(null);
      setErrorMsg(null);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setSelectedFile(e.dataTransfer.files[0]);
      setSuccessMsg(null);
      setErrorMsg(null);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;
    setUploading(true);
    setSuccessMsg(null);
    setErrorMsg(null);
    try {
      const res = await api.quickDropFile(selectedFile);
      if (res.success) {
        setSuccessMsg(`✓ Saved to laptop: ~/Downloads/${res.filename}`);
        setSelectedFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
      } else {
        setErrorMsg('Failed to beam file to laptop.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error uploading file.');
    } finally {
      setUploading(false);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-2xl animate-in fade-in zoom-in-95">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-500/10 text-blue-400 rounded-lg">
              <UploadCloud className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">AirDrop Quick Drop</h2>
              <p className="text-xs text-slate-400">Beam photos & files straight to ~/Downloads</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Drop Zone */}
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-slate-700 hover:border-blue-500/80 rounded-xl p-6 text-center cursor-pointer transition bg-slate-950/50 hover:bg-slate-950"
        >
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleFileChange}
            className="hidden"
          />
          <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-400">
            <UploadCloud className="w-6 h-6" />
          </div>
          <p className="text-sm font-medium text-white mb-1">Tap to select photo, video, or document</p>
          <p className="text-xs text-slate-500">Supports APK, MP4, JPEG, PDF, ZIP, code files</p>
        </div>

        {/* Selected File Details */}
        {selectedFile && (
          <div className="mt-4 p-3 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-2.5 overflow-hidden">
              <div className="p-2 bg-slate-800 rounded-lg text-slate-300">
                <File className="w-4 h-4" />
              </div>
              <div className="truncate">
                <p className="text-xs font-medium text-white truncate">{selectedFile.name}</p>
                <p className="text-[10px] text-slate-400">{formatBytes(selectedFile.size)}</p>
              </div>
            </div>
            <button
              onClick={handleUpload}
              disabled={uploading}
              className="bg-blue-500 hover:bg-blue-400 disabled:opacity-50 text-slate-950 text-xs font-semibold px-4 py-2 rounded-lg transition whitespace-nowrap"
            >
              {uploading ? 'Beaming...' : 'Beam to Laptop'}
            </button>
          </div>
        )}

        {/* Success / Error Banners */}
        {successMsg && (
          <div className="mt-4 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center gap-2 text-xs text-emerald-400">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}
        {errorMsg && (
          <div className="mt-4 p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-center gap-2 text-xs text-rose-400">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}
      </div>
    </div>
  );
};
