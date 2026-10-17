import React, { useEffect, useState, useRef, useMemo } from 'react';
import {
  Smartphone, HardDrive, Folder, FileText, Image as ImageIcon, Film, Music,
  Download, Upload, Plus, Trash2, Edit3, Search, RefreshCw, X, Check,
  CheckSquare, Square, Archive, ArrowUp, Home, Copy, ShieldAlert,
  ShieldCheck, Play, Eye, FileArchive, Grid, List, ChevronRight, Zap,
  ExternalLink, Info, AlertTriangle, Layers, Filter
} from 'lucide-react';
import { api } from '../../services/api';
import { FileItem, FileListResponse, FileReadResponse } from '../../types';
import { useApp } from '../../context/AppContext';

type StorageTarget = 'phone' | 'kali';
type ViewMode = 'grid' | 'list';
type FileCategoryFilter = 'all' | 'folder' | 'image' | 'video' | 'audio' | 'document' | 'archive';
type SortField = 'name' | 'size' | 'date';
type SortOrder = 'asc' | 'desc';

interface QuickCategory {
  id: string;
  name: string;
  path: string;
  icon: string;
  badge: string;
  color: string;
}

export const StitchFileManagerView: React.FC = () => {
  const { addNotification, isApk } = useApp();

  // Storage Target Selection
  const [target, setTarget] = useState<StorageTarget>('phone');
  const [deviceId] = useState<string>('oppo');

  // Navigation & Directory State
  const [currentPath, setCurrentPath] = useState<string>('');
  const [parentPath, setParentPath] = useState<string | null>(null);
  const [items, setItems] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isCached, setIsCached] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<FileCategoryFilter>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');

  // Storage Stats & Quick Categories
  const [storageInfo, setStorageInfo] = useState<any>(null);
  const [quickCategories, setQuickCategories] = useState<QuickCategory[]>([]);
  const [hasAllFilesAccess, setHasAllFilesAccess] = useState<boolean>(true);

  // Bulk Selection State
  const [selectionMode, setSelectionMode] = useState<boolean>(false);
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState<boolean>(false);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState<boolean>(false);

  // File Upload input ref
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploadingCount, setUploadingCount] = useState<number>(0);

  // Modals & Viewers
  const [previewFile, setPreviewFile] = useState<FileReadResponse | null>(null);
  const [editingContent, setEditingContent] = useState<string>('');
  const [savingFile, setSavingFile] = useState<boolean>(false);
  const [mediaPreview, setMediaPreview] = useState<{ url: string; name: string; type: 'image' | 'video' | 'audio' } | null>(null);
  const [showNewModal, setShowNewModal] = useState<boolean>(false);
  const [newItemName, setNewItemName] = useState<string>('');
  const [isFolderType, setIsFolderType] = useState<boolean>(false);
  const [deleteTarget, setDeleteTarget] = useState<FileItem | null>(null);
  const [renameTarget, setRenameTarget] = useState<FileItem | null>(null);
  const [newName, setNewName] = useState<string>('');
  const [fileDetails, setFileDetails] = useState<FileItem | null>(null);

  // ──────────────────────────────────────────────────────────────────────────
  // INITIALIZATION & DIRECTORY LOADING
  // ──────────────────────────────────────────────────────────────────────────

  const loadStorageMeta = async () => {
    try {
      if (target === 'phone') {
        const [catsRes, statsRes] = await Promise.all([
          api.getPhoneQuickCategories(deviceId),
          api.getPhoneStorageInfo(deviceId)
        ]);
        if (catsRes && catsRes.categories) setQuickCategories(catsRes.categories);
        if (statsRes) {
          setStorageInfo(statsRes);
          if (statsRes.has_all_files_access !== undefined) {
            setHasAllFilesAccess(statsRes.has_all_files_access);
          }
        }
      } else {
        // Kali storage info
        const sys = await api.getSystemStats();
        if (sys) {
          const totalGb = +(sys.disk_total_bytes / (1024 ** 3)).toFixed(1);
          const usedGb = +(sys.disk_used_bytes / (1024 ** 3)).toFixed(1);
          const freeGb = +(sys.disk_free_bytes / (1024 ** 3)).toFixed(1);
          setStorageInfo({
            total_gb: totalGb,
            used_gb: usedGb,
            free_gb: freeGb,
            used_percent: sys.disk_percent,
            breakdown: null
          });
        }
      }
    } catch (_) {}
  };

  const loadDirectory = async (path: string) => {
    setLoading(true);
    try {
      if (target === 'phone') {
        const res = await api.listPhoneFiles(path, deviceId);
        setCurrentPath(res.current_path || path || '/storage/emulated/0');
        setParentPath(res.parent_path ?? null);
        setItems(res.items || []);
        setIsCached(!!(res as any).is_cached);
      } else {
        const res = await api.listFiles(path);
        setCurrentPath(res.current_path || '');
        setParentPath(res.parent_path ?? null);
        setItems(res.items || []);
        setIsCached(false);
      }
      setSelectedPaths(new Set());
    } catch (err: any) {
      addNotification('Load Failed', err.message || 'Error opening directory', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStorageMeta();
    const initialPath = target === 'phone' ? '/storage/emulated/0' : '';
    loadDirectory(initialPath);
  }, [target, deviceId]);

  // ──────────────────────────────────────────────────────────────────────────
  // BREADCRUMBS & NAVIGATION
  // ──────────────────────────────────────────────────────────────────────────

  const breadcrumbs = useMemo(() => {
    if (!currentPath) return [];
    const parts = currentPath.split('/').filter(Boolean);
    const crumbs = [];
    let accum = '';
    for (let i = 0; i < parts.length; i++) {
      accum += '/' + parts[i];
      crumbs.push({ name: parts[i], path: accum });
    }
    return crumbs;
  }, [currentPath]);

  const handleOpenItem = (item: FileItem) => {
    if (item.is_dir) {
      loadDirectory(item.path);
      return;
    }

    const mime = (item.mime_type || '').toLowerCase();
    const ext = (item.extension || '').toLowerCase();

    // Image preview
    if (mime.startsWith('image/') || ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.svg'].includes(ext)) {
      const url = target === 'phone'
        ? `/api/phone-files/download?path=${encodeURIComponent(item.path)}&device_id=${encodeURIComponent(deviceId)}&inline=true`
        : `/api/files/download?path=${encodeURIComponent(item.path)}&inline=true`;
      setMediaPreview({ url, name: item.name, type: 'image' });
      return;
    }

    // Video preview
    if (mime.startsWith('video/') || ['.mp4', '.mkv', '.webm', '.mov'].includes(ext)) {
      const url = target === 'phone'
        ? `/api/phone-files/download?path=${encodeURIComponent(item.path)}&device_id=${encodeURIComponent(deviceId)}&inline=true`
        : `/api/files/download?path=${encodeURIComponent(item.path)}&inline=true`;
      setMediaPreview({ url, name: item.name, type: 'video' });
      return;
    }

    // Audio preview
    if (mime.startsWith('audio/') || ['.mp3', '.wav', '.ogg', '.m4a', '.flac'].includes(ext)) {
      const url = target === 'phone'
        ? `/api/phone-files/download?path=${encodeURIComponent(item.path)}&device_id=${encodeURIComponent(deviceId)}&inline=true`
        : `/api/files/download?path=${encodeURIComponent(item.path)}&inline=true`;
      setMediaPreview({ url, name: item.name, type: 'audio' });
      return;
    }

    // Code & Text viewer/editor
    handleReadTextFile(item.path);
  };

  const handleReadTextFile = async (path: string) => {
    try {
      const res = target === 'phone'
        ? await api.readPhoneFile(path, deviceId)
        : await api.readFile(path);

      setPreviewFile(res);
      setEditingContent(res.content || '');
    } catch (err: any) {
      addNotification('Preview Unavailable', err.message || 'Cannot preview this binary file', 'info');
    }
  };

  const handleSaveTextFile = async () => {
    if (!previewFile) return;
    setSavingFile(true);
    try {
      if (target === 'phone') {
        await api.writePhoneFile(previewFile.path, editingContent, deviceId);
      } else {
        await api.writeFile(previewFile.path, editingContent);
      }
      addNotification('Saved', `Changes committed to "${previewFile.name}"`, 'success');
      setPreviewFile(null);
      loadDirectory(currentPath);
    } catch (err: any) {
      addNotification('Save Failed', err.message, 'error');
    } finally {
      setSavingFile(false);
    }
  };

  // ──────────────────────────────────────────────────────────────────────────
  // DOWNLOAD & EXPORT HANDLERS
  // ──────────────────────────────────────────────────────────────────────────

  const handleDownloadItem = (e: React.MouseEvent | null, item: FileItem) => {
    if (e) e.stopPropagation();
    try {
      const isZip = item.is_dir || item.name.toLowerCase().endsWith('.zip');
      const resolvedName = item.is_dir ? `${item.name}.zip` : item.name;
      const downloadUrl = target === 'phone'
        ? `/api/phone-files/download?path=${encodeURIComponent(item.path)}&device_id=${encodeURIComponent(deviceId)}`
        : `/api/files/download?path=${encodeURIComponent(item.path)}`;

      const bridge = (window as any).AndroidBridge;
      if (bridge && typeof bridge.downloadFile === 'function') {
        bridge.downloadFile(downloadUrl, resolvedName, isZip ? 'application/zip' : 'application/octet-stream');
        addNotification('Downloading to Mobile', `Saving "${resolvedName}" to mobile Downloads`, 'success');
        return;
      }

      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = resolvedName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      addNotification(isZip ? 'Exporting ZIP' : 'Downloading File', `Downloading "${resolvedName}"...`, 'info');
    } catch (err: any) {
      addNotification('Download Failed', err.message, 'error');
    }
  };

  const handleDownloadCurrentFolderZip = (e: React.MouseEvent) => {
    e.stopPropagation();
    const folderName = currentPath.split('/').filter(Boolean).pop() || (target === 'phone' ? 'phone_storage' : 'kali_folder');
    const pseudoItem: FileItem = {
      name: folderName,
      path: currentPath,
      is_dir: true,
      size_bytes: 0,
      modified_time: '',
      permissions: '',
      mime_type: 'folder',
      extension: ''
    };
    handleDownloadItem(null, pseudoItem);
  };

  // ──────────────────────────────────────────────────────────────────────────
  // BULK OPERATIONS
  // ──────────────────────────────────────────────────────────────────────────

  const toggleSelectItem = (path: string) => {
    setSelectedPaths(prev => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const selectAll = () => {
    setSelectedPaths(new Set(filteredItems.map(i => i.path)));
  };

  const deselectAll = () => {
    setSelectedPaths(new Set());
  };

  const handleBulkExport = async () => {
    if (selectedPaths.size === 0) return;
    try {
      addNotification('Packaging ZIP', `Compressing ${selectedPaths.size} items...`, 'info');
      const pathsArray = Array.from(selectedPaths);
      if (target === 'phone') {
        await api.bulkPhoneDownloadZip(pathsArray, deviceId);
      } else {
        await api.bulkDownload(pathsArray);
      }
      addNotification('Export Complete', `Downloaded ${selectedPaths.size} items as ZIP`, 'success');
    } catch (err: any) {
      addNotification('Export Failed', err.message, 'error');
    }
  };

  const handleBulkDelete = async () => {
    if (selectedPaths.size === 0) return;
    setBulkDeleting(true);
    try {
      const pathsArray = Array.from(selectedPaths);
      if (target === 'phone') {
        for (const p of pathsArray) {
          await api.deletePhoneFile(p, deviceId);
        }
      } else {
        await api.bulkDelete(pathsArray, true);
      }
      addNotification('Deleted', `Successfully deleted ${pathsArray.length} items`, 'success');
      setShowBulkDeleteConfirm(false);
      setSelectedPaths(new Set());
      setSelectionMode(false);
      loadDirectory(currentPath);
    } catch (err: any) {
      addNotification('Bulk Delete Failed', err.message, 'error');
    } finally {
      setBulkDeleting(false);
    }
  };

  // ──────────────────────────────────────────────────────────────────────────
  // FILE CREATION, DELETION & UPLOADS
  // ──────────────────────────────────────────────────────────────────────────

  const handleCreateItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName.trim()) return;
    const dest = `${currentPath.replace(/\/+$/, '')}/${newItemName.trim()}`;
    try {
      if (target === 'phone') {
        await api.createPhoneItem(dest, isFolderType, deviceId);
      } else {
        await api.createItem(dest, isFolderType);
      }
      addNotification('Created', `Created ${isFolderType ? 'folder' : 'file'} "${newItemName}"`, 'success');
      setShowNewModal(false);
      setNewItemName('');
      loadDirectory(currentPath);
    } catch (err: any) {
      addNotification('Create Failed', err.message, 'error');
    }
  };

  const handleDeleteItem = async () => {
    if (!deleteTarget) return;
    try {
      if (target === 'phone') {
        await api.deletePhoneFile(deleteTarget.path, deviceId);
      } else {
        await api.deleteItem(deleteTarget.path, true);
      }
      addNotification('Deleted', `Removed "${deleteTarget.name}"`, 'success');
      setDeleteTarget(null);
      loadDirectory(currentPath);
    } catch (err: any) {
      addNotification('Delete Failed', err.message, 'error');
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const files = e.target.files;
    setUploadingCount(files.length);
    addNotification('Uploading', `Transferring ${files.length} file(s) to ${target === 'phone' ? 'Phone' : 'Kali'}...`, 'info');
    try {
      if (target === 'phone') {
        await api.uploadPhoneFiles(currentPath, files, deviceId);
      } else {
        await api.bulkUpload(currentPath, files);
      }
      addNotification('Upload Complete', `Uploaded ${files.length} file(s)`, 'success');
      loadDirectory(currentPath);
    } catch (err: any) {
      addNotification('Upload Failed', err.message, 'error');
    } finally {
      setUploadingCount(0);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleGrantAllFilesAccess = () => {
    const bridge = (window as any).AndroidBridge;
    if (bridge && typeof bridge.requestAllFilesAccess === 'function') {
      bridge.requestAllFilesAccess();
      addNotification('Permission Sent', 'Opening Android All Files Access settings...', 'info');
    } else {
      addNotification('Action Notice', 'Please allow "All Files Access" in your Android device settings.', 'info');
    }
  };

  // ──────────────────────────────────────────────────────────────────────────
  // FILTERING & SORTING
  // ──────────────────────────────────────────────────────────────────────────

  const filteredItems = useMemo(() => {
    return items
      .filter(item => {
        if (searchQuery.trim()) {
          if (!item.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
        }
        if (categoryFilter === 'all') return true;
        if (categoryFilter === 'folder') return item.is_dir;

        const mime = (item.mime_type || '').toLowerCase();
        const ext = (item.extension || '').toLowerCase();

        if (categoryFilter === 'image') return mime.startsWith('image/') || ['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(ext);
        if (categoryFilter === 'video') return mime.startsWith('video/') || ['.mp4', '.mkv', '.webm', '.mov'].includes(ext);
        if (categoryFilter === 'audio') return mime.startsWith('audio/') || ['.mp3', '.wav', '.ogg', '.m4a', '.flac'].includes(ext);
        if (categoryFilter === 'document') return mime.startsWith('text/') || ['.pdf', '.txt', '.doc', '.docx', '.json', '.md'].includes(ext);
        if (categoryFilter === 'archive') return mime.includes('zip') || mime.includes('tar') || ['.zip', '.tar', '.gz', '.rar', '.7z'].includes(ext);
        return true;
      })
      .sort((a, b) => {
        if (a.is_dir !== b.is_dir) return a.is_dir ? -1 : 1; // Folders always first
        let diff = 0;
        if (sortField === 'name') diff = a.name.localeCompare(b.name);
        else if (sortField === 'size') diff = a.size_bytes - b.size_bytes;
        else if (sortField === 'date') diff = a.modified_time.localeCompare(b.modified_time);
        return sortOrder === 'asc' ? diff : -diff;
      });
  }, [items, searchQuery, categoryFilter, sortField, sortOrder]);

  const getFileIcon = (item: FileItem) => {
    if (item.is_dir) return <Folder className="w-5 h-5 text-amber-400 shrink-0" />;
    const mime = (item.mime_type || '').toLowerCase();
    const ext = (item.extension || '').toLowerCase();
    if (mime.startsWith('image/') || ['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) {
      return <ImageIcon className="w-5 h-5 text-cyan-400 shrink-0" />;
    }
    if (mime.startsWith('video/') || ['.mp4', '.mkv', '.webm'].includes(ext)) {
      return <Film className="w-5 h-5 text-rose-400 shrink-0" />;
    }
    if (mime.startsWith('audio/') || ['.mp3', '.wav', '.ogg'].includes(ext)) {
      return <Music className="w-5 h-5 text-purple-400 shrink-0" />;
    }
    if (ext === '.zip' || ext === '.tar' || ext === '.gz') {
      return <Archive className="w-5 h-5 text-emerald-400 shrink-0" />;
    }
    return <FileText className="w-5 h-5 text-slate-300 shrink-0" />;
  };

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] bg-[#030712] text-slate-100 select-none overflow-hidden">
      {/* Hidden File Input for Multi-File Upload */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        multiple
        className="hidden"
      />

      {/* ────────────────────────────────────────────────────────────────────── */}
      {/* 1. TOP TACTICAL COCKPIT HEADER & DUAL-STORAGE SWITCHER                 */}
      {/* ────────────────────────────────────────────────────────────────────── */}
      <header className="p-3 bg-slate-950/90 border-b border-cyan-500/20 backdrop-blur-xl shrink-0 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Storage Bay Switcher */}
          <div className="flex items-center space-x-1.5 p-1 bg-slate-900/90 border border-slate-800 rounded-xl">
            <button
              onClick={() => setTarget('phone')}
              className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                target === 'phone'
                  ? 'bg-gradient-to-r from-cyan-600 to-emerald-600 text-slate-950 shadow-md shadow-cyan-500/20'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Smartphone className="w-4 h-4" />
              <span>OPPO PHONE STORAGE</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            </button>

            <button
              onClick={() => setTarget('kali')}
              className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                target === 'kali'
                  ? 'bg-gradient-to-r from-cyan-600 to-emerald-600 text-slate-950 shadow-md shadow-cyan-500/20'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <HardDrive className="w-4 h-4" />
              <span>KALI LINUX HOST</span>
            </button>
          </div>

          {/* Device Telemetry Strip */}
          <div className="flex items-center space-x-2 text-xs font-mono">
            {target === 'phone' && (
              <div className="flex items-center space-x-1.5 px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-lg">
                <span className="text-[10px] uppercase font-bold tracking-wider">Device:</span>
                <span className="font-bold text-white">OPPO CPH2381</span>
                <span className="text-slate-500">•</span>
                <span>P2P RELAY</span>
              </div>
            )}

            {storageInfo && (
              <div className="hidden md:flex items-center space-x-1.5 px-2.5 py-1 bg-slate-900 border border-slate-800 text-slate-300 rounded-lg">
                <span className="text-cyan-400 font-bold">{storageInfo.free_gb} GB</span>
                <span className="text-slate-500">free of</span>
                <span className="text-slate-200 font-semibold">{storageInfo.total_gb} GB</span>
                <span className="text-slate-500 font-bold">({storageInfo.used_percent}% used)</span>
              </div>
            )}

            <button
              onClick={() => loadDirectory(currentPath)}
              className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-cyan-300 active:scale-95 transition-all"
              title="Refresh Directory"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-cyan-400' : ''}`} />
            </button>
          </div>
        </div>

        {/* Storage Breakdown Visualizer Bar (when available) */}
        {storageInfo && storageInfo.breakdown && (
          <div className="space-y-1">
            <div className="h-1.5 w-full bg-slate-900 rounded-full overflow-hidden flex">
              <div style={{ width: '35%' }} className="bg-cyan-400" title="Photos" />
              <div style={{ width: '25%' }} className="bg-emerald-400" title="Videos" />
              <div style={{ width: '12%' }} className="bg-purple-400" title="Audio" />
              <div style={{ width: '10%' }} className="bg-amber-400" title="Documents" />
              <div style={{ width: '18%' }} className="bg-slate-700" title="System & Apps" />
            </div>
            <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
              <span className="flex items-center space-x-1"><span className="w-1.5 h-1.5 rounded-full bg-cyan-400" /><span>Photos</span></span>
              <span className="flex items-center space-x-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /><span>Videos</span></span>
              <span className="flex items-center space-x-1"><span className="w-1.5 h-1.5 rounded-full bg-purple-400" /><span>Music</span></span>
              <span className="flex items-center space-x-1"><span className="w-1.5 h-1.5 rounded-full bg-amber-400" /><span>Docs</span></span>
              <span className="flex items-center space-x-1"><span className="w-1.5 h-1.5 rounded-full bg-slate-700" /><span>System</span></span>
            </div>
          </div>
        )}

        {/* Android Storage Permission Sentinel Notice */}
        {target === 'phone' && !hasAllFilesAccess && (
          <div className="flex items-center justify-between p-2 bg-amber-950/40 border border-amber-500/50 rounded-xl text-xs text-amber-200 animate-in fade-in">
            <div className="flex items-center space-x-2">
              <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Full Filesystem Access required on Android 11–15 to browse all internal storage folders.</span>
            </div>
            <button
              onClick={handleGrantAllFilesAccess}
              className="px-2.5 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg text-xs active:scale-95 transition-all shadow-md shadow-amber-500/20"
            >
              GRANT PERMISSION
            </button>
          </div>
        )}

        {/* ──────────────────────────────────────────────────────────────────── */}
        {/* 2. TACTICAL QUICK ACCESS DOCK (CAMERA, DOWNLOADS, DOCS, WHATSAPP)   */}
        {/* ──────────────────────────────────────────────────────────────────── */}
        {target === 'phone' && (
          <div className="flex items-center space-x-2 overflow-x-auto pb-1 scrollbar-none">
            {quickCategories.map(cat => (
              <button
                key={cat.id}
                onClick={() => loadDirectory(cat.path)}
                className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-xs whitespace-nowrap border transition-all ${
                  currentPath.startsWith(cat.path)
                    ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300 shadow-sm shadow-cyan-500/20'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                }`}
              >
                {cat.id === 'dcim' && <CameraIcon className="w-3.5 h-3.5 text-cyan-400" />}
                {cat.id === 'download' && <Download className="w-3.5 h-3.5 text-emerald-400" />}
                {cat.id === 'documents' && <FileText className="w-3.5 h-3.5 text-amber-400" />}
                {cat.id === 'pictures' && <ImageIcon className="w-3.5 h-3.5 text-sky-400" />}
                {cat.id === 'music' && <Music className="w-3.5 h-3.5 text-purple-400" />}
                {cat.id === 'movies' && <Film className="w-3.5 h-3.5 text-rose-400" />}
                {cat.id === 'root' && <HardDrive className="w-3.5 h-3.5 text-slate-400" />}
                <span className="font-medium">{cat.name}</span>
              </button>
            ))}
          </div>
        )}

        {/* ──────────────────────────────────────────────────────────────────── */}
        {/* 3. BREADCRUMBS & ACTION TOOLBAR                                      */}
        {/* ──────────────────────────────────────────────────────────────────── */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 pt-1 border-t border-slate-800/60">
          {/* Breadcrumb Navigation Trail */}
          <div className="flex items-center space-x-1 text-xs font-mono bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-800 overflow-x-auto flex-1">
            <button
              onClick={() => loadDirectory(target === 'phone' ? '/storage/emulated/0' : '')}
              className="p-1 hover:text-cyan-400 text-slate-400"
              title="Home Root"
            >
              <Home className="w-3.5 h-3.5" />
            </button>
            {parentPath && (
              <button
                onClick={() => loadDirectory(parentPath)}
                className="p-1 hover:text-cyan-400 text-slate-400"
                title="Up One Directory"
              >
                <ArrowUp className="w-3.5 h-3.5" />
              </button>
            )}
            <ChevronRight className="w-3 h-3 text-slate-600 shrink-0" />
            <div className="flex items-center space-x-1 truncate">
              {breadcrumbs.map((crumb, idx) => (
                <React.Fragment key={crumb.path}>
                  <button
                    onClick={() => loadDirectory(crumb.path)}
                    className={`hover:text-cyan-300 transition-colors truncate max-w-[120px] ${
                      idx === breadcrumbs.length - 1 ? 'font-bold text-cyan-400' : 'text-slate-400'
                    }`}
                  >
                    {crumb.name}
                  </button>
                  {idx < breadcrumbs.length - 1 && (
                    <ChevronRight className="w-3 h-3 text-slate-600 shrink-0" />
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>

          {/* Action Hub Buttons */}
          <div className="flex items-center space-x-2 shrink-0">
            {/* Multi-Selection Mode */}
            <button
              onClick={() => {
                setSelectionMode(!selectionMode);
                if (selectionMode) deselectAll();
              }}
              className={`p-1.5 px-2.5 rounded-lg border text-xs font-semibold flex items-center space-x-1 transition-all ${
                selectionMode
                  ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300 shadow-sm shadow-cyan-500/20'
                  : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800'
              }`}
            >
              <CheckSquare className="w-3.5 h-3.5" />
              <span>{selectionMode ? 'Done' : 'Select'}</span>
            </button>

            {/* ZIP Current Folder */}
            <button
              onClick={handleDownloadCurrentFolderZip}
              className="p-1.5 px-2.5 rounded-lg bg-slate-900 border border-slate-800 text-cyan-300 hover:bg-slate-800 flex items-center space-x-1 text-xs font-semibold active:scale-95 transition-all"
              title="Download entire current folder as a ZIP archive"
            >
              <Archive className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">ZIP Folder</span>
            </button>

            {/* Upload File */}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingCount > 0}
              className="p-1.5 px-2.5 rounded-lg bg-slate-900 border border-slate-800 text-emerald-400 hover:bg-slate-800 flex items-center space-x-1 text-xs font-semibold active:scale-95 transition-all"
              title="Upload files from your computer to this location"
            >
              <Upload className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Upload</span>
            </button>

            {/* New Folder/File */}
            <button
              onClick={() => {
                setIsFolderType(true);
                setShowNewModal(true);
              }}
              className="p-1.5 px-2.5 rounded-lg bg-cyan-600/30 border border-cyan-500/50 text-cyan-300 hover:bg-cyan-600/50 flex items-center space-x-1 text-xs font-semibold active:scale-95 transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">New</span>
            </button>

            {/* View Mode Switcher */}
            <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg p-0.5">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1 rounded ${viewMode === 'grid' ? 'bg-cyan-500/20 text-cyan-300' : 'text-slate-400 hover:text-white'}`}
                title="Grid View"
              >
                <Grid className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-1 rounded ${viewMode === 'list' ? 'bg-cyan-500/20 text-cyan-300' : 'text-slate-400 hover:text-white'}`}
                title="List View"
              >
                <List className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* ──────────────────────────────────────────────────────────────────── */}
        {/* 4. SEARCH & CATEGORY FILTER CHIPS                                   */}
        {/* ──────────────────────────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          {/* Category Filters */}
          <div className="flex items-center space-x-1 overflow-x-auto scrollbar-none text-xs">
            {(['all', 'folder', 'image', 'video', 'audio', 'document', 'archive'] as FileCategoryFilter[]).map(cat => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                className={`px-2.5 py-1 rounded-lg font-medium capitalize whitespace-nowrap transition-all ${
                  categoryFilter === cat
                    ? 'bg-cyan-500/20 border border-cyan-400 text-cyan-300'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {cat === 'all' ? 'All Files' : cat}
              </button>
            ))}
          </div>

          {/* Search Box */}
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Filter items..."
              className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-8 pr-3 py-1 text-xs text-slate-200 focus:outline-none focus:border-cyan-500 font-mono"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-2 text-slate-500 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Multi-Select Status Strip */}
        {selectionMode && (
          <div className="flex items-center justify-between bg-cyan-950/40 border border-cyan-500/30 rounded-xl px-3 py-1.5 text-xs text-cyan-300 animate-in fade-in">
            <div className="flex items-center space-x-2 font-mono text-[11px]">
              <span className="font-bold">{selectedPaths.size}</span>
              <span>of {filteredItems.length} selected</span>
            </div>
            <div className="flex items-center space-x-2">
              {selectedPaths.size > 0 && (
                <button
                  onClick={handleBulkExport}
                  className="px-2.5 py-0.5 bg-gradient-to-r from-cyan-600 to-emerald-600 text-slate-950 font-bold rounded-lg flex items-center space-x-1 text-[11px] active:scale-95 shadow-sm shadow-cyan-500/20"
                >
                  <Archive className="w-3 h-3" />
                  <span>Export ZIP ({selectedPaths.size})</span>
                </button>
              )}
              <button onClick={selectAll} className="text-[11px] underline hover:text-white">
                Select All
              </button>
              <span>•</span>
              <button onClick={deselectAll} className="text-[11px] underline hover:text-white">
                Clear
              </button>
            </div>
          </div>
        )}
      </header>

      {/* ────────────────────────────────────────────────────────────────────── */}
      {/* 5. MAIN FILE DIRECTORY EXPLORER                                        */}
      {/* ────────────────────────────────────────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto p-3 relative">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-28 text-slate-500 text-xs font-mono space-y-2">
            <RefreshCw className="w-6 h-6 animate-spin text-cyan-400" />
            <span>Scanning {target === 'phone' ? 'Phone Storage' : 'Kali Storage'}...</span>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-28 text-slate-500 text-xs font-mono space-y-2">
            <Folder className="w-8 h-8 text-slate-700" />
            <span>Directory is empty</span>
          </div>
        ) : viewMode === 'grid' ? (
          /* TACTICAL GRID VIEW */
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2.5">
            {filteredItems.map(item => {
              const isSelected = selectedPaths.has(item.path);
              return (
                <div
                  key={item.path}
                  onClick={() => handleOpenItem(item)}
                  className={`p-3 bg-slate-900/60 border rounded-xl flex flex-col justify-between cursor-pointer group transition-all relative select-none hover:shadow-lg ${
                    isSelected
                      ? 'border-cyan-400 bg-cyan-950/30 shadow-md shadow-cyan-500/10'
                      : 'border-slate-800/80 hover:border-cyan-500/50 hover:bg-slate-900'
                  }`}
                >
                  {/* Select Checkbox */}
                  {selectionMode && (
                    <div
                      onClick={e => {
                        e.stopPropagation();
                        toggleSelectItem(item.path);
                      }}
                      className="absolute top-2 left-2 z-10"
                    >
                      {isSelected ? (
                        <CheckSquare className="w-4 h-4 text-cyan-400" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-600 hover:text-slate-400" />
                      )}
                    </div>
                  )}

                  {/* Icon & Details */}
                  <div className="flex flex-col items-center text-center space-y-2 pt-1">
                    <div className="p-3 bg-slate-950/80 rounded-2xl border border-slate-800/80 group-hover:scale-105 transition-transform">
                      {getFileIcon(item)}
                    </div>
                    <div className="w-full">
                      <div className="text-xs font-semibold text-slate-200 truncate group-hover:text-cyan-300" title={item.name}>
                        {item.name}
                      </div>
                      <div className="text-[10px] font-mono text-slate-500 mt-0.5">
                        {item.is_dir ? 'Folder' : `${(item.size_bytes / 1024).toFixed(1)} KB`}
                      </div>
                    </div>
                  </div>

                  {/* Item Action Buttons */}
                  {!selectionMode && (
                    <div
                      className="flex items-center justify-center space-x-1 pt-2 mt-2 border-t border-slate-800/60 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={e => e.stopPropagation()}
                    >
                      <button
                        onClick={e => handleDownloadItem(e, item)}
                        className="p-1 rounded text-slate-400 hover:text-cyan-300"
                        title={item.is_dir ? 'Download Folder as ZIP' : 'Download File'}
                      >
                        {item.is_dir ? <Archive className="w-3.5 h-3.5" /> : <Download className="w-3.5 h-3.5" />}
                      </button>
                      <button
                        onClick={() => setFileDetails(item)}
                        className="p-1 rounded text-slate-400 hover:text-purple-300"
                        title="File Properties"
                      >
                        <Info className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setDeleteTarget(item)}
                        className="p-1 rounded text-slate-400 hover:text-rose-400"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          /* CYBER LIST VIEW */
          <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl overflow-hidden divide-y divide-slate-800/60">
            {filteredItems.map(item => {
              const isSelected = selectedPaths.has(item.path);
              return (
                <div
                  key={item.path}
                  onClick={() => handleOpenItem(item)}
                  className={`p-2.5 flex items-center justify-between cursor-pointer group transition-all ${
                    isSelected ? 'bg-cyan-950/30' : 'hover:bg-slate-900/80'
                  }`}
                >
                  <div className="flex items-center space-x-3 truncate">
                    {selectionMode && (
                      <div
                        onClick={e => {
                          e.stopPropagation();
                          toggleSelectItem(item.path);
                        }}
                      >
                        {isSelected ? (
                          <CheckSquare className="w-4 h-4 text-cyan-400" />
                        ) : (
                          <Square className="w-4 h-4 text-slate-600" />
                        )}
                      </div>
                    )}
                    {getFileIcon(item)}
                    <div className="truncate">
                      <div className="text-xs font-semibold text-slate-200 truncate group-hover:text-cyan-300">
                        {item.name}
                      </div>
                      <div className="text-[10px] font-mono text-slate-500 space-x-2">
                        <span>{item.is_dir ? 'Folder' : `${(item.size_bytes / 1024).toFixed(1)} KB`}</span>
                        <span>•</span>
                        <span>{item.modified_time}</span>
                      </div>
                    </div>
                  </div>

                  {!selectionMode && (
                    <div className="flex items-center space-x-1" onClick={e => e.stopPropagation()}>
                      <button
                        onClick={e => handleDownloadItem(e, item)}
                        className="p-1 text-slate-400 hover:text-cyan-300"
                        title={item.is_dir ? 'Download Folder as ZIP' : 'Download File'}
                      >
                        {item.is_dir ? <Archive className="w-3.5 h-3.5" /> : <Download className="w-3.5 h-3.5" />}
                      </button>
                      <button
                        onClick={() => setFileDetails(item)}
                        className="p-1 text-slate-400 hover:text-purple-300"
                        title="Properties"
                      >
                        <Info className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setDeleteTarget(item)}
                        className="p-1 text-slate-400 hover:text-rose-400"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* ────────────────────────────────────────────────────────────────────── */}
      {/* 6. FLOATING BATCH SELECTION DOCK                                       */}
      {/* ────────────────────────────────────────────────────────────────────── */}
      {selectedPaths.size > 0 && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-40 bg-slate-950/95 border border-cyan-500/50 rounded-2xl shadow-2xl backdrop-blur-xl px-4 py-2.5 flex items-center space-x-3 text-xs animate-in slide-in-from-bottom-4">
          <div className="font-mono text-cyan-400 font-bold pr-1 border-r border-slate-800">
            {selectedPaths.size} Selected
          </div>
          <button
            onClick={handleBulkExport}
            className="px-3 py-1.5 bg-gradient-to-r from-cyan-600 to-emerald-600 text-slate-950 font-bold rounded-xl flex items-center space-x-1.5 active:scale-95 shadow-md shadow-cyan-500/20"
          >
            <Archive className="w-3.5 h-3.5" />
            <span>Export ZIP</span>
          </button>
          <button
            onClick={() => setShowBulkDeleteConfirm(true)}
            className="px-3 py-1.5 bg-rose-600/30 border border-rose-500/50 text-rose-300 font-bold rounded-xl flex items-center space-x-1.5 active:scale-95"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Delete</span>
          </button>
          <button onClick={deselectAll} className="p-1 text-slate-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────────── */}
      {/* 7. MODALS (PREVIEWS, EDITORS, NEW ITEM, DELETE CONFIRMATION)           */}
      {/* ────────────────────────────────────────────────────────────────────── */}

      {/* Image / Video / Audio Media Preview Modal */}
      {mediaPreview && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-slate-950 border border-cyan-500/40 rounded-2xl max-w-4xl w-full max-h-[85vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="p-3 border-b border-slate-800 flex items-center justify-between">
              <span className="font-semibold text-xs text-cyan-300 truncate">{mediaPreview.name}</span>
              <button onClick={() => setMediaPreview(null)} className="p-1 text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 p-4 flex items-center justify-center bg-black/40 overflow-auto">
              {mediaPreview.type === 'image' && (
                <img src={mediaPreview.url} alt={mediaPreview.name} className="max-h-[65vh] object-contain rounded-lg shadow-xl" />
              )}
              {mediaPreview.type === 'video' && (
                <video src={mediaPreview.url} controls autoPlay className="max-h-[65vh] rounded-lg shadow-xl" />
              )}
              {mediaPreview.type === 'audio' && (
                <div className="p-8 flex flex-col items-center space-y-4">
                  <Music className="w-16 h-16 text-purple-400 animate-pulse" />
                  <audio src={mediaPreview.url} controls autoPlay className="w-72" />
                </div>
              )}
            </div>
            <div className="p-3 border-t border-slate-800 flex justify-end">
              <a
                href={mediaPreview.url}
                download={mediaPreview.name}
                className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold rounded-xl text-xs flex items-center space-x-1"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Save to Local</span>
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Code & Text File Editor Modal */}
      {previewFile && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-slate-950 border border-cyan-500/40 rounded-2xl max-w-4xl w-full h-[85vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="p-3 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center space-x-2 font-mono text-xs text-cyan-300 truncate">
                <FileText className="w-4 h-4" />
                <span className="font-bold truncate">{previewFile.name}</span>
                <span className="text-[10px] text-slate-500">({(previewFile.size_bytes / 1024).toFixed(1)} KB)</span>
              </div>
              <button onClick={() => setPreviewFile(null)} className="p-1 text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 p-3 bg-black/60 overflow-hidden flex flex-col">
              <textarea
                value={editingContent}
                onChange={e => setEditingContent(e.target.value)}
                className="w-full flex-1 bg-transparent text-slate-200 font-mono text-xs focus:outline-none resize-none leading-relaxed"
                spellCheck={false}
              />
            </div>
            <div className="p-3 border-t border-slate-800 flex items-center justify-between">
              <div className="text-[11px] font-mono text-slate-400">
                Target: <span className="text-cyan-400 font-semibold">{target === 'phone' ? 'Phone Storage' : 'Kali Linux'}</span>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setPreviewFile(null)}
                  className="px-3 py-1.5 rounded-xl border border-slate-800 text-xs text-slate-300 hover:bg-slate-900"
                >
                  Close
                </button>
                <button
                  onClick={handleSaveTextFile}
                  disabled={savingFile}
                  className="px-4 py-1.5 bg-gradient-to-r from-cyan-600 to-emerald-600 text-slate-950 font-bold rounded-xl text-xs flex items-center space-x-1"
                >
                  {savingFile ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                  <span>Save Changes</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* File Details Modal */}
      {fileDetails && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-950 border border-slate-800 rounded-2xl max-w-sm w-full p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center space-x-2 text-xs font-semibold text-slate-200">
                <Info className="w-4 h-4 text-cyan-400" />
                <span>File Properties</span>
              </div>
              <button onClick={() => setFileDetails(null)} className="p-1 text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="text-xs font-mono space-y-2 text-slate-300">
              <div><span className="text-slate-500">Name:</span> <span className="text-white font-semibold">{fileDetails.name}</span></div>
              <div className="break-all"><span className="text-slate-500">Path:</span> <span className="text-cyan-400">{fileDetails.path}</span></div>
              <div><span className="text-slate-500">Size:</span> {(fileDetails.size_bytes / 1024).toFixed(2)} KB ({fileDetails.size_bytes} bytes)</div>
              <div><span className="text-slate-500">Permissions:</span> {fileDetails.permissions}</div>
              <div><span className="text-slate-500">Modified:</span> {fileDetails.modified_time}</div>
              <div><span className="text-slate-500">MIME:</span> {fileDetails.mime_type}</div>
            </div>
            <div className="pt-2">
              <button
                onClick={() => setFileDetails(null)}
                className="w-full py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold rounded-xl text-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Item Modal */}
      {showNewModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form onSubmit={handleCreateItem} className="bg-slate-950 border border-cyan-500/40 rounded-2xl max-w-sm w-full p-4 space-y-3">
            <h3 className="font-semibold text-sm text-cyan-300">Create New {isFolderType ? 'Folder' : 'File'}</h3>
            <div className="flex space-x-2">
              <button
                type="button"
                onClick={() => setIsFolderType(true)}
                className={`flex-1 py-1.5 rounded-lg text-xs font-semibold ${isFolderType ? 'bg-cyan-500/20 border border-cyan-400 text-cyan-300' : 'bg-slate-900 text-slate-400'}`}
              >
                Folder
              </button>
              <button
                type="button"
                onClick={() => setIsFolderType(false)}
                className={`flex-1 py-1.5 rounded-lg text-xs font-semibold ${!isFolderType ? 'bg-cyan-500/20 border border-cyan-400 text-cyan-300' : 'bg-slate-900 text-slate-400'}`}
              >
                File
              </button>
            </div>
            <input
              type="text"
              autoFocus
              value={newItemName}
              onChange={e => setNewItemName(e.target.value)}
              placeholder={isFolderType ? "New Folder Name" : "example.txt"}
              className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-cyan-500 font-mono"
            />
            <div className="flex space-x-2 pt-2">
              <button
                type="submit"
                className="flex-1 py-2 bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold rounded-xl text-xs"
              >
                Create
              </button>
              <button
                type="button"
                onClick={() => setShowNewModal(false)}
                className="flex-1 py-2 bg-slate-900 text-slate-300 rounded-xl text-xs"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Delete Item Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-950 border border-rose-800 rounded-2xl max-w-sm w-full p-4 space-y-3">
            <h3 className="font-semibold text-sm text-rose-300">Confirm Deletion</h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              Are you sure you want to permanently delete <strong>{deleteTarget.name}</strong> from {target === 'phone' ? 'Phone Storage' : 'Kali Linux'}?
            </p>
            <div className="flex space-x-2 pt-2">
              <button
                onClick={handleDeleteItem}
                className="flex-1 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl text-xs"
              >
                Delete
              </button>
              <button
                onClick={() => setDeleteTarget(null)}
                className="flex-1 py-2 bg-slate-900 text-slate-300 rounded-xl text-xs"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Delete Confirmation Modal */}
      {showBulkDeleteConfirm && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-950 border border-rose-800 rounded-2xl max-w-sm w-full p-4 space-y-3">
            <h3 className="font-semibold text-sm text-rose-300">Confirm Bulk Deletion</h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              Permanently delete <strong>{selectedPaths.size} items</strong> from {target === 'phone' ? 'Phone Storage' : 'Kali Linux'}? This cannot be undone.
            </p>
            <div className="flex space-x-2 pt-2">
              <button
                onClick={handleBulkDelete}
                disabled={bulkDeleting}
                className="flex-1 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl text-xs flex items-center justify-center space-x-1"
              >
                {bulkDeleting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                <span>{bulkDeleting ? 'Deleting...' : `Delete ${selectedPaths.size} Items`}</span>
              </button>
              <button
                onClick={() => setShowBulkDeleteConfirm(false)}
                className="flex-1 py-2 bg-slate-900 text-slate-300 rounded-xl text-xs"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Simple Camera Icon component to avoid conflict
function CameraIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
      <circle cx="12" cy="13" r="3" />
    </svg>
  );
}
