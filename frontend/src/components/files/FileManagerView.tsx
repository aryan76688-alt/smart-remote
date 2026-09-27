import React, { useEffect, useState, useRef } from 'react';
import {
  Folder, FileText, Image as ImageIcon, ArrowLeft, Home,
  Upload, Plus, Trash2, Edit3, Download, Search, RefreshCw, X, Check,
  CheckSquare, Square, Archive, FileCheck, Layers
} from 'lucide-react';
import { api } from '../../services/api';
import { FileItem, FileListResponse, FileReadResponse } from '../../types';
import { useApp } from '../../context/AppContext';

export const FileManagerView: React.FC = () => {
  const { addNotification } = useApp();
  const [currentPath, setCurrentPath] = useState<string>('');
  const [parentPath, setParentPath] = useState<string | null>(null);
  const [allowedRoot, setAllowedRoot] = useState<string>('');
  const [items, setItems] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Bulk Selection State
  const [selectionMode, setSelectionMode] = useState<boolean>(false);
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState<boolean>(false);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState<boolean>(false);

  // File Upload input ref (multi-file)
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploadingCount, setUploadingCount] = useState<number>(0);

  // Modals
  const [previewFile, setPreviewFile] = useState<FileReadResponse | null>(null);
  const [editingContent, setEditingContent] = useState<string>('');
  const [showNewModal, setShowNewModal] = useState<boolean>(false);
  const [newItemName, setNewItemName] = useState<string>('');
  const [isFolderType, setIsFolderType] = useState<boolean>(false);
  const [deleteTarget, setDeleteTarget] = useState<FileItem | null>(null);
  const [renameTarget, setRenameTarget] = useState<FileItem | null>(null);
  const [newName, setNewName] = useState<string>('');

  const loadDirectory = async (path = '') => {
    setLoading(true);
    try {
      const res: FileListResponse = await api.listFiles(path);
      setCurrentPath(res.current_path);
      setParentPath(res.parent_path);
      setAllowedRoot(res.allowed_root);
      setItems(res.items);
      setSelectedPaths(new Set());
    } catch (err: any) {
      addNotification('File Manager', err.message || 'Failed to list directory', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDirectory();
  }, []);

  const handleOpenItem = async (item: FileItem) => {
    if (selectionMode) {
      toggleSelectItem(item.path);
      return;
    }

    if (item.is_dir) {
      loadDirectory(item.path);
    } else {
      try {
        const fileData = await api.readFile(item.path);
        setPreviewFile(fileData);
        setEditingContent(fileData.content || '');
      } catch (err: any) {
        addNotification('File Error', err.message, 'error');
      }
    }
  };

  // Selection handlers
  const toggleSelectItem = (path: string) => {
    setSelectedPaths(prev => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  const selectAll = () => {
    const all = new Set(filteredItems.map(i => i.path));
    setSelectedPaths(all);
  };

  const deselectAll = () => {
    setSelectedPaths(new Set());
  };

  // Bulk Export (Download Selected as ZIP)
  const handleBulkExport = async () => {
    if (selectedPaths.size === 0) return;
    try {
      addNotification('Exporting Files', `Creating ZIP archive of ${selectedPaths.size} items...`, 'info');
      await api.bulkDownload(Array.from(selectedPaths));
      addNotification('Export Complete', `Downloaded ${selectedPaths.size} files as ZIP`, 'success');
    } catch (err: any) {
      addNotification('Export Failed', err.message, 'error');
    }
  };

  // Bulk Delete
  const handleBulkDelete = async () => {
    if (selectedPaths.size === 0) return;
    setBulkDeleting(true);
    try {
      const res = await api.bulkDelete(Array.from(selectedPaths), true);
      addNotification('Bulk Deleted', `Deleted ${res.count} items`, 'success');
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

  // Multi-File Bulk Upload
  const handleBulkUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const files = e.target.files;
    setUploadingCount(files.length);
    addNotification('Uploading', `Uploading ${files.length} files to Kali...`, 'info');
    try {
      const res = await api.bulkUpload(currentPath, files);
      addNotification('Upload Complete', `Successfully imported ${res.count} files!`, 'success');
      loadDirectory(currentPath);
    } catch (err: any) {
      addNotification('Upload Failed', err.message, 'error');
    } finally {
      setUploadingCount(0);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleCreate = async () => {
    if (!newItemName.trim()) return;
    const fullPath = `${currentPath}/${newItemName.trim()}`;
    try {
      await api.createItem(fullPath, isFolderType);
      addNotification('File Created', `Created ${isFolderType ? 'folder' : 'file'}: ${newItemName}`, 'success');
      setShowNewModal(false);
      setNewItemName('');
      loadDirectory(currentPath);
    } catch (err: any) {
      addNotification('Error', err.message, 'error');
    }
  };

  const handleDeleteSingle = async () => {
    if (!deleteTarget) return;
    try {
      await api.deleteItem(deleteTarget.path, true);
      addNotification('Deleted', `Deleted ${deleteTarget.name}`, 'info');
      setDeleteTarget(null);
      loadDirectory(currentPath);
    } catch (err: any) {
      addNotification('Error', err.message, 'error');
    }
  };

  const handleRename = async () => {
    if (!renameTarget || !newName.trim()) return;
    const targetDir = renameTarget.path.substring(0, renameTarget.path.lastIndexOf('/'));
    const newFullPath = `${targetDir}/${newName.trim()}`;
    try {
      await api.renameItem(renameTarget.path, newFullPath);
      addNotification('Renamed', `Renamed to ${newName}`, 'success');
      setRenameTarget(null);
      setNewName('');
      loadDirectory(currentPath);
    } catch (err: any) {
      addNotification('Error', err.message, 'error');
    }
  };

  const handleSaveTextFile = async () => {
    if (!previewFile) return;
    try {
      await api.writeFile(previewFile.path, editingContent);
      addNotification('File Saved', `Updated ${previewFile.name}`, 'success');
    } catch (err: any) {
      addNotification('Save Failed', err.message, 'error');
    }
  };

  const filteredItems = items.filter(item =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] bg-cyber-bg select-none relative pb-16">
      {/* Hidden Multi-File Upload Input */}
      <input
        type="file"
        multiple
        ref={fileInputRef}
        onChange={handleBulkUpload}
        className="hidden"
      />

      {/* Top Toolbar & Breadcrumbs */}
      <div className="bg-cyber-surface border-b border-cyber-border p-3 space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-1.5">
            <button
              onClick={() => parentPath && loadDirectory(parentPath)}
              disabled={!parentPath}
              className={`p-1.5 rounded-lg border ${
                parentPath ? 'bg-slate-900 border-slate-800 text-slate-200 hover:bg-slate-800' : 'opacity-40 text-slate-600 border-transparent'
              }`}
              title="Parent Folder"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => loadDirectory(allowedRoot)}
              className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-200 hover:bg-slate-800"
              title="Home Folder"
            >
              <Home className="w-4 h-4" />
            </button>
            <button
              onClick={() => loadDirectory(currentPath)}
              className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-200 hover:bg-slate-800"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          <div className="flex items-center space-x-2">
            {/* Multi-Select Mode Toggle */}
            <button
              onClick={() => {
                setSelectionMode(!selectionMode);
                if (selectionMode) deselectAll();
              }}
              className={`p-1.5 px-2.5 rounded-lg border text-xs font-semibold flex items-center space-x-1 transition-all ${
                selectionMode
                  ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300'
                  : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800'
              }`}
            >
              <CheckSquare className="w-3.5 h-3.5" />
              <span>{selectionMode ? 'Done' : 'Select'}</span>
            </button>

            {/* Multi-File Upload Button */}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingCount > 0}
              className="p-1.5 px-2.5 rounded-lg bg-slate-900 border border-slate-800 text-cyan-300 hover:bg-slate-800 flex items-center space-x-1 text-xs font-semibold active:scale-95"
              title="Import Files (Multiple)"
            >
              <Upload className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Import</span>
            </button>

            {/* New Item */}
            <button
              onClick={() => {
                setIsFolderType(true);
                setShowNewModal(true);
              }}
              className="p-1.5 px-2.5 rounded-lg bg-cyan-600/30 border border-cyan-500/50 text-cyan-300 hover:bg-cyan-600/50 flex items-center space-x-1 text-xs font-semibold active:scale-95"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New</span>
            </button>
          </div>
        </div>

        {/* Path & Search */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="text-xs font-mono text-cyan-400 truncate bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-900 flex-1">
            {currentPath || allowedRoot}
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search files & folders..."
              className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-1 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
            />
          </div>
        </div>

        {/* Bulk Selection Bar (when in selection mode) */}
        {selectionMode && (
          <div className="flex items-center justify-between bg-cyan-950/40 border border-cyan-500/30 rounded-xl px-3 py-1.5 text-xs text-cyan-300 animate-in fade-in">
            <div className="flex items-center space-x-2 font-mono text-[11px]">
              <span className="font-bold">{selectedPaths.size}</span>
              <span>of {filteredItems.length} selected</span>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={selectAll}
                className="text-[11px] underline hover:text-white"
              >
                Select All
              </button>
              <span>•</span>
              <button
                onClick={deselectAll}
                className="text-[11px] underline hover:text-white"
              >
                Clear
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Directory List Container */}
      <div className="flex-1 overflow-y-auto p-3">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-slate-500 text-xs font-mono">
            Loading directory contents...
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="text-center py-20 text-slate-500 text-xs font-mono">
            Directory is empty
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {filteredItems.map(item => {
              const isSelected = selectedPaths.has(item.path);
              return (
                <div
                  key={item.path}
                  onClick={() => handleOpenItem(item)}
                  className={`p-3 bg-cyber-surface border rounded-xl flex items-center justify-between cursor-pointer group transition-all ${
                    isSelected
                      ? 'border-cyan-400 bg-cyan-950/30 shadow-md shadow-cyan-500/10'
                      : 'border-slate-800 hover:border-cyan-500/50'
                  }`}
                >
                  <div className="flex items-center space-x-3 truncate">
                    {/* Checkbox in selection mode */}
                    {selectionMode ? (
                      <div
                        onClick={e => {
                          e.stopPropagation();
                          toggleSelectItem(item.path);
                        }}
                        className="p-1 -ml-1 text-cyan-400 hover:text-cyan-300"
                      >
                        {isSelected ? (
                          <CheckSquare className="w-5 h-5 fill-cyan-500/20 text-cyan-400" />
                        ) : (
                          <Square className="w-5 h-5 text-slate-600" />
                        )}
                      </div>
                    ) : null}

                    {item.is_dir ? (
                      <Folder className="w-5 h-5 text-cyan-400 shrink-0" />
                    ) : item.mime_type?.startsWith('image/') ? (
                      <ImageIcon className="w-5 h-5 text-purple-400 shrink-0" />
                    ) : (
                      <FileText className="w-5 h-5 text-emerald-400 shrink-0" />
                    )}
                    <div className="truncate">
                      <div className="text-xs font-medium text-slate-200 truncate group-hover:text-cyan-300">
                        {item.name}
                      </div>
                      <div className="text-[10px] font-mono text-slate-500 space-x-2">
                        <span>{item.is_dir ? 'Folder' : `${(item.size_bytes / 1024).toFixed(1)} KB`}</span>
                        <span>•</span>
                        <span>{item.permissions}</span>
                      </div>
                    </div>
                  </div>

                  {!selectionMode && (
                    <div className="flex items-center space-x-1 opacity-80 group-hover:opacity-100" onClick={e => e.stopPropagation()}>
                      {!item.is_dir && (
                        <a
                          href={`/api/files/download?path=${encodeURIComponent(item.path)}`}
                          download
                          className="p-1 text-slate-400 hover:text-cyan-300"
                          title="Download"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </a>
                      )}
                      <button
                        onClick={() => {
                          setRenameTarget(item);
                          setNewName(item.name);
                        }}
                        className="p-1 text-slate-400 hover:text-amber-300"
                        title="Rename"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
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
      </div>

      {/* Floating Bottom Action Bar for Bulk Selection */}
      {selectedPaths.size > 0 && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-40 bg-slate-950/95 border border-cyan-500/50 rounded-2xl shadow-2xl backdrop-blur-xl px-4 py-2.5 flex items-center space-x-3 text-xs animate-in slide-in-from-bottom-4">
          <div className="font-mono text-cyan-400 font-bold text-xs pr-1 border-r border-slate-800">
            {selectedPaths.size} Selected
          </div>

          {/* Download ZIP */}
          <button
            onClick={handleBulkExport}
            className="px-3 py-1.5 bg-gradient-to-r from-cyan-600 to-emerald-600 hover:from-cyan-500 hover:to-emerald-500 text-slate-950 font-bold rounded-xl flex items-center space-x-1.5 shadow-md shadow-cyan-500/20 active:scale-95"
            title="Download all selected items as a ZIP archive"
          >
            <Archive className="w-3.5 h-3.5" />
            <span>Export ZIP</span>
          </button>

          {/* Bulk Delete */}
          <button
            onClick={() => setShowBulkDeleteConfirm(true)}
            className="px-3 py-1.5 bg-rose-600/30 hover:bg-rose-600/50 border border-rose-500/50 text-rose-300 font-bold rounded-xl flex items-center space-x-1.5 active:scale-95"
            title="Delete all selected items"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Delete</span>
          </button>

          {/* Clear */}
          <button
            onClick={deselectAll}
            className="p-1 text-slate-400 hover:text-white"
            title="Clear Selection"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Bulk Delete Confirmation Modal */}
      {showBulkDeleteConfirm && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-cyber-surface border border-rose-800/80 rounded-2xl p-5 max-w-sm w-full space-y-3 shadow-2xl">
            <h3 className="font-semibold text-sm text-rose-300">Confirm Bulk Deletion</h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              Are you sure you want to permanently delete <strong>{selectedPaths.size} items</strong> from Kali Linux? This operation cannot be undone.
            </p>
            <div className="flex space-x-2 pt-2">
              <button
                onClick={handleBulkDelete}
                disabled={bulkDeleting}
                className="flex-1 py-2 bg-rose-600 hover:bg-rose-500 text-white font-semibold rounded-xl text-xs disabled:opacity-50 flex items-center justify-center space-x-1"
              >
                {bulkDeleting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                <span>{bulkDeleting ? 'Deleting...' : `Delete ${selectedPaths.size} Items`}</span>
              </button>
              <button
                onClick={() => setShowBulkDeleteConfirm(false)}
                className="flex-1 py-2 bg-slate-800 text-slate-300 rounded-xl text-xs"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Text Preview / Editor Modal */}
      {previewFile && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-md z-50 flex items-center justify-center p-4 select-text">
          <div className="bg-cyber-surface border border-cyan-500/40 rounded-2xl w-full max-w-3xl h-[85vh] flex flex-col justify-between shadow-2xl overflow-hidden">
            <div className="p-3 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center space-x-2 font-mono text-xs text-cyan-300">
                <FileText className="w-4 h-4" />
                <span className="truncate">{previewFile.name}</span>
              </div>
              <div className="flex items-center space-x-2">
                {previewFile.is_text && (
                  <button
                    onClick={handleSaveTextFile}
                    className="px-3 py-1 bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold rounded-lg text-xs"
                  >
                    Save Changes
                  </button>
                )}
                <button
                  onClick={() => setPreviewFile(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 p-3 overflow-auto bg-slate-950">
              {previewFile.is_text ? (
                <textarea
                  value={editingContent}
                  onChange={e => setEditingContent(e.target.value)}
                  className="w-full h-full bg-transparent font-mono text-xs text-slate-200 focus:outline-none resize-none"
                />
              ) : previewFile.mime_type.startsWith('image/') ? (
                <div className="flex items-center justify-center h-full">
                  <img
                    src={`/api/files/download?path=${encodeURIComponent(previewFile.path)}`}
                    alt={previewFile.name}
                    className="max-w-full max-h-full object-contain rounded-lg"
                  />
                </div>
              ) : (
                <div className="text-center py-20 text-slate-500 text-xs font-mono">
                  Binary file preview not supported inline. Use the download button.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* New File / Folder Modal */}
      {showNewModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-cyber-surface border border-slate-800 rounded-2xl p-5 max-w-sm w-full space-y-4 shadow-2xl">
            <h3 className="font-semibold text-sm text-slate-100">Create New Item</h3>
            <div className="flex space-x-2">
              <button
                onClick={() => setIsFolderType(false)}
                className={`flex-1 py-1.5 rounded-lg border text-xs font-mono ${
                  !isFolderType ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300' : 'bg-slate-900 border-slate-800 text-slate-400'
                }`}
              >
                File
              </button>
              <button
                onClick={() => setIsFolderType(true)}
                className={`flex-1 py-1.5 rounded-lg border text-xs font-mono ${
                  isFolderType ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300' : 'bg-slate-900 border-slate-800 text-slate-400'
                }`}
              >
                Folder
              </button>
            </div>
            <input
              type="text"
              value={newItemName}
              onChange={e => setNewItemName(e.target.value)}
              placeholder="Name..."
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
              autoFocus
            />
            <div className="flex space-x-2">
              <button
                onClick={handleCreate}
                className="flex-1 py-2 bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-semibold rounded-xl text-xs"
              >
                Create
              </button>
              <button
                onClick={() => setShowNewModal(false)}
                className="flex-1 py-2 bg-slate-800 text-slate-300 rounded-xl text-xs"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-cyber-surface border border-rose-800/80 rounded-2xl p-5 max-w-sm w-full space-y-3 shadow-2xl">
            <h3 className="font-semibold text-sm text-rose-300">Confirm Deletion</h3>
            <p className="text-xs text-slate-300">
              Are you sure you want to permanently delete <strong>{deleteTarget.name}</strong>?
            </p>
            <div className="flex space-x-2 pt-2">
              <button
                onClick={handleDeleteSingle}
                className="flex-1 py-2 bg-rose-600 hover:bg-rose-500 text-white font-semibold rounded-xl text-xs"
              >
                Delete
              </button>
              <button
                onClick={() => setDeleteTarget(null)}
                className="flex-1 py-2 bg-slate-800 text-slate-300 rounded-xl text-xs"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rename Modal */}
      {renameTarget && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-cyber-surface border border-slate-800 rounded-2xl p-5 max-w-sm w-full space-y-3 shadow-2xl">
            <h3 className="font-semibold text-sm text-slate-100">Rename Item</h3>
            <input
              type="text"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
              autoFocus
            />
            <div className="flex space-x-2 pt-2">
              <button
                onClick={handleRename}
                className="flex-1 py-2 bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-semibold rounded-xl text-xs"
              >
                Rename
              </button>
              <button
                onClick={() => setRenameTarget(null)}
                className="flex-1 py-2 bg-slate-800 text-slate-300 rounded-xl text-xs"
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
