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

type ArchiveRuntimeState = {
  isRunning: boolean;
  selectedFolderPath: string;
  latestProgress: ArchiveProgressPayload | null;
  logs: string[];
  stats: {
    successfulArchives: number;
    deletedArchives: number;
    failedArchives: number;
    extractedFiles: number;
  };
  statusMessage: string;
  statusKind: 'info' | 'success' | 'error';
};

type DownloadRuntimeState = {
  isRunning: boolean;
  isPaused: boolean;
  outputDir: string;
  latestProgress: DownloadProgressPayload | null;
  logs: string[];
  stats: {
    totalUrls: number;
    successfulDownloads: number;
    failedDownloads: number;
    canceledDownloads: number;
  };
  statusMessage: string;
  statusKind: 'info' | 'success' | 'error';
  partialResults: DownloadItemResult[];
};

type LinuxServerCredentials = {
  host: string;
  port?: number;
  username: string;
  password: string;
};

type LinuxInspectScope = 'full' | 'basic' | 'resource' | 'network' | 'runtime' | 'security';
type LinuxQuickAction = 'nginxConfig' | 'restartNginx';

type LinuxServerSection = {
  key:
    | 'summary'
    | 'cpu'
    | 'memory'
    | 'disk'
    | 'diskTop'
    | 'ports'
    | 'processes'
    | 'journal'
    | 'jdk'
    | 'dockerImages'
    | 'dockerContainers'
    | 'nginx'
    | 'nginxCerts'
    | 'systemd'
    | 'security';
  title: string;
  command: string;
  output: string;
};

type LinuxServerAlert = {
  level: 'info' | 'warning' | 'error';
  title: string;
  detail: string;
};

type LinuxServerScoreBreakdown = {
  label: string;
  score: number;
  maxScore: number;
  detail: string;
};

type LinuxServerCertificate = {
  path: string;
  subject?: string;
  issuer?: string;
  notBefore?: string;
  notAfter?: string;
  daysRemaining?: number;
  status: 'valid' | 'expiring' | 'expired' | 'unknown';
};

type LinuxServiceHealth = {
  key: 'docker' | 'nginx' | 'jdk';
  title: string;
  status: 'healthy' | 'warning' | 'error' | 'missing';
  summary: string;
  detail: string;
};

type LinuxServerInspectResult = {
  success: boolean;
  message: string;
  inspectedAt: string;
  server: {
    host: string;
    port: number;
    username: string;
  };
  summary: {
    hostname?: string;
    os?: string;
    kernel?: string;
    uptime?: string;
    primaryIp?: string;
    memoryUsagePercent?: number;
    highestDiskUsagePercent?: number;
    openPortCount?: number;
    dockerContainerCount?: number;
    dockerRunningCount?: number;
    nginxCertificateCount?: number;
    failedServiceCount?: number;
    rootLogin?: string;
    passwordAuthentication?: string;
    firewallStatus?: string;
    selinuxStatus?: string;
    failedLoginCount?: number;
    expiringCertificateCount?: number;
    expiredCertificateCount?: number;
    earliestCertificateExpiryDays?: number;
    topCpuProcess?: string;
    topMemoryProcess?: string;
    largestDirectory?: string;
    riskyPortCount?: number;
    riskyPorts?: string[];
    recentErrorCount?: number;
    recentErrorPreview?: string;
    failedLoginIpCount?: number;
    topFailedLoginIp?: string;
    failedLoginSources?: string[];
  };
  score: {
    overall: number;
    label: string;
    breakdown: LinuxServerScoreBreakdown[];
  };
  highlights: string[];
  alerts: LinuxServerAlert[];
  certificates: LinuxServerCertificate[];
  serviceHealth: LinuxServiceHealth[];
  sections: LinuxServerSection[];
};

type LinuxQuickActionResult = {
  success: boolean;
  message: string;
  inspectedAt: string;
  action: LinuxQuickAction;
  title: string;
  command: string;
  output: string;
};

type LocalSystemSection = {
  key: string;
  title: string;
  command: string;
  output: string;
};

type LocalSystemInsight = {
  level: 'info' | 'warning' | 'error';
  title: string;
  detail: string;
};

type LocalSystemScoreBreakdown = {
  label: string;
  score: number;
  maxScore: number;
  detail: string;
};

type LocalSystemInspectResult = {
  success: boolean;
  message: string;
  inspectedAt: string;
  platform: string;
  score: {
    overall: number;
    label: string;
    breakdown: LocalSystemScoreBreakdown[];
  };
  summary: {
    hostname: string;
    os: string;
    version: string;
    arch: string;
    uptime: string;
    cpuModel: string;
    cpuCores: number;
    totalMemory: string;
    totalMemoryBytes: number;
    graphicsCount?: number;
    diskCount?: number;
    networkCount?: number;
    displayCount?: number;
    motherboard?: string;
    biosVersion?: string;
    systemDisk?: string;
    systemDiskFree?: string;
    systemDiskFreePercent?: number;
    batteryStatus?: string;
  };
  insights: LocalSystemInsight[];
  sections: LocalSystemSection[];
};

contextBridge.exposeInMainWorld('electronAPI', {
  openDirectory: () => ipcRenderer.invoke('dialog:openDirectory') as Promise<string | null>,
  openTextFile: () => ipcRenderer.invoke('dialog:openTextFile') as Promise<string | null>,
  openCookieFile: () => ipcRenderer.invoke('dialog:openCookieFile') as Promise<string | null>,
  openPath: (targetPath: string) => ipcRenderer.invoke('system:openPath', targetPath) as Promise<boolean>,
  inspectLocalSystem: () => ipcRenderer.invoke('system:inspectLocal') as Promise<LocalSystemInspectResult>,
  copyLocalSystemReport: (result: LocalSystemInspectResult) =>
    ipcRenderer.invoke('system:copyLocalReport', result) as Promise<SimpleResult>,
  exportLocalSystemReport: (result: LocalSystemInspectResult, format: 'txt' | 'json') =>
    ipcRenderer.invoke('system:exportLocalReport', result, format) as Promise<SimpleResult>,
  inspectLinuxServer: (credentials: LinuxServerCredentials, scope: LinuxInspectScope = 'full') =>
    ipcRenderer.invoke('linux:inspectServer', credentials, scope) as Promise<LinuxServerInspectResult>,
  runLinuxQuickAction: (credentials: LinuxServerCredentials, action: LinuxQuickAction) =>
    ipcRenderer.invoke('linux:quickAction', credentials, action) as Promise<LinuxQuickActionResult>,
  renameFiles: (folderPath: string, searchString: string, replaceString: string) =>
    ipcRenderer.invoke('file:rename', folderPath, searchString, replaceString) as Promise<SimpleResult>,
  generateFileList: (folderPath: string) =>
    ipcRenderer.invoke('file:generateFileList', folderPath) as Promise<SimpleResult>,
  extractArchives: (folderPath: string) =>
    ipcRenderer.invoke('archive:extractAll', folderPath) as Promise<BatchExtractResult>,
  getArchiveRuntimeState: () => ipcRenderer.invoke('archive:getRuntimeState') as Promise<ArchiveRuntimeState>,
  getDownloadState: () => ipcRenderer.invoke('download:getState') as Promise<DownloadToolState>,
  getDownloadRuntimeState: () => ipcRenderer.invoke('download:getRuntimeState') as Promise<DownloadRuntimeState>,
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
