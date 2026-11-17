import React, { useState, useEffect } from 'react';
import {
  Upload, Download, X, Check, AlertCircle, ChevronUp, ChevronDown,
  RefreshCw, Smartphone, HardDrive, FileText, CheckCircle2, StopCircle
} from 'lucide-react';
import { transferManager, TransferItem, formatBytes } from '../../services/transferManager';

export const FileTransferProgress: React.FC = () => {
  const [transfers, setTransfers] = useState<TransferItem[]>([]);
  const [isExpanded, setIsExpanded] = useState<boolean>(true);

  useEffect(() => {
    const unsubscribe = transferManager.subscribe(list => {
      setTransfers(list);
    });
    return unsubscribe;
  }, []);

  if (transfers.length === 0) return null;

  const activeTransfers = transfers.filter(t => t.status === 'preparing' || t.status === 'transferring');
  const finishedTransfers = transfers.filter(t => t.status === 'completed' || t.status === 'error' || t.status === 'canceled');
  const primaryTransfer = activeTransfers[0] || finishedTransfers[0];

  if (!primaryTransfer) return null;

  const isUploading = primaryTransfer.type === 'upload';
  const isCompleted = primaryTransfer.status === 'completed';
  const isError = primaryTransfer.status === 'error';
  const isCanceled = primaryTransfer.status === 'canceled';

  return (
    <>
      {/* ──────────────────────────────────────────────────────────────────── */}
      {/* 1. TOP SLIM AMBIENT PROGRESS STRIP                                   */}
      {/* ──────────────────────────────────────────────────────────────────── */}
      {activeTransfers.length > 0 && (
        <div className="absolute top-0 left-0 right-0 z-40 h-1 bg-slate-900/80 overflow-hidden">
          <div
            className={`h-full transition-all duration-300 ${
              primaryTransfer.progress < 0
                ? 'w-full animate-pulse bg-gradient-to-r from-cyan-500 via-emerald-400 to-cyan-500'
                : 'bg-gradient-to-r from-cyan-500 via-emerald-400 to-cyan-400'
            }`}
            style={{
              width: primaryTransfer.progress >= 0 ? `${primaryTransfer.progress}%` : '100%',
              boxShadow: '0 0 10px rgba(6, 182, 212, 0.7)'
            }}
          />
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────── */}
      {/* 2. DOCKED / FLOATING TACTICAL TRANSFER CARD                           */}
      {/* ──────────────────────────────────────────────────────────────────── */}
      <div className="fixed bottom-16 sm:bottom-6 right-3 sm:right-6 z-50 max-w-sm w-[calc(100vw-1.5rem)] sm:w-96">
        <div
          className={`rounded-2xl border backdrop-blur-2xl shadow-2xl transition-all duration-300 overflow-hidden ${
            isCompleted
              ? 'bg-slate-950/95 border-emerald-500/50 shadow-emerald-500/10'
              : isError
              ? 'bg-slate-950/95 border-rose-500/50 shadow-rose-500/10'
              : 'bg-slate-950/95 border-cyan-500/40 shadow-cyan-500/10'
          }`}
        >
          {/* Card Header Strip */}
          <div className="p-3 flex items-center justify-between border-b border-slate-800/80 select-none bg-slate-900/50">
            <div className="flex items-center space-x-2 truncate">
              {/* Transfer Type Icon */}
              <div
                className={`p-1.5 rounded-lg border shrink-0 ${
                  isCompleted
                    ? 'bg-emerald-500/20 border-emerald-400/50 text-emerald-300'
                    : isError
                    ? 'bg-rose-500/20 border-rose-400/50 text-rose-300'
                    : isUploading
                    ? 'bg-emerald-500/20 border-emerald-400/50 text-emerald-400'
                    : 'bg-cyan-500/20 border-cyan-400/50 text-cyan-400'
                }`}
              >
                {isCompleted ? (
                  <Check className="w-4 h-4 text-emerald-400 animate-in zoom-in" />
                ) : isError ? (
                  <AlertCircle className="w-4 h-4 text-rose-400" />
                ) : isUploading ? (
                  <Upload className="w-4 h-4 animate-bounce" />
                ) : (
                  <Download className="w-4 h-4 animate-bounce" />
                )}
              </div>

              {/* Title & Target */}
              <div className="truncate">
                <div className="flex items-center space-x-1.5">
                  <span
                    className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                      isUploading
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                        : 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30'
                    }`}
                  >
                    {isUploading ? 'Upload' : 'Download'}
                  </span>

                  <span className="text-[10px] text-slate-400 font-mono flex items-center space-x-0.5">
                    {primaryTransfer.target === 'phone' ? (
                      <span className="flex items-center space-x-0.5 text-emerald-400">
                        <Smartphone className="w-3 h-3" />
                        <span>Phone</span>
                      </span>
                    ) : (
                      <span className="flex items-center space-x-0.5 text-cyan-400">
                        <HardDrive className="w-3 h-3" />
                        <span>Host</span>
                      </span>
                    )}
                  </span>
                </div>

                <div className="text-xs font-semibold text-slate-200 truncate mt-0.5 max-w-[200px]" title={primaryTransfer.name}>
                  {primaryTransfer.name}
                </div>
              </div>
            </div>

            {/* Header Right Actions */}
            <div className="flex items-center space-x-1 shrink-0">
              {/* Expand / Collapse toggle */}
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                title={isExpanded ? 'Collapse Details' : 'Expand Details'}
              >
                {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
              </button>

              {/* Cancel active transfer OR Dismiss completed */}
              {!isCompleted && !isError && !isCanceled && primaryTransfer.cancel ? (
                <button
                  onClick={primaryTransfer.cancel}
                  className="p-1 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-950/40"
                  title="Cancel Transfer"
                >
                  <X className="w-4 h-4" />
                </button>
              ) : (
                <button
                  onClick={() => transferManager.remove(primaryTransfer.id)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                  title="Dismiss"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Main Progress Bar & Metrics */}
          <div className="p-3 space-y-2 bg-slate-950/70">
            {/* Progress Bar Container */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-slate-400 flex items-center space-x-1.5">
                  {primaryTransfer.status === 'preparing' ? (
                    <span className="text-cyan-400 animate-pulse flex items-center space-x-1">
                      <RefreshCw className="w-3 h-3 animate-spin" />
                      <span>Preparing transfer...</span>
                    </span>
                  ) : isCompleted ? (
                    <span className="text-emerald-400 font-bold flex items-center space-x-1">
                      <CheckCircle2 className="w-3 h-3" />
                      <span>Transfer Complete</span>
                    </span>
                  ) : isError ? (
                    <span className="text-rose-400 font-semibold truncate max-w-[200px]" title={primaryTransfer.errorMsg}>
                      {primaryTransfer.errorMsg || 'Failed'}
                    </span>
                  ) : isCanceled ? (
                    <span className="text-slate-400">Canceled</span>
                  ) : (
                    <span className="text-cyan-300 font-medium">
                      {formatBytes(primaryTransfer.bytesTransferred)}
                      {primaryTransfer.totalBytes > 0 && ` / ${formatBytes(primaryTransfer.totalBytes)}`}
                    </span>
                  )}
                </span>

                <span
                  className={`font-bold ${
                    isCompleted
                      ? 'text-emerald-400'
                      : isError
                      ? 'text-rose-400'
                      : 'text-cyan-400'
                  }`}
                >
                  {primaryTransfer.progress >= 0 ? `${primaryTransfer.progress}%` : 'Streaming...'}
                </span>
              </div>

              {/* Animated Glowing Progress Bar Track */}
              <div className="h-2 w-full bg-slate-900 rounded-full overflow-hidden border border-slate-800/80 p-0.5">
                <div
                  className={`h-full rounded-full transition-all duration-200 ${
                    isCompleted
                      ? 'bg-gradient-to-r from-emerald-500 to-teal-400 shadow-sm shadow-emerald-500/50'
                      : isError
                      ? 'bg-rose-500'
                      : isCanceled
                      ? 'bg-slate-600'
                      : primaryTransfer.progress < 0
                      ? 'w-full animate-pulse bg-gradient-to-r from-cyan-500 via-emerald-400 to-cyan-500'
                      : 'bg-gradient-to-r from-cyan-500 via-emerald-400 to-cyan-400 shadow-sm shadow-cyan-500/50'
                  }`}
                  style={{
                    width: primaryTransfer.progress >= 0 ? `${primaryTransfer.progress}%` : '100%'
                  }}
                />
              </div>
            </div>

            {/* Bottom Meta Bar (Speed, ETA, Clear All) */}
            <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 pt-0.5">
              <div className="flex items-center space-x-2">
                {!isCompleted && !isError && !isCanceled && (
                  <>
                    <span className="text-slate-200 font-semibold">{primaryTransfer.speed}</span>
                    {primaryTransfer.etaSeconds !== undefined && primaryTransfer.etaSeconds > 0 && (
                      <>
                        <span className="text-slate-600">•</span>
                        <span>~{primaryTransfer.etaSeconds}s left</span>
                      </>
                    )}
                  </>
                )}
                {isCompleted && (
                  <span className="text-slate-300">
                    Saved {formatBytes(primaryTransfer.bytesTransferred)}
                  </span>
                )}
              </div>

              {transfers.length > 1 && (
                <button
                  onClick={() => transferManager.clearFinished()}
                  className="text-cyan-400 hover:text-cyan-300 underline text-[10px]"
                >
                  Clear Done
                </button>
              )}
            </div>

            {/* Detailed Sub-Items Drawer (when batch uploading multiple files) */}
            {isExpanded && primaryTransfer.subItems && primaryTransfer.subItems.length > 1 && (
              <div className="mt-2 pt-2 border-t border-slate-800/80 max-h-36 overflow-y-auto space-y-1.5 scrollbar-thin">
                {primaryTransfer.subItems.map((sub, idx) => (
                  <div
                    key={`${sub.name}_${idx}`}
                    className="p-1.5 rounded-lg bg-slate-900/60 border border-slate-800/60 flex items-center justify-between text-[10px] font-mono"
                  >
                    <div className="flex items-center space-x-1.5 truncate max-w-[190px]">
                      <FileText className="w-3 h-3 text-slate-400 shrink-0" />
                      <span className="text-slate-300 truncate" title={sub.name}>
                        {sub.name}
                      </span>
                    </div>

                    <div className="flex items-center space-x-2 shrink-0">
                      <span className="text-slate-500">{formatBytes(sub.size)}</span>
                      {sub.status === 'completed' && <Check className="w-3 h-3 text-emerald-400" />}
                      {sub.status === 'transferring' && (
                        <span className="text-cyan-400 font-bold">{sub.progress}%</span>
                      )}
                      {sub.status === 'waiting' && <span className="text-slate-600">waiting</span>}
                      {sub.status === 'error' && <span className="text-rose-400">err</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};
