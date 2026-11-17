import React, { useState, useRef, useEffect } from 'react';
import {
  Laptop,
  Smartphone,
  Upload,
  CheckCircle2,
  X,
  File,
  Sparkles,
  ArrowRight,
  Radio,
  Download,
  FolderDown,
  RefreshCw
} from 'lucide-react';
import { api } from '../services/api';
import { useApp } from '../context/AppContext';

interface PearDropModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PearDropModal: React.FC<PearDropModalProps> = ({ isOpen, onClose }) => {
  const { triggerHaptic, addNotification } = useApp();

  const [activeTab, setActiveTab] = useState<'send_to_pc' | 'send_to_phone'>('send_to_pc');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isSending, setIsSending] = useState<boolean>(false);
  const [isSent, setIsSent] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Reverse pearDrop State (Feature 15)
  const [laptopFiles, setLaptopFiles] = useState<Array<{ name: string; path: string; folder: string; size: number; modified: number; extension: string }>>([]);
  const [loadingFiles, setLoadingFiles] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen && activeTab === 'send_to_phone') {
      fetchLaptopFiles();
    }
  }, [isOpen, activeTab]);

  const fetchLaptopFiles = async () => {
    setLoadingFiles(true);
    try {
      const res = await api.listPeardropLaptopFiles();
      if (res && res.files) {
        setLaptopFiles(res.files);
      }
    } catch {
      addNotification('Error', 'Could not load pearOS files', 'error');
    } finally {
      setLoadingFiles(false);
    }
  };

  if (!isOpen) return null;

  const handleSelectFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setIsSent(false);
      triggerHaptic(20);
    }
  };

  const handleSendPearDrop = async () => {
    if (!selectedFile || isSending) return;
    setIsSending(true);
    triggerHaptic(40);

    try {
      const res = await api.quickDropFile(selectedFile);
      if (res.success) {
        setIsSent(true);
        addNotification('pearDrop Successful', `Sent ${selectedFile.name} to pearOS ~/Downloads`, 'success');
        triggerHaptic(60);
        setTimeout(() => {
          setSelectedFile(null);
          setIsSent(false);
          onClose();
        }, 2000);
      }
    } catch (err: any) {
      addNotification('pearDrop Failed', err.message || 'Transfer failed', 'error');
    } finally {
      setIsSending(false);
    }
  };

  const handleDownloadFromLaptop = (file: { name: string; path: string }) => {
    triggerHaptic(40);
    const downloadUrl = `/api/sync/peardrop/download-file?path=${encodeURIComponent(file.path)}`;
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    addNotification('pearDrop Downloaded', `Downloading ${file.name} to phone`, 'success');
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[2200] flex items-center justify-center p-4 bg-black/30 backdrop-blur-md select-none animate-in fade-in"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm bg-white/90 backdrop-blur-3xl border border-black/10 shadow-2xl rounded-3xl p-5 space-y-4 animate-in zoom-in-95"
      >
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleSelectFile}
          className="hidden"
        />

        {/* Top Header */}
        <div className="flex items-center justify-between border-b border-black/5 pb-2.5">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-500 to-indigo-600 text-white flex items-center justify-center shadow-xs">
              <Radio className="w-4 h-4 animate-pulse" />
            </div>
            <div>
              <h2 className="text-xs font-bold text-slate-900 tracking-tight">pearDrop</h2>
              <p className="text-[10px] text-slate-500">Bidirectional Wireless Sharing</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Direction Switcher Tabs */}
        <div className="grid grid-cols-2 gap-1 bg-slate-100 p-1 rounded-2xl border border-black/5">
          <button
            onClick={() => {
              triggerHaptic(20);
              setActiveTab('send_to_pc');
            }}
            className={`py-1.5 px-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'send_to_pc'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5 text-blue-600" />
            <span>Phone → pearOS</span>
          </button>

          <button
            onClick={() => {
              triggerHaptic(20);
              setActiveTab('send_to_phone');
            }}
            className={`py-1.5 px-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'send_to_phone'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Laptop className="w-3.5 h-3.5 text-purple-600" />
            <span>pearOS → Phone</span>
          </button>
        </div>

        {/* Tab 1: Phone to PC */}
        {activeTab === 'send_to_pc' ? (
          <div className="space-y-4">
            {/* Concentric Animated Radar */}
            <div className="relative py-6 flex flex-col items-center justify-center overflow-hidden">
              <div className="absolute w-52 h-52 rounded-full border border-blue-400/20 animate-ping pointer-events-none" />
              <div className="absolute w-36 h-36 rounded-full border border-blue-400/30 pointer-events-none" />
              <div className="relative z-10 flex flex-col items-center">
                <div className="w-14 h-14 rounded-3xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-lg ring-4 ring-blue-500/20">
                  <Laptop className="w-7 h-7" />
                </div>
                <span className="text-xs font-bold text-slate-900 mt-2">pearOS Workstation</span>
                <span className="text-[10px] text-emerald-600 font-medium bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 mt-0.5">
                  Ready to Receive
                </span>
              </div>
            </div>

            {/* File Picker */}
            {selectedFile ? (
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                    <File className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-900 truncate">{selectedFile.name}</p>
                    <p className="text-[10px] text-slate-500 font-mono">
                      {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedFile(null)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-4 border-2 border-dashed border-slate-200 hover:border-blue-400 rounded-2xl flex flex-col items-center justify-center text-slate-500 hover:text-blue-600 transition-colors bg-slate-50/50 hover:bg-blue-50/30"
              >
                <Upload className="w-5 h-5 mb-1 opacity-70" />
                <span className="text-xs font-semibold">Choose photo or document to drop</span>
                <span className="text-[10px] text-slate-400 mt-0.5">Direct to ~/Downloads on pearOS</span>
              </button>
            )}

            {/* Send Action Button */}
            {selectedFile && (
              <button
                onClick={handleSendPearDrop}
                disabled={isSending || isSent}
                className={`w-full py-3 rounded-2xl text-xs font-bold shadow-md transition-all active:scale-95 flex items-center justify-center gap-2 ${
                  isSent ? 'bg-emerald-600 text-white' : 'bg-blue-600 hover:bg-blue-700 text-white'
                }`}
              >
                {isSending ? (
                  <span>Dropping wirelessly...</span>
                ) : isSent ? (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Dropped to pearOS!</span>
                  </>
                ) : (
                  <>
                    <span>Send via pearDrop</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            )}
          </div>
        ) : (
          /* Tab 2: pearDrop Reverse (pearOS to Phone - Feature 15) */
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800">Files on pearOS Desktop</span>
              <button
                onClick={fetchLaptopFiles}
                className="text-[10px] text-blue-600 hover:text-blue-800 flex items-center gap-1 font-semibold"
              >
                <RefreshCw className={`w-3 h-3 ${loadingFiles ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>
            </div>

            <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1">
              {laptopFiles.length === 0 ? (
                <div className="text-center py-6 text-slate-400 text-xs">
                  {loadingFiles ? 'Scanning pearOS folders...' : 'No files found in ~/Downloads or ~/Desktop'}
                </div>
              ) : (
                laptopFiles.map((f, i) => (
                  <div
                    key={i}
                    onClick={() => handleDownloadFromLaptop(f)}
                    className="p-2.5 bg-slate-50 hover:bg-blue-50/60 rounded-2xl border border-slate-200/80 flex items-center justify-between cursor-pointer active:scale-98 transition-all group"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-7 h-7 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center shrink-0">
                        <FolderDown className="w-3.5 h-3.5" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-slate-900 truncate">{f.name}</p>
                        <p className="text-[10px] text-slate-400 font-mono">
                          {f.folder} • {(f.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                    </div>
                    <Download className="w-4 h-4 text-slate-400 group-hover:text-blue-600 shrink-0 ml-2" />
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
