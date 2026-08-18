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
        const devResp = response?.response;
        if (devResp?.status === 'success' && devResp?.content) {
          try {
            const byteCharacters = atob(devResp.content);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
              byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            const blob = new Blob([byteArray], { type: 'application/octet-stream' });
            
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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile || !socket || !device?.device_id) return;

    setUploading(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      if (!result) {
        setUploading(false);
        alert('Failed to read local file');
        return;
      }

      // Result format is data:*/*;base64,.....
      const base64Content = result.split(',')[1];
      const targetFilePath = currentPath.endsWith('/')
        ? `${currentPath}${selectedFile.name}`
        : `${currentPath}/${selectedFile.name}`;

      const localCommandId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      socket.emit(
        'send_command',
        {
          deviceId: device.device_id,
          device_id: device.device_id,
          command: 'upload_file',
          command_id: localCommandId,
          payload: {
            path: targetFilePath,
            content: base64Content,
          },
        },
        (response: any) => {
          setUploading(false);
          if (fileInputRef.current) fileInputRef.current.value = '';
          const devResp = response?.response;
          if (devResp?.status === 'success') {
            fetchFiles(currentPath);
          } else {
            alert('Upload failed: ' + (devResp?.message || 'Unknown error'));
          }
        }
      );
    };

    reader.onerror = () => {
      setUploading(false);
      alert('File reading error');
    };

    reader.readAsDataURL(selectedFile);
  };

  if (!device) {
    return (
      <div className="card min-h-64 flex items-center justify-center border-dashed">
        <p className="text-foreground/50 font-medium">Select a device to browse files</p>
      </div>
    );
  }

  const isAtRoot = currentPath === '/' || currentPath === '/sdcard/';

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

      {/* Path Breadcrumbs */}
      <div className="flex items-center gap-2 px-3 py-2 bg-input rounded-lg border border-border mb-4 overflow-x-auto whitespace-nowrap">
        <button
          type="button"
          onClick={handleGoBack}
          disabled={isAtRoot || loading}
          className="p-1 hover:bg-background rounded disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          aria-label="Go back"
        >
          <ArrowLeft className="w-4 h-4 text-foreground" />
        </button>
        <span className="text-xs font-mono text-foreground/75 font-semibold select-all">
          {currentPath}
        </span>
      </div>

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
