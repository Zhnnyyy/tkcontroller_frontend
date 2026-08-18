'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Socket } from 'socket.io-client';
import {
  Folder,
  File as FileIcon,
  ArrowLeft,
  Download,
  Upload,
  RefreshCw,
  Loader2,
  AlertCircle,
  FolderOpen,
} from 'lucide-react';
import { Device } from '@/lib/types';

interface FileManagerProps {
  socket: Socket | null;
  device: Device | null;
}

interface RemoteFile {
  name: string;
  is_dir: boolean;
  size: number;
  last_modified: number;
}

export function FileManager({ socket, device }: FileManagerProps) {
  const [currentPath, setCurrentPath] = useState('/sdcard/');
  const [files, setFiles] = useState<RemoteFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pathToInput, setPathToInput] = useState(currentPath);
  const [uploadProgress, setUploadProgress] = useState<{
    fileName: string;
    percent: number;
    transferred: number;
    total: number;
  } | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<{
    fileName: string;
    percent: number;
    transferred: number;
    total: number;
  } | null>(null);

  useEffect(() => {
    setPathToInput(currentPath);
  }, [currentPath]);

  const formatBytes = (bytes: number, decimals = 2) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };

  const formatDate = (timestamp: number) => {
    if (!timestamp) return 'Unknown';
    return new Date(timestamp).toLocaleString();
  };

  const fetchFiles = useCallback(
    (path: string) => {
      if (!socket || !device?.device_id) return;
      setLoading(true);
      setError(null);

      const localCommandId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      socket.emit(
        'send_command',
        {
          deviceId: device.device_id,
          device_id: device.device_id,
          command: 'list_files',
          command_id: localCommandId,
          payload: { path },
        },
        (response: any) => {
          setLoading(false);
          const devResp = response?.response;
          if (devResp?.status === 'success') {
            const fileList: RemoteFile[] = devResp.files || [];
            // Sort: folders first, then files alphabetically
            fileList.sort((a, b) => {
              if (a.is_dir && !b.is_dir) return -1;
              if (!a.is_dir && b.is_dir) return 1;
              return a.name.localeCompare(b.name);
            });
            setFiles(fileList);
            setCurrentPath(path);
          } else {
            setError(devResp?.message || response?.message || 'Failed to list directory');
          }
        }
      );
    },
    [socket, device?.device_id]
  );

  useEffect(() => {
    if (device?.device_id) {
      fetchFiles('/sdcard/');
    } else {
      setFiles([]);
      setCurrentPath('/sdcard/');
      setError(null);
    }
  }, [device?.device_id, fetchFiles]);

  const handleNavigate = (file: RemoteFile) => {
    if (!file.is_dir) return;
    let newPath = currentPath;
    if (!newPath.endsWith('/')) {
      newPath += '/';
    }
    newPath += file.name + '/';
    fetchFiles(newPath);
  };

  const handleGoBack = () => {
    if (currentPath === '/' || currentPath === '/sdcard/') return;
    const parts = currentPath.split('/').filter(Boolean);
    if (parts.length <= 1) {
      fetchFiles('/');
    } else {
      parts.pop();
      fetchFiles('/' + parts.join('/') + '/');
    }
  };

  const handleDownload = (file: RemoteFile) => {
    if (!socket || !device?.device_id || file.is_dir) return;

    const fullFilePath = currentPath.endsWith('/')
      ? `${currentPath}${file.name}`
      : `${currentPath}/${file.name}`;

    const localCommandId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const chunks: string[] = [];

    setDownloadProgress({
      fileName: file.name,
      percent: 0,
      transferred: 0,
      total: file.size,
    });

    const progressHandler = (progress: any) => {
      if (
        progress?.command_id !== localCommandId ||
        progress?.command !== 'download_file' ||
        progress?.device_id !== device.device_id
      ) {
        return;
      }

      if (progress.stage === 'chunk' && progress.chunk_data) {
        chunks.push(progress.chunk_data);
        setDownloadProgress({
          fileName: file.name,
          percent: progress.percent,
          transferred: progress.downloaded_bytes,
          total: progress.total_bytes,
        });
      }
    };

    socket.on('command_progress', progressHandler);

    socket.emit(
      'send_command',
      {
        deviceId: device.device_id,
        device_id: device.device_id,
        command: 'download_file',
        command_id: localCommandId,
        payload: { path: fullFilePath },
      },
      (response: any) => {
        socket.off('command_progress', progressHandler);
        setDownloadProgress(null);

        const devResp = response?.response;
        if (devResp?.status === 'success') {
          try {
            const byteArrays = chunks.map((chunk) => {
              const byteCharacters = atob(chunk);
              const byteNumbers = new Array(byteCharacters.length);
              for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
              }
              return new Uint8Array(byteNumbers);
            });
            const blob = new Blob(byteArrays, { type: 'application/octet-stream' });

            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = file.name;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
          } catch (e) {
            alert('Failed to process downloaded file: ' + (e instanceof Error ? e.message : String(e)));
          }
        } else {
          alert('Download failed: ' + (devResp?.message || 'Unknown error'));
        }
      }
    );
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile || !socket || !device?.device_id) return;

    setUploading(true);
    setUploadProgress({
      fileName: selectedFile.name,
      percent: 0,
      transferred: 0,
      total: selectedFile.size,
    });

    const targetFilePath = currentPath.endsWith('/')
      ? `${currentPath}${selectedFile.name}`
      : `${currentPath}/${selectedFile.name}`;

    const CHUNK_SIZE = 512 * 1024; // 512KB chunks
    const totalChunks = Math.ceil(selectedFile.size / CHUNK_SIZE);

    try {
      for (let i = 0; i < totalChunks; i++) {
        const start = i * CHUNK_SIZE;
        const end = Math.min(selectedFile.size, start + CHUNK_SIZE);
        const chunkBlob = selectedFile.slice(start, end);
        const base64Chunk = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (event) => {
            const result = event.target?.result as string;
            if (result) {
              resolve(result.split(',')[1]);
            } else {
              reject(new Error('FileReader returned empty result'));
            }
          };
          reader.onerror = () => reject(reader.error);
          reader.readAsDataURL(chunkBlob);
        });

        const isLast = i === totalChunks - 1;
        const localCommandId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

        const response: any = await new Promise((resolve) => {
          socket.emit(
            'send_command',
            {
              deviceId: device.device_id,
              device_id: device.device_id,
              command: 'upload_file',
              command_id: localCommandId,
              payload: {
                path: targetFilePath,
                content: base64Chunk,
                chunk_index: i,
                is_last: isLast,
              },
            },
            (res: any) => resolve(res)
          );
        });

        const devResp = response?.response;
        if (devResp?.status !== 'success') {
          throw new Error(devResp?.message || 'Chunk upload failed');
        }

        setUploadProgress({
          fileName: selectedFile.name,
          percent: Math.round(((i + 1) / totalChunks) * 100),
          transferred: end,
          total: selectedFile.size,
        });
      }

      setUploadProgress(null);
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
      fetchFiles(currentPath);
    } catch (err) {
      setUploadProgress(null);
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
      alert('Upload failed: ' + (err instanceof Error ? err.message : String(err)));
    }
  };

  if (!device) {
    return (
      <div className="card min-h-64 flex items-center justify-center border-dashed">
        <p className="text-foreground/50 font-medium">Select a device to browse files</p>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
            <FolderOpen className="w-5 h-5 text-primary" />
            Remote File Explorer
          </h2>
          <p className="mt-1 text-sm text-foreground/60">
            Browse, download, and upload files on the tablet
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            className="hidden"
          />
          <button
            type="button"
            className="btn-secondary flex items-center gap-2"
            onClick={handleUploadClick}
            disabled={loading || uploading}
          >
            {uploading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Upload className="w-4 h-4" />
            )}
            Upload File
          </button>
          <button
            type="button"
            className="btn-ghost p-2"
            onClick={() => fetchFiles(currentPath)}
            disabled={loading || uploading}
            aria-label="Refresh files"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Path Input Bar */}
      <div className="flex items-center gap-2 px-3 py-2 bg-input rounded-lg border border-border mb-4">
        <button
          type="button"
          onClick={handleGoBack}
          disabled={loading}
          className="p-1 hover:bg-background rounded disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          aria-label="Go back"
        >
          <ArrowLeft className="w-4 h-4 text-foreground" />
        </button>
        <input
          type="text"
          value={pathToInput}
          onChange={(e) => setPathToInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              fetchFiles(pathToInput);
            }
          }}
          disabled={loading}
          className="flex-1 bg-transparent border-0 outline-none text-xs font-mono text-foreground font-semibold focus:ring-0 p-0"
        />
        <button
          type="button"
          onClick={() => fetchFiles(pathToInput)}
          disabled={loading}
          className="bg-primary hover:opacity-90 text-primary-foreground text-xs py-1 px-3 rounded-md transition-all font-medium"
        >
          Go
        </button>
      </div>

      {uploadProgress && (
        <div className="mb-4 p-3 bg-primary/10 border border-primary/20 rounded-lg text-sm space-y-2">
          <div className="flex justify-between font-medium text-xs text-foreground/80">
            <span className="flex items-center gap-1.5">
              <Upload className="w-3.5 h-3.5 text-primary animate-pulse" />
              Uploading: <span className="font-semibold text-foreground truncate max-w-xs">{uploadProgress.fileName}</span>
            </span>
            <span>{uploadProgress.percent}%</span>
          </div>
          <div className="h-2 bg-input rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${uploadProgress.percent}%` }}
            />
          </div>
          <div className="text-right text-[10px] text-foreground/50 font-mono">
            {formatBytes(uploadProgress.transferred)} of {formatBytes(uploadProgress.total)}
          </div>
        </div>
      )}

      {downloadProgress && (
        <div className="mb-4 p-3 bg-success/10 border border-success/20 rounded-lg text-sm space-y-2">
          <div className="flex justify-between font-medium text-xs text-foreground/80">
            <span className="flex items-center gap-1.5">
              <Download className="w-3.5 h-3.5 text-success animate-pulse" />
              Downloading: <span className="font-semibold text-foreground truncate max-w-xs">{downloadProgress.fileName}</span>
            </span>
            <span>{downloadProgress.percent}%</span>
          </div>
          <div className="h-2 bg-input rounded-full overflow-hidden">
            <div
              className="h-full bg-success transition-all duration-300"
              style={{ width: `${downloadProgress.percent}%` }}
            />
          </div>
          <div className="text-right text-[10px] text-foreground/50 font-mono">
            {formatBytes(downloadProgress.transferred)} of {formatBytes(downloadProgress.total)}
          </div>
        </div>
      )}

      {error && (
        <div className="mb-4 p-3 bg-error/15 border border-error/30 text-error rounded-lg flex items-start gap-2 text-sm">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* File Browser Table */}
      <div className="border border-border rounded-lg overflow-hidden bg-background">
        <div className="max-h-96 overflow-y-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-input/50 text-xs text-foreground/60 border-b border-border font-medium">
                <th className="p-3 w-1/2">Name</th>
                <th className="p-3 w-1/4">Size</th>
                <th className="p-3 w-1/4">Last Modified</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-foreground/50">
                    <div className="flex flex-col items-center gap-2">
                      <Loader2 className="w-6 h-6 animate-spin text-primary" />
                      <span>Reading directory...</span>
                    </div>
                  </td>
                </tr>
              ) : files.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-foreground/40 text-sm">
                    Empty directory
                  </td>
                </tr>
              ) : (
                files.map((file) => (
                  <tr
                    key={file.name}
                    className="border-b border-border/50 last:border-0 hover:bg-input/20 transition-colors text-sm"
                  >
                    <td className="p-3">
                      {file.is_dir ? (
                        <button
                          type="button"
                          className="flex items-center gap-2 text-primary hover:underline text-left font-semibold"
                          onClick={() => handleNavigate(file)}
                        >
                          <Folder className="w-4 h-4 fill-primary/20 flex-shrink-0" />
                          <span className="truncate max-w-xs sm:max-w-md">{file.name}</span>
                        </button>
                      ) : (
                        <div className="flex items-center gap-2 text-foreground/80">
                          <FileIcon className="w-4 h-4 text-foreground/45 flex-shrink-0" />
                          <span className="truncate max-w-xs sm:max-w-md">{file.name}</span>
                        </div>
                      )}
                    </td>
                    <td className="p-3 text-foreground/60 text-xs font-mono">
                      {file.is_dir ? '-' : formatBytes(file.size)}
                    </td>
                    <td className="p-3 text-foreground/60 text-xs">
                      {formatDate(file.last_modified)}
                    </td>
                    <td className="p-3 text-right">
                      {!file.is_dir && (
                        <button
                          type="button"
                          className="p-1.5 hover:bg-input rounded-lg transition-colors text-foreground/75 hover:text-foreground inline-flex items-center"
                          onClick={() => handleDownload(file)}
                          title="Download file"
                          aria-label={`Download ${file.name}`}
                        >
                          <Download className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
