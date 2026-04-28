import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';

type SimpleResult = {
  success: boolean;
  message: string;
};

type ArchiveProgressPayload = {
  phase: 'scanning' | 'extracting' | 'flattening' | 'done' | 'error';
  archiveIndex: number;
  totalArchives: number;
  archivePath?: string;
  archivePercent?: number;
  movedFiles?: number;
  totalMovedFiles?: number;
  message: string;
};

type BatchExtractResult = {
  success: boolean;
  message: string;
  processedArchives: number;
  deletedArchives: number;
  totalArchives: number;
  extractedFiles: number;
  failures: Array<{ archivePath: string; reason: string }>;
};

type DownloadNamingPreset = 'title-id' | 'author-title-id' | 'date-author-title' | 'custom';

type DownloadPreferences = {
  defaultDownloadDir: string;
  outputDir: string;
  concurrency: number;
  includeThumbnail: boolean;
  includeDescription: boolean;
  includeSubtitles: boolean;
  cookieFilePath?: string;
  proxy?: string;
  socketTimeout?: number;
  retries?: number;
  limitRate?: string;
  namingPreset: DownloadNamingPreset;
  customTemplate?: string;
  dedupe: boolean;
  skipExisting: boolean;
};

type DownloadProgressPayload = {
  phase: 'starting' | 'downloading' | 'paused' | 'completed' | 'error' | 'done' | 'canceled';
  itemIndex: number;
  totalItems: number;
  url?: string;
  percent?: number;
  speed?: string;
  eta?: string;
  filePath?: string;
  message: string;
};

type DownloadItemResult = {
  url: string;
  success: boolean;
  filePath?: string;
  error?: string;
  errorCategory?: string;
  title?: string;
  uploader?: string;
};

type BatchDownloadResult = {
  success: boolean;
  message: string;
  totalUrls: number;
  successfulDownloads: number;
  failedDownloads: number;
  canceledDownloads: number;
  results: DownloadItemResult[];
};

type DownloadPreviewItem = {
  url: string;
  success: boolean;
  title?: string;
  uploader?: string;
  durationText?: string;
  thumbnail?: string;
  error?: string;
};

type DownloadHistoryEntry = {
  id: string;
  createdAt: string;
  outputDir: string;
  totalUrls: number;
  successfulDownloads: number;
  failedDownloads: number;
  canceledDownloads: number;
};

type DownloadToolState = {
  preferences: DownloadPreferences;
  version: string;
  versionHint: string;
  history: DownloadHistoryEntry[];
};

contextBridge.exposeInMainWorld('electronAPI', {
  openDirectory: () => ipcRenderer.invoke('dialog:openDirectory') as Promise<string | null>,
  openTextFile: () => ipcRenderer.invoke('dialog:openTextFile') as Promise<string | null>,
  openCookieFile: () => ipcRenderer.invoke('dialog:openCookieFile') as Promise<string | null>,
  openPath: (targetPath: string) => ipcRenderer.invoke('system:openPath', targetPath) as Promise<boolean>,
  renameFiles: (folderPath: string, searchString: string, replaceString: string) =>
    ipcRenderer.invoke('file:rename', folderPath, searchString, replaceString) as Promise<SimpleResult>,
  generateFileList: (folderPath: string) =>
    ipcRenderer.invoke('file:generateFileList', folderPath) as Promise<SimpleResult>,
  extractArchives: (folderPath: string) =>
    ipcRenderer.invoke('archive:extractAll', folderPath) as Promise<BatchExtractResult>,
  getDownloadState: () => ipcRenderer.invoke('download:getState') as Promise<DownloadToolState>,
  saveDownloadPreferences: (preferences: DownloadPreferences) =>
    ipcRenderer.invoke('download:savePreferences', preferences) as Promise<SimpleResult>,
  precheckDownloads: (
    rawUrls: string,
    options: Pick<DownloadPreferences, 'cookieFilePath' | 'proxy' | 'socketTimeout' | 'concurrency'>,
  ) => ipcRenderer.invoke('download:precheck', rawUrls, options) as Promise<DownloadPreviewItem[]>,
  downloadVideos: (rawUrls: string, options: DownloadPreferences) =>
    ipcRenderer.invoke('download:batch', rawUrls, options) as Promise<BatchDownloadResult>,
  pauseDownloads: () => ipcRenderer.invoke('download:pause') as Promise<SimpleResult>,
  resumeDownloads: () => ipcRenderer.invoke('download:resume') as Promise<SimpleResult>,
  cancelDownloads: () => ipcRenderer.invoke('download:cancel') as Promise<SimpleResult>,
  exportDownloadReport: (result: BatchDownloadResult, format: 'csv' | 'txt') =>
    ipcRenderer.invoke('download:exportReport', result, format) as Promise<SimpleResult>,
  onArchiveProgress: (listener: (payload: ArchiveProgressPayload) => void) => {
    const subscription = (_event: IpcRendererEvent, payload: ArchiveProgressPayload): void => listener(payload);
    ipcRenderer.on('archive:progress', subscription);
    return () => ipcRenderer.removeListener('archive:progress', subscription);
  },
  onDownloadProgress: (listener: (payload: DownloadProgressPayload) => void) => {
    const subscription = (_event: IpcRendererEvent, payload: DownloadProgressPayload): void => listener(payload);
    ipcRenderer.on('download:progress', subscription);
    return () => ipcRenderer.removeListener('download:progress', subscription);
  },
});
