/**
 * transferManager.ts
 * Real-time Upload and Download transfer tracking with precise progress,
 * speed calculation, multi-file batch tracking, and cancel support.
 */

export interface TransferSubItem {
  name: string;
  size: number;
  progress: number;
  status: 'waiting' | 'transferring' | 'completed' | 'error';
  errorMsg?: string;
}

export interface TransferItem {
  id: string;
  name: string;
  type: 'upload' | 'download';
  target: 'kali' | 'phone';
  status: 'preparing' | 'transferring' | 'completed' | 'error' | 'canceled';
  progress: number; // 0 to 100, or -1 for indeterminate
  bytesTransferred: number;
  totalBytes: number;
  speed: string;
  etaSeconds?: number;
  errorMsg?: string;
  subItems?: TransferSubItem[];
  startedAt: number;
  finishedAt?: number;
  cancel?: () => void;
}

export function formatBytes(bytes: number, decimals = 1): string {
  if (!bytes || bytes <= 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

export function formatSpeed(bytesPerSec: number): string {
  if (!bytesPerSec || bytesPerSec <= 0) return '0 KB/s';
  if (bytesPerSec < 1024 * 1024) {
    return `${(bytesPerSec / 1024).toFixed(1)} KB/s`;
  }
  return `${(bytesPerSec / (1024 * 1024)).toFixed(2)} MB/s`;
}

type TransferUpdateListener = (item: TransferItem) => void;

class TransferManager {
  private activeTransfers: Map<string, TransferItem> = new Map();
  private listeners: Set<(transfers: TransferItem[]) => void> = new Set();

  public subscribe(listener: (transfers: TransferItem[]) => void): () => void {
    this.listeners.add(listener);
    listener(this.getAll());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    const all = this.getAll();
    this.listeners.forEach(fn => fn(all));
  }

  public getAll(): TransferItem[] {
    return Array.from(this.activeTransfers.values()).sort((a, b) => b.startedAt - a.startedAt);
  }

  public get(id: string): TransferItem | undefined {
    return this.activeTransfers.get(id);
  }

  public update(id: string, updates: Partial<TransferItem>): void {
    const existing = this.activeTransfers.get(id);
    if (!existing) return;
    const updated = { ...existing, ...updates };
    this.activeTransfers.set(id, updated);
    this.notify();
  }

  public remove(id: string): void {
    this.activeTransfers.delete(id);
    this.notify();
  }

  public clearFinished(): void {
    for (const [id, t] of this.activeTransfers.entries()) {
      if (t.status === 'completed' || t.status === 'canceled' || t.status === 'error') {
        this.activeTransfers.delete(id);
      }
    }
    this.notify();
  }

  /**
   * Upload single or multiple files with real-time XHR progress tracking
   */
  public uploadFiles({
    target,
    path,
    files,
    deviceId = 'oppo',
    onComplete,
    onError
  }: {
    target: 'kali' | 'phone';
    path: string;
    files: File[] | FileList;
    deviceId?: string;
    onComplete?: () => void;
    onError?: (err: string) => void;
  }): { id: string; cancel: () => void } {
    const id = `upload_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const fileList = Array.from(files);
    const totalBytes = fileList.reduce((acc, f) => acc + f.size, 0);

    const subItems: TransferSubItem[] = fileList.map(f => ({
      name: f.name,
      size: f.size,
      progress: 0,
      status: 'waiting'
    }));

    const transferItem: TransferItem = {
      id,
      name: fileList.length === 1 ? fileList[0].name : `${fileList.length} files to ${target === 'phone' ? 'Phone' : 'Host'}`,
      type: 'upload',
      target,
      status: 'preparing',
      progress: 0,
      bytesTransferred: 0,
      totalBytes,
      speed: '0 KB/s',
      subItems,
      startedAt: Date.now()
    };

    let activeXhr: XMLHttpRequest | null = null;
    let isCanceled = false;

    const cancel = () => {
      isCanceled = true;
      if (activeXhr) {
        activeXhr.abort();
      }
      this.update(id, {
        status: 'canceled',
        finishedAt: Date.now(),
        errorMsg: 'Upload canceled by user'
      });
    };

    transferItem.cancel = cancel;
    this.activeTransfers.set(id, transferItem);
    this.notify();

    // Start sequential uploads
    (async () => {
      let cumulativeBytesUploaded = 0;
      let lastTime = Date.now();
      let lastLoadedBytes = 0;

      for (let i = 0; i < fileList.length; i++) {
        if (isCanceled) break;

        const currentFile = fileList[i];
        subItems[i].status = 'transferring';
        this.update(id, {
          status: 'transferring',
          subItems: [...subItems]
        });

        try {
          await new Promise<void>((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            activeXhr = xhr;

            const endpoint = target === 'phone' ? '/api/phone-files/upload' : '/api/files/upload';
            xhr.open('POST', endpoint, true);

            const formData = new FormData();
            formData.append('path', path);
            formData.append('file', currentFile);
            if (target === 'phone') {
              formData.append('device_id', deviceId);
            }

            xhr.upload.onprogress = (e: ProgressEvent) => {
              if (isCanceled) return;
              if (e.lengthComputable) {
                const currentFileLoaded = e.loaded;
                const totalLoaded = cumulativeBytesUploaded + currentFileLoaded;
                const percent = Math.min(99, Math.round((totalLoaded / totalBytes) * 100));

                subItems[i].progress = Math.round((currentFileLoaded / e.total) * 100);

                // Speed calculation
                const now = Date.now();
                const timeDiff = (now - lastTime) / 1000;
                let currentSpeed = transferItem.speed;
                let etaSeconds = transferItem.etaSeconds;

                if (timeDiff >= 0.3) {
                  const bytesDiff = totalLoaded - lastLoadedBytes;
                  const bytesPerSec = bytesDiff / timeDiff;
                  currentSpeed = formatSpeed(bytesPerSec);
                  if (bytesPerSec > 0) {
                    etaSeconds = Math.max(0, Math.round((totalBytes - totalLoaded) / bytesPerSec));
                  }
                  lastTime = now;
                  lastLoadedBytes = totalLoaded;
                }

                this.update(id, {
                  progress: percent,
                  bytesTransferred: totalLoaded,
                  speed: currentSpeed,
                  etaSeconds,
                  subItems: [...subItems]
                });
              }
            };

            xhr.onload = () => {
              if (xhr.status >= 200 && xhr.status < 300) {
                cumulativeBytesUploaded += currentFile.size;
                subItems[i].progress = 100;
                subItems[i].status = 'completed';
                this.update(id, {
                  bytesTransferred: cumulativeBytesUploaded,
                  subItems: [...subItems]
                });
                resolve();
              } else {
                subItems[i].status = 'error';
                subItems[i].errorMsg = `Server error ${xhr.status}`;
                reject(new Error(`Server responded with ${xhr.status}: ${xhr.statusText}`));
              }
            };

            xhr.onerror = () => {
              subItems[i].status = 'error';
              subItems[i].errorMsg = 'Network failed';
              reject(new Error('Network error during upload'));
            };

            xhr.onabort = () => {
              subItems[i].status = 'error';
              subItems[i].errorMsg = 'Canceled';
              reject(new Error('Canceled'));
            };

            xhr.send(formData);
          });
        } catch (err: any) {
          if (isCanceled) return;
          this.update(id, {
            status: 'error',
            errorMsg: err.message || 'Upload failed',
            finishedAt: Date.now(),
            subItems: [...subItems]
          });
          onError?.(err.message || 'Upload failed');
          return;
        }
      }

      if (!isCanceled) {
        this.update(id, {
          status: 'completed',
          progress: 100,
          bytesTransferred: totalBytes,
          speed: 'Done',
          etaSeconds: 0,
          finishedAt: Date.now(),
          subItems: [...subItems]
        });
        onComplete?.();
      }
    })();

    return { id, cancel };
  }

  /**
   * Download file or ZIP archive with real-time download progress bar
   */
  public downloadFile({
    url,
    filename,
    target = 'kali',
    isZip = false,
    onComplete,
    onError
  }: {
    url: string;
    filename: string;
    target?: 'kali' | 'phone';
    isZip?: boolean;
    onComplete?: () => void;
    onError?: (err: string) => void;
  }): { id: string; cancel: () => void } {
    const id = `download_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    const transferItem: TransferItem = {
      id,
      name: filename,
      type: 'download',
      target,
      status: 'preparing',
      progress: 0,
      bytesTransferred: 0,
      totalBytes: 0,
      speed: '0 KB/s',
      startedAt: Date.now()
    };

    let activeXhr: XMLHttpRequest | null = null;
    let isCanceled = false;

    const cancel = () => {
      isCanceled = true;
      if (activeXhr) {
        activeXhr.abort();
      }
      this.update(id, {
        status: 'canceled',
        finishedAt: Date.now(),
        errorMsg: 'Download canceled'
      });
    };

    transferItem.cancel = cancel;
    this.activeTransfers.set(id, transferItem);
    this.notify();

    const xhr = new XMLHttpRequest();
    activeXhr = xhr;
    xhr.open('GET', url, true);
    xhr.responseType = 'blob';

    let lastTime = Date.now();
    let lastLoadedBytes = 0;

    xhr.onprogress = (e: ProgressEvent) => {
      if (isCanceled) return;

      const loaded = e.loaded;
      const total = e.lengthComputable ? e.total : 0;
      const percent = total > 0 ? Math.min(99, Math.round((loaded / total) * 100)) : -1;

      const now = Date.now();
      const timeDiff = (now - lastTime) / 1000;
      let currentSpeed = transferItem.speed;
      let etaSeconds = transferItem.etaSeconds;

      if (timeDiff >= 0.3) {
        const bytesDiff = loaded - lastLoadedBytes;
        const bytesPerSec = bytesDiff / timeDiff;
        currentSpeed = formatSpeed(bytesPerSec);
        if (total > 0 && bytesPerSec > 0) {
          etaSeconds = Math.max(0, Math.round((total - loaded) / bytesPerSec));
        }
        lastTime = now;
        lastLoadedBytes = loaded;
      }

      this.update(id, {
        status: 'transferring',
        progress: percent,
        bytesTransferred: loaded,
        totalBytes: total,
        speed: currentSpeed,
        etaSeconds
      });
    };

    xhr.onload = () => {
      if (isCanceled) return;

      if (xhr.status >= 200 && xhr.status < 300) {
        const blob = xhr.response as Blob;
        const finalSize = blob ? blob.size : lastLoadedBytes;

        this.update(id, {
          status: 'completed',
          progress: 100,
          bytesTransferred: finalSize,
          totalBytes: finalSize,
          speed: 'Saved',
          etaSeconds: 0,
          finishedAt: Date.now()
        });

        // Trigger local save via AndroidBridge or standard Blob download
        saveDownloadedBlob(blob, filename, isZip);
        onComplete?.();
      } else {
        this.update(id, {
          status: 'error',
          errorMsg: `Download failed with HTTP ${xhr.status}`,
          finishedAt: Date.now()
        });
        onError?.(`Server responded with ${xhr.status}`);
      }
    };

    xhr.onerror = () => {
      if (isCanceled) return;
      this.update(id, {
        status: 'error',
        errorMsg: 'Network error downloading file',
        finishedAt: Date.now()
      });
      onError?.('Network error during download');
    };

    xhr.onabort = () => {
      this.update(id, {
        status: 'canceled',
        errorMsg: 'Canceled by user',
        finishedAt: Date.now()
      });
    };

    xhr.send();

    return { id, cancel };
  }
}

/**
 * Saves a downloaded blob to the host machine or mobile storage
 */
function saveDownloadedBlob(blob: Blob, filename: string, isZip: boolean): void {
  try {
    const bridge = (window as any).AndroidBridge;
    const mimeType = isZip ? 'application/zip' : (blob.type || 'application/octet-stream');

    if (bridge && typeof bridge.saveBase64File === 'function') {
      const reader = new FileReader();
      reader.onloadend = () => {
        try {
          const base64Data = reader.result as string;
          bridge.saveBase64File(filename, base64Data, mimeType);
        } catch (_) {
          fallbackBlobAnchorDownload(blob, filename);
        }
      };
      reader.readAsDataURL(blob);
      return;
    }

    fallbackBlobAnchorDownload(blob, filename);
  } catch (err) {
    fallbackBlobAnchorDownload(blob, filename);
  }
}

function fallbackBlobAnchorDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => {
    try {
      URL.revokeObjectURL(url);
    } catch (_) {}
  }, 60000);
}

export const transferManager = new TransferManager();
