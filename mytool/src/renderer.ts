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

declare global {
  interface Window {
    electronAPI: {
      openDirectory: () => Promise<string | null>;
      openTextFile: () => Promise<string | null>;
      openCookieFile: () => Promise<string | null>;
      openPath: (targetPath: string) => Promise<boolean>;
      inspectLocalSystem: () => Promise<LocalSystemInspectResult>;
      copyLocalSystemReport: (result: LocalSystemInspectResult) => Promise<SimpleResult>;
      exportLocalSystemReport: (result: LocalSystemInspectResult, format: 'txt' | 'json') => Promise<SimpleResult>;
  inspectLinuxServer: (credentials: LinuxServerCredentials, scope?: LinuxInspectScope) => Promise<LinuxServerInspectResult>;
  runLinuxQuickAction: (credentials: LinuxServerCredentials, action: LinuxQuickAction) => Promise<LinuxQuickActionResult>;
      renameFiles: (folderPath: string, searchString: string, replaceString: string) => Promise<SimpleResult>;
      generateFileList: (folderPath: string) => Promise<SimpleResult>;
      extractArchives: (folderPath: string) => Promise<BatchExtractResult>;
      getArchiveRuntimeState: () => Promise<ArchiveRuntimeState>;
      getDownloadState: () => Promise<DownloadToolState>;
      getDownloadRuntimeState: () => Promise<DownloadRuntimeState>;
      saveDownloadPreferences: (preferences: DownloadPreferences) => Promise<SimpleResult>;
      precheckDownloads: (
        rawUrls: string,
        options: Pick<DownloadPreferences, 'cookieFilePath' | 'proxy' | 'socketTimeout' | 'concurrency'>,
      ) => Promise<DownloadPreviewItem[]>;
      downloadVideos: (rawUrls: string, options: DownloadPreferences) => Promise<BatchDownloadResult>;
      pauseDownloads: () => Promise<SimpleResult>;
      resumeDownloads: () => Promise<SimpleResult>;
      cancelDownloads: () => Promise<SimpleResult>;
      exportDownloadReport: (result: BatchDownloadResult, format: 'csv' | 'txt') => Promise<SimpleResult>;
      onArchiveProgress: (listener: (payload: ArchiveProgressPayload) => void) => () => void;
      onDownloadProgress: (listener: (payload: DownloadProgressPayload) => void) => () => void;
    };
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  const folderPathInput = document.getElementById('folderPath') as HTMLInputElement;
  const selectFolderBtn = document.getElementById('selectFolderBtn') as HTMLButtonElement;
  const searchStringInput = document.getElementById('searchString') as HTMLInputElement;
  const replaceStringInput = document.getElementById('replaceString') as HTMLInputElement;
  const startRenameBtn = document.getElementById('startRenameBtn') as HTMLButtonElement;
  const stringReplacerStatusDiv = document.querySelector('#string-replacer-tool .status-message') as HTMLDivElement;

  const codeAssistantFolderPathInput = document.getElementById('codeAssistantFolderPath') as HTMLInputElement;
  const selectCodeAssistantFolderBtn = document.getElementById('selectCodeAssistantFolderBtn') as HTMLButtonElement;
  const generateFileListBtn = document.getElementById('generateFileListBtn') as HTMLButtonElement;
  const codeAssistantStatusDiv = document.getElementById('codeAssistantStatus') as HTMLDivElement;

  const archiveFolderPathInput = document.getElementById('archiveFolderPath') as HTMLInputElement;
  const selectArchiveFolderBtn = document.getElementById('selectArchiveFolderBtn') as HTMLButtonElement;
  const extractArchivesBtn = document.getElementById('extractArchivesBtn') as HTMLButtonElement;
  const archiveStatusDiv = document.getElementById('archiveStatus') as HTMLDivElement;
  const archiveProgressBar = document.getElementById('archiveProgressBar') as HTMLProgressElement;
  const archiveProgressText = document.getElementById('archiveProgressText') as HTMLDivElement;
  const archiveLog = document.getElementById('archiveLog') as HTMLDivElement;
  const archiveSuccessCount = document.getElementById('archiveSuccessCount') as HTMLSpanElement;
  const archiveDeletedCount = document.getElementById('archiveDeletedCount') as HTMLSpanElement;
  const archiveFailureCount = document.getElementById('archiveFailureCount') as HTMLSpanElement;
  const archiveExtractedCount = document.getElementById('archiveExtractedCount') as HTMLSpanElement;

  const localInspectBtn = document.getElementById('localInspectBtn') as HTMLButtonElement;
  const localCopyReportBtn = document.getElementById('localCopyReportBtn') as HTMLButtonElement;
  const localExportTxtBtn = document.getElementById('localExportTxtBtn') as HTMLButtonElement;
  const localExportJsonBtn = document.getElementById('localExportJsonBtn') as HTMLButtonElement;
  const localStatusDiv = document.getElementById('localStatus') as HTMLDivElement;
  const localScoreValue = document.getElementById('localScoreValue') as HTMLDivElement;
  const localScoreLabel = document.getElementById('localScoreLabel') as HTMLDivElement;
  const localScoreBreakdown = document.getElementById('localScoreBreakdown') as HTMLDivElement;
  const localInsightsContainer = document.getElementById('localInsights') as HTMLDivElement;
  const localSummaryGrid = document.getElementById('localSummaryGrid') as HTMLDivElement;
  const localSectionsContainer = document.getElementById('localSections') as HTMLDivElement;
  const localLastChecked = document.getElementById('localLastChecked') as HTMLDivElement;

  const linuxHostInput = document.getElementById('linuxHost') as HTMLInputElement;
  const linuxPortInput = document.getElementById('linuxPort') as HTMLInputElement;
  const linuxUsernameInput = document.getElementById('linuxUsername') as HTMLInputElement;
  const linuxPasswordInput = document.getElementById('linuxPassword') as HTMLInputElement;
  const linuxInspectBtn = document.getElementById('linuxInspectBtn') as HTMLButtonElement;
  const linuxScopeButtons = document.querySelectorAll<HTMLButtonElement>('[data-linux-scope]');
  const linuxViewNginxConfigBtn = document.getElementById('linuxViewNginxConfigBtn') as HTMLButtonElement;
  const linuxRestartNginxBtn = document.getElementById('linuxRestartNginxBtn') as HTMLButtonElement;
  const linuxStatusDiv = document.getElementById('linuxStatus') as HTMLDivElement;
  const linuxQuickActionStatusDiv = document.getElementById('linuxQuickActionStatus') as HTMLDivElement;
  const linuxQuickActionOutput = document.getElementById('linuxQuickActionOutput') as HTMLDivElement;
  const linuxHighlightsContainer = document.getElementById('linuxHighlights') as HTMLDivElement;
  const linuxScoreBreakdownContainer = document.getElementById('linuxScoreBreakdown') as HTMLDivElement;
  const linuxServiceHealthContainer = document.getElementById('linuxServiceHealth') as HTMLDivElement;
  const linuxAlertsContainer = document.getElementById('linuxAlerts') as HTMLDivElement;
  const linuxSummaryGrid = document.getElementById('linuxSummaryGrid') as HTMLDivElement;
  const linuxSectionsContainer = document.getElementById('linuxSections') as HTMLDivElement;
  const linuxLastChecked = document.getElementById('linuxLastChecked') as HTMLDivElement;

  const douyinLinksInput = document.getElementById('douyinLinksInput') as HTMLTextAreaElement;
  const importLinksBtn = document.getElementById('importLinksBtn') as HTMLButtonElement;
  const douyinOutputPathInput = document.getElementById('douyinOutputPath') as HTMLInputElement;
  const selectDouyinOutputBtn = document.getElementById('selectDouyinOutputBtn') as HTMLButtonElement;
  const cookieFilePathInput = document.getElementById('cookieFilePath') as HTMLInputElement;
  const selectCookieFileBtn = document.getElementById('selectCookieFileBtn') as HTMLButtonElement;
  const clearCookieFileBtn = document.getElementById('clearCookieFileBtn') as HTMLButtonElement;
  const concurrencyInput = document.getElementById('concurrencyInput') as HTMLInputElement;
  const socketTimeoutInput = document.getElementById('socketTimeoutInput') as HTMLInputElement;
  const retryCountInput = document.getElementById('retryCountInput') as HTMLInputElement;
  const limitRateInput = document.getElementById('limitRateInput') as HTMLInputElement;
  const proxyInput = document.getElementById('proxyInput') as HTMLInputElement;
  const namingPresetSelect = document.getElementById('namingPresetSelect') as HTMLSelectElement;
  const customTemplateInput = document.getElementById('customTemplateInput') as HTMLInputElement;
  const customTemplateRow = document.getElementById('customTemplateRow') as HTMLDivElement;
  const includeThumbnailCheckbox = document.getElementById('includeThumbnail') as HTMLInputElement;
  const includeDescriptionCheckbox = document.getElementById('includeDescription') as HTMLInputElement;
  const includeSubtitlesCheckbox = document.getElementById('includeSubtitles') as HTMLInputElement;
  const dedupeCheckbox = document.getElementById('dedupeLinks') as HTMLInputElement;
  const skipExistingCheckbox = document.getElementById('skipExisting') as HTMLInputElement;
  const ytDlpVersionText = document.getElementById('ytDlpVersionText') as HTMLDivElement;
  const ytDlpVersionHint = document.getElementById('ytDlpVersionHint') as HTMLDivElement;
  const precheckBtn = document.getElementById('precheckBtn') as HTMLButtonElement;
  const startDouyinDownloadBtn = document.getElementById('startDouyinDownloadBtn') as HTMLButtonElement;
  const pauseDownloadBtn = document.getElementById('pauseDownloadBtn') as HTMLButtonElement;
  const resumeDownloadBtn = document.getElementById('resumeDownloadBtn') as HTMLButtonElement;
  const cancelDownloadBtn = document.getElementById('cancelDownloadBtn') as HTMLButtonElement;
  const retryFailedBtn = document.getElementById('retryFailedBtn') as HTMLButtonElement;
  const exportCsvBtn = document.getElementById('exportCsvBtn') as HTMLButtonElement;
  const exportTxtBtn = document.getElementById('exportTxtBtn') as HTMLButtonElement;
  const openDownloadFolderBtn = document.getElementById('openDownloadFolderBtn') as HTMLButtonElement;
  const douyinStatusDiv = document.getElementById('douyinStatus') as HTMLDivElement;
  const douyinProgressBar = document.getElementById('douyinProgressBar') as HTMLProgressElement;
  const douyinProgressText = document.getElementById('douyinProgressText') as HTMLDivElement;
  const douyinLog = document.getElementById('douyinLog') as HTMLDivElement;
  const douyinSuccessCount = document.getElementById('douyinSuccessCount') as HTMLSpanElement;
  const douyinFailureCount = document.getElementById('douyinFailureCount') as HTMLSpanElement;
  const douyinCanceledCount = document.getElementById('douyinCanceledCount') as HTMLSpanElement;
  const douyinTotalCount = document.getElementById('douyinTotalCount') as HTMLSpanElement;
  const precheckTableBody = document.getElementById('precheckTableBody') as HTMLTableSectionElement;
  const resultTableBody = document.getElementById('resultTableBody') as HTMLTableSectionElement;
  const historyList = document.getElementById('historyList') as HTMLDivElement;

  const navItems = document.querySelectorAll<HTMLAnchorElement>('#sidebar ul li a');
  const toolSections = document.querySelectorAll<HTMLElement>('.tool-section');

  let lastDownloadResult: BatchDownloadResult | null = null;
  let lastFailedUrls: string[] = [];
  let lastLocalInspectResult: LocalSystemInspectResult | null = null;

  const showStatus = (element: HTMLDivElement, message: string, kind: 'success' | 'error' | 'info' = 'info'): void => {
    element.textContent = message;
    element.className = 'status-message';
    if (kind !== 'info') {
      element.classList.add(kind);
    }
  };

  const chooseDirectory = async (input: HTMLInputElement, statusElement: HTMLDivElement, message: string): Promise<void> => {
    showStatus(statusElement, '正在选择文件夹...');
    const folderPath = await window.electronAPI.openDirectory();
    if (!folderPath) {
      showStatus(statusElement, '未选择文件夹。', 'error');
      return;
    }
    input.value = folderPath;
    showStatus(statusElement, `${message}: ${folderPath}`, 'success');
  };

  const appendLog = (target: HTMLDivElement, message: string, maxLines = 18): void => {
    const lines = target.textContent ? target.textContent.split('\n') : [];
    lines.push(message);
    target.textContent = lines.slice(-maxLines).join('\n');
    target.scrollTop = target.scrollHeight;
  };

  const escapeHtml = (value: string): string =>
    value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');

  const resetArchiveProgress = (): void => {
    archiveProgressBar.value = 0;
    archiveProgressText.textContent = '等待开始';
    archiveLog.textContent = '';
    archiveSuccessCount.textContent = '0';
    archiveDeletedCount.textContent = '0';
    archiveFailureCount.textContent = '0';
    archiveExtractedCount.textContent = '0';
  };

  const resetDownloadProgress = (): void => {
    douyinProgressBar.value = 0;
    douyinProgressText.textContent = '等待开始';
    douyinLog.textContent = '';
    douyinSuccessCount.textContent = '0';
    douyinFailureCount.textContent = '0';
    douyinCanceledCount.textContent = '0';
    douyinTotalCount.textContent = '0';
    resultTableBody.innerHTML = '';
  };

  const showToolSection = (sectionId: string): void => {
    toolSections.forEach((section) => section.classList.remove('active'));
    const activeSection = document.getElementById(sectionId);
    if (activeSection) {
      activeSection.classList.add('active');
    }
  };

  const readDownloadPreferencesFromForm = (): DownloadPreferences => ({
    defaultDownloadDir: douyinOutputPathInput.value.trim(),
    outputDir: douyinOutputPathInput.value.trim(),
    concurrency: Math.max(1, Number(concurrencyInput.value) || 1),
    includeThumbnail: includeThumbnailCheckbox.checked,
    includeDescription: includeDescriptionCheckbox.checked,
    includeSubtitles: includeSubtitlesCheckbox.checked,
    cookieFilePath: cookieFilePathInput.value.trim(),
    proxy: proxyInput.value.trim(),
    socketTimeout: Math.max(0, Number(socketTimeoutInput.value) || 0),
    retries: Math.max(0, Number(retryCountInput.value) || 0),
    limitRate: limitRateInput.value.trim(),
    namingPreset: namingPresetSelect.value as DownloadNamingPreset,
    customTemplate: customTemplateInput.value.trim(),
    dedupe: dedupeCheckbox.checked,
    skipExisting: skipExistingCheckbox.checked,
  });

  const applyDownloadPreferencesToForm = (preferences: DownloadPreferences): void => {
    douyinOutputPathInput.value = preferences.outputDir || preferences.defaultDownloadDir;
    cookieFilePathInput.value = preferences.cookieFilePath || '';
    concurrencyInput.value = String(preferences.concurrency);
    socketTimeoutInput.value = String(preferences.socketTimeout ?? 30);
    retryCountInput.value = String(preferences.retries ?? 3);
    limitRateInput.value = preferences.limitRate || '';
    proxyInput.value = preferences.proxy || '';
    namingPresetSelect.value = preferences.namingPreset;
    customTemplateInput.value = preferences.customTemplate || '';
    includeThumbnailCheckbox.checked = preferences.includeThumbnail;
    includeDescriptionCheckbox.checked = preferences.includeDescription;
    includeSubtitlesCheckbox.checked = preferences.includeSubtitles;
    dedupeCheckbox.checked = preferences.dedupe;
    skipExistingCheckbox.checked = preferences.skipExisting;
    customTemplateRow.style.display = preferences.namingPreset === 'custom' ? 'block' : 'none';
  };

  const renderHistory = (history: DownloadHistoryEntry[]): void => {
    historyList.innerHTML = '';
    if (history.length === 0) {
      historyList.innerHTML = '<div class="empty-state">还没有下载历史。</div>';
      return;
    }

    history.forEach((entry) => {
      const item = document.createElement('div');
      item.className = 'history-item';
      item.innerHTML = `
        <div class="history-title">${new Date(entry.createdAt).toLocaleString()}</div>
        <div class="history-meta">目录：${entry.outputDir}</div>
        <div class="history-meta">总数 ${entry.totalUrls} / 成功 ${entry.successfulDownloads} / 失败 ${entry.failedDownloads} / 取消 ${entry.canceledDownloads}</div>
      `;
      historyList.appendChild(item);
    });
  };

  const renderPreviewRows = (items: DownloadPreviewItem[]): void => {
    precheckTableBody.innerHTML = '';
    if (items.length === 0) {
      precheckTableBody.innerHTML = '<tr><td colspan="5" class="table-empty">还没有预检查结果。</td></tr>';
      return;
    }

    items.forEach((item) => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td><span class="pill ${item.success ? 'success' : 'error'}">${item.success ? '可下载' : '失败'}</span></td>
        <td>${item.title || '-'}</td>
        <td>${item.uploader || '-'}</td>
        <td>${item.durationText || '-'}</td>
        <td class="cell-wrap">${item.error || item.url}</td>
      `;
      precheckTableBody.appendChild(row);
    });
  };

  const renderDownloadResults = (result: BatchDownloadResult): void => {
    resultTableBody.innerHTML = '';

    if (result.results.length === 0) {
      resultTableBody.innerHTML = '<tr><td colspan="5" class="table-empty">还没有下载结果。</td></tr>';
      return;
    }

    result.results.forEach((item) => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td><span class="pill ${item.success ? 'success' : item.errorCategory === '已取消' ? 'warn' : 'error'}">${item.success ? '成功' : item.errorCategory === '已取消' ? '取消' : '失败'}</span></td>
        <td class="cell-wrap">${item.url}</td>
        <td class="cell-wrap">${item.filePath || '-'}</td>
        <td>${item.errorCategory || '-'}</td>
        <td class="cell-wrap">${item.error || '-'}</td>
      `;
      resultTableBody.appendChild(row);
    });
  };

  const renderDownloadPartialResults = (results: DownloadItemResult[]): void => {
    renderDownloadResults({
      success: false,
      message: '',
      totalUrls: results.length,
      successfulDownloads: results.filter((item) => item.success).length,
      failedDownloads: results.filter((item) => !item.success && item.errorCategory !== '已取消').length,
      canceledDownloads: results.filter((item) => item.errorCategory === '已取消').length,
      results,
    });
  };

  const updateDownloadStats = (result: BatchDownloadResult): void => {
    douyinSuccessCount.textContent = String(result.successfulDownloads);
    douyinFailureCount.textContent = String(result.failedDownloads);
    douyinCanceledCount.textContent = String(result.canceledDownloads);
    douyinTotalCount.textContent = String(result.totalUrls);
  };

  const savePreferences = async (): Promise<void> => {
    await window.electronAPI.saveDownloadPreferences(readDownloadPreferencesFromForm());
  };

  const renderLinuxSummary = (result: LinuxServerInspectResult): void => {
    const certificateHealth =
      result.summary.expiredCertificateCount && result.summary.expiredCertificateCount > 0
        ? `${result.summary.expiredCertificateCount} 个已过期`
        : result.summary.expiringCertificateCount && result.summary.expiringCertificateCount > 0
          ? `${result.summary.expiringCertificateCount} 个即将过期`
          : `${result.summary.nginxCertificateCount || 0} 个正常`;

    const summaryEntries = [
      { label: '评分', value: `${result.score.overall}/100` },
      { label: '风险等级', value: result.score.label },
      { label: '主机', value: `${result.server.host}:${result.server.port}` },
      { label: '用户', value: result.server.username },
      { label: '主机名', value: result.summary.hostname || '-' },
      { label: 'OS', value: result.summary.os || '-' },
      { label: '运行时长', value: result.summary.uptime || '-' },
      { label: '主 IP', value: result.summary.primaryIp || '-' },
      { label: '内存使用率', value: result.summary.memoryUsagePercent !== undefined ? `${result.summary.memoryUsagePercent}%` : '-' },
      { label: '最高磁盘使用率', value: result.summary.highestDiskUsagePercent !== undefined ? `${result.summary.highestDiskUsagePercent}%` : '-' },
      { label: '监听端口数', value: result.summary.openPortCount !== undefined ? String(result.summary.openPortCount) : '-' },
      { label: '失败服务数', value: result.summary.failedServiceCount !== undefined ? String(result.summary.failedServiceCount) : '-' },
      { label: 'Docker 容器', value: `${result.summary.dockerRunningCount || 0} 运行中 / ${result.summary.dockerContainerCount || 0} 总数` },
      { label: '证书状态', value: certificateHealth },
      { label: '最早证书到期', value: result.summary.earliestCertificateExpiryDays !== undefined ? `${result.summary.earliestCertificateExpiryDays} 天` : '-' },
      { label: 'Root 登录', value: result.summary.rootLogin || '-' },
      { label: '密码认证', value: result.summary.passwordAuthentication || '-' },
      { label: '防火墙', value: result.summary.firewallStatus || '-' },
      { label: '失败登录次数', value: result.summary.failedLoginCount !== undefined ? String(result.summary.failedLoginCount) : '-' },
      { label: '主要失败登录来源', value: result.summary.topFailedLoginIp || '-' },
      { label: '失败来源 IP 数', value: result.summary.failedLoginIpCount !== undefined ? String(result.summary.failedLoginIpCount) : '-' },
      { label: '最高 CPU 占用进程', value: result.summary.topCpuProcess || '-' },
      { label: '最高内存占用进程', value: result.summary.topMemoryProcess || '-' },
      { label: '最大目录', value: result.summary.largestDirectory || '-' },
      { label: '高风险公网端口', value: result.summary.riskyPortCount ? (result.summary.riskyPorts || []).join(', ') : '-' },
      { label: '近期错误日志数', value: result.summary.recentErrorCount !== undefined ? String(result.summary.recentErrorCount) : '-' },
    ];

    linuxSummaryGrid.innerHTML = summaryEntries
      .map(
        (item) => `
          <div class="stats-card">
            <div class="stats-label">${escapeHtml(item.label)}</div>
            <div class="stats-value stats-value-small">${escapeHtml(item.value)}</div>
          </div>
        `,
      )
      .join('');
  };

  const renderLinuxHighlights = (highlights: string[]): void => {
    if (highlights.length === 0) {
      linuxHighlightsContainer.innerHTML = '<div class="empty-state">巡检完成后，这里会显示关键结论。</div>';
      return;
    }

    linuxHighlightsContainer.innerHTML = highlights
      .map(
        (item) => `
          <div class="history-item">
            <div class="history-meta">${escapeHtml(item)}</div>
          </div>
        `,
      )
      .join('');
  };

  const renderLinuxScoreBreakdown = (breakdown: LinuxServerScoreBreakdown[]): void => {
    if (breakdown.length === 0) {
      linuxScoreBreakdownContainer.innerHTML = '<div class="empty-state">当前巡检范围没有可计算的评分项。</div>';
      return;
    }

    linuxScoreBreakdownContainer.innerHTML = breakdown
      .map(
        (item) => `
          <div class="history-item">
            <div class="history-title">${escapeHtml(item.label)}: ${item.score}/${item.maxScore}</div>
            <div class="history-meta">${escapeHtml(item.detail)}</div>
          </div>
        `,
      )
      .join('');
  };

  const renderLinuxServiceHealth = (serviceHealth: LinuxServiceHealth[]): void => {
    if (serviceHealth.length === 0) {
      linuxServiceHealthContainer.innerHTML = '<div class="empty-state">巡检完成后，这里会显示服务健康摘要。</div>';
      return;
    }

    linuxServiceHealthContainer.innerHTML = serviceHealth
      .map(
        (item) => `
          <div class="alert-card ${item.status === 'healthy' ? 'info' : item.status === 'warning' ? 'warning' : 'error'}">
            <div class="alert-title">${escapeHtml(item.title)}: ${escapeHtml(item.summary)}</div>
            <div class="alert-detail">${escapeHtml(item.detail)}</div>
          </div>
        `,
      )
      .join('');
  };

  const renderLinuxAlerts = (alerts: LinuxServerAlert[]): void => {
    if (alerts.length === 0) {
      linuxAlertsContainer.innerHTML = '<div class="empty-state">未发现告警或严重问题。</div>';
      return;
    }

    linuxAlertsContainer.innerHTML = alerts
      .map(
        (alert) => `
          <div class="alert-card ${alert.level}">
            <div class="alert-title">${escapeHtml(alert.title)}</div>
            <div class="alert-detail">${escapeHtml(alert.detail)}</div>
          </div>
        `,
      )
      .join('');
  };

  const renderLinuxSections = (sections: LinuxServerSection[]): void => {
    const detailSections = sections.filter((section) => section.key !== 'summary');
    if (detailSections.length === 0) {
      linuxSectionsContainer.innerHTML = '<div class="empty-state">当前巡检范围没有详细输出。</div>';
      return;
    }

    linuxSectionsContainer.innerHTML = sections
      .filter((section) => section.key !== 'summary')
      .map(
        (section) => `
          <div class="result-block">
            <div class="result-title-row">
              <h4>${escapeHtml(section.title)}</h4>
              <code>${escapeHtml(section.command)}</code>
            </div>
            <pre class="result-pre">${escapeHtml(section.output)}</pre>
          </div>
        `,
      )
      .join('');
  };

  const renderLocalSummary = (result: LocalSystemInspectResult): void => {
    const summaryEntries = [
      { label: '评分', value: `${result.score.overall}/100` },
      { label: '平台', value: result.platform },
      { label: '主机名', value: result.summary.hostname || '-' },
      { label: '系统', value: result.summary.os || '-' },
      { label: '版本', value: result.summary.version || '-' },
      { label: '处理器', value: result.summary.cpuModel || '-' },
      { label: '线程数', value: String(result.summary.cpuCores || '-') },
      { label: '内存', value: result.summary.totalMemory || '-' },
      { label: '架构', value: result.summary.arch || '-' },
      { label: '运行时长', value: result.summary.uptime || '-' },
      { label: '显卡数量', value: String(result.summary.graphicsCount ?? '-') },
      { label: '磁盘数量', value: String(result.summary.diskCount ?? '-') },
      { label: '网卡数量', value: String(result.summary.networkCount ?? '-') },
      { label: '显示器数量', value: String(result.summary.displayCount ?? '-') },
      { label: '主板', value: result.summary.motherboard || '-' },
      { label: 'BIOS/固件', value: result.summary.biosVersion || '-' },
      { label: 'System Disk', value: result.summary.systemDisk || '-' },
      {
        label: '系统盘剩余',
        value: result.summary.systemDiskFree
          ? `${result.summary.systemDiskFree}${result.summary.systemDiskFreePercent !== undefined ? ` (${result.summary.systemDiskFreePercent.toFixed(0)}%)` : ''}`
          : '-',
      },
      { label: '电池', value: result.summary.batteryStatus || '-' },
    ];

    localSummaryGrid.innerHTML = summaryEntries
      .map(
        (item) => `
          <div class="stats-card">
            <div class="stats-label">${escapeHtml(item.label)}</div>
            <div class="stats-value stats-value-small">${escapeHtml(item.value)}</div>
          </div>
        `,
      )
      .join('');
  };

  const renderLocalScore = (result: LocalSystemInspectResult): void => {
    localScoreValue.textContent = `${result.score.overall}`;
    localScoreLabel.textContent = result.score.label;
    localScoreBreakdown.innerHTML = result.score.breakdown
      .map(
        (item) => `
          <div class="history-item">
            <div class="history-title">${escapeHtml(item.label)}: ${item.score}/${item.maxScore}</div>
            <div class="history-meta">${escapeHtml(item.detail)}</div>
          </div>
        `,
      )
      .join('');
  };

  const renderLocalInsights = (insights: LocalSystemInsight[]): void => {
    localInsightsContainer.innerHTML = insights
      .map(
        (item) => `
          <div class="alert-card ${item.level === 'error' ? 'error' : item.level === 'warning' ? 'warning' : 'info'}">
            <div class="alert-title">${escapeHtml(item.title)}</div>
            <div class="alert-detail">${escapeHtml(item.detail)}</div>
          </div>
        `,
      )
      .join('');
  };

  const renderLocalSections = (sections: LocalSystemSection[]): void => {
    localSectionsContainer.innerHTML = sections
      .filter((section) => section.key !== 'summary' && section.key !== 'system')
      .map(
        (section) => `
          <div class="result-block">
            <div class="result-title-row">
              <h4>${escapeHtml(section.title)}</h4>
              <code>${escapeHtml(section.command)}</code>
            </div>
            <pre class="result-pre">${escapeHtml(section.output)}</pre>
          </div>
        `,
      )
      .join('');
  };

  const clearLocalResult = (): void => {
    localScoreValue.textContent = '--';
    localScoreLabel.textContent = '等待检测';
    localScoreBreakdown.innerHTML = '<div class="empty-state">完成检测后，这里会拆分显示评分依据。</div>';
    localInsightsContainer.innerHTML = '<div class="empty-state">完成检测后，这里会显示异常提示和建议项。</div>';
    localSummaryGrid.innerHTML = '<div class="empty-state">点击“开始检测”后，这里会显示本机的 CPU、内存、硬盘、显卡和系统信息。</div>';
    localScoreLabel.textContent = '等待检测';
    localScoreBreakdown.innerHTML = '<div class="empty-state">完成检测后，这里会拆分显示评分依据。</div>';
    localInsightsContainer.innerHTML = '<div class="empty-state">完成检测后，这里会显示异常提示和建议项。</div>';
    localSummaryGrid.innerHTML = '<div class="empty-state">点击“开始检测”后，这里会显示本机的 CPU、内存、硬盘、显卡和系统信息。</div>';
    localSectionsContainer.innerHTML = '';
    localLastChecked.textContent = '--';
    localCopyReportBtn.disabled = true;
    localExportTxtBtn.disabled = true;
    localExportJsonBtn.disabled = true;
  };

  const clearLinuxResult = (): void => {
    linuxHighlightsContainer.innerHTML = '<div class="empty-state">巡检完成后，这里会显示关键结论。</div>';
    linuxScoreBreakdownContainer.innerHTML = '<div class="empty-state">巡检完成后，这里会显示评分拆解。</div>';
    linuxServiceHealthContainer.innerHTML = '<div class="empty-state">巡检完成后，这里会显示服务健康摘要。</div>';
    linuxAlertsContainer.innerHTML = '<div class="empty-state">巡检完成后，这里会显示告警和处理建议。</div>';
    linuxSummaryGrid.innerHTML = '<div class="empty-state">执行巡检后，这里会显示服务器摘要、安全基线和证书状态。</div>';
    linuxSectionsContainer.innerHTML = '';
    linuxLastChecked.textContent = '--';
  };

  const clearLinuxQuickActionOutput = (): void => {
    linuxQuickActionOutput.innerHTML = '<div class="empty-state">执行快捷工具后，这里会显示命令输出。</div>';
  };

  const renderLinuxQuickActionResult = (result: LinuxQuickActionResult): void => {
    linuxQuickActionOutput.innerHTML = `
      <div class="result-block">
        <div class="result-title-row">
          <h4>${escapeHtml(result.title)}</h4>
          <code>${escapeHtml(result.command)}</code>
        </div>
        <pre class="result-pre">${escapeHtml(result.output)}</pre>
      </div>
    `;
  };

  const readLinuxCredentials = (): LinuxServerCredentials | null => {
    const credentials: LinuxServerCredentials = {
      host: linuxHostInput.value.trim(),
      port: Number(linuxPortInput.value) || 22,
      username: linuxUsernameInput.value.trim(),
      password: linuxPasswordInput.value,
    };

    if (!credentials.host) {
      showStatus(linuxStatusDiv, '请输入 Linux 服务器 IP 或域名。', 'error');
      return null;
    }

    if (!credentials.username) {
      showStatus(linuxStatusDiv, '请输入登录用户名。', 'error');
      return null;
    }

    if (!credentials.password) {
      showStatus(linuxStatusDiv, '请输入登录密码。', 'error');
      return null;
    }

    return credentials;
  };

  const applyArchiveRuntimeState = async (): Promise<void> => {
    const state = await window.electronAPI.getArchiveRuntimeState();
    if (state.selectedFolderPath) {
      archiveFolderPathInput.value = state.selectedFolderPath;
    }
    archiveSuccessCount.textContent = String(state.stats.successfulArchives);
    archiveDeletedCount.textContent = String(state.stats.deletedArchives);
    archiveFailureCount.textContent = String(state.stats.failedArchives);
    archiveExtractedCount.textContent = String(state.stats.extractedFiles);
    archiveLog.textContent = state.logs.join('\n');
    if (state.latestProgress) {
      const overallPercent = state.latestProgress.totalArchives > 0
        ? ((Math.max(state.latestProgress.archiveIndex - 1, 0) + (state.latestProgress.archivePercent ?? 0) / 100) / state.latestProgress.totalArchives) * 100
        : state.latestProgress.phase === 'done'
          ? 100
          : 0;
      archiveProgressBar.value = Math.max(0, Math.min(100, overallPercent));
      archiveProgressText.textContent = state.latestProgress.message;
    }
    if (state.statusMessage) {
      showStatus(archiveStatusDiv, state.statusMessage, state.statusKind);
    }
    extractArchivesBtn.disabled = state.isRunning;
  };

  const applyDownloadRuntimeState = async (): Promise<void> => {
    const state = await window.electronAPI.getDownloadRuntimeState();
    if (state.outputDir) {
      douyinOutputPathInput.value = state.outputDir;
    }
    douyinSuccessCount.textContent = String(state.stats.successfulDownloads);
    douyinFailureCount.textContent = String(state.stats.failedDownloads);
    douyinCanceledCount.textContent = String(state.stats.canceledDownloads);
    douyinTotalCount.textContent = String(state.stats.totalUrls);
    douyinLog.textContent = state.logs.join('\n');
    renderDownloadPartialResults(state.partialResults);
    if (state.latestProgress) {
      const overallPercent = state.latestProgress.totalItems > 0
        ? ((Math.max(state.latestProgress.itemIndex - 1, 0) + (state.latestProgress.percent ?? 0) / 100) / state.latestProgress.totalItems) * 100
        : state.latestProgress.phase === 'done'
          ? 100
          : 0;
      douyinProgressBar.value = Math.max(0, Math.min(100, overallPercent));
      douyinProgressText.textContent = state.latestProgress.message;
    }
    if (state.statusMessage) {
      showStatus(douyinStatusDiv, state.statusMessage, state.statusKind);
    }
    startDouyinDownloadBtn.disabled = state.isRunning;
    pauseDownloadBtn.disabled = !state.isRunning || state.isPaused;
    resumeDownloadBtn.disabled = !state.isRunning || !state.isPaused;
    cancelDownloadBtn.disabled = !state.isRunning;
    openDownloadFolderBtn.disabled = !douyinOutputPathInput.value.trim();
  };

  navItems.forEach((item) => {
    item.addEventListener('click', (event) => {
      event.preventDefault();
      navItems.forEach((nav) => nav.classList.remove('active'));
      item.classList.add('active');
      const sectionId = `${item.id.replace('nav-', '')}-tool`;
      showToolSection(sectionId);
      if (sectionId === 'archive-extractor-tool') {
        void applyArchiveRuntimeState();
      }
      if (sectionId === 'douyin-downloader-tool') {
        void applyDownloadRuntimeState();
      }
    });
  });

  if (navItems.length > 0) {
    showToolSection(`${navItems[0].id.replace('nav-', '')}-tool`);
  }

  localInspectBtn.addEventListener('click', async () => {
    clearLocalResult();
    localInspectBtn.disabled = true;
    localCopyReportBtn.disabled = true;
    localExportTxtBtn.disabled = true;
    localExportJsonBtn.disabled = true;
    lastLocalInspectResult = null;
    showStatus(localStatusDiv, '正在检测本机 CPU、内存、硬盘、显卡和系统信息...');
    showStatus(localStatusDiv, '正在检测本机 CPU、内存、硬盘、显卡和系统信息...');

    try {
      const result = await window.electronAPI.inspectLocalSystem();
      lastLocalInspectResult = result;
      renderLocalScore(result);
      renderLocalInsights(result.insights);
      renderLocalSummary(result);
      renderLocalSections(result.sections);
      localLastChecked.textContent = new Date(result.inspectedAt).toLocaleString();
      localCopyReportBtn.disabled = false;
      localExportTxtBtn.disabled = false;
      localExportJsonBtn.disabled = false;
      showStatus(localStatusDiv, result.message, result.success ? 'success' : 'error');
    } catch (error) {
      clearLocalResult();
      showStatus(localStatusDiv, `检测失败：${(error as Error).message}`, 'error');
      showStatus(localStatusDiv, `检测失败: ${(error as Error).message}`, 'error');
    } finally {
      localInspectBtn.disabled = false;
    }
  });

  localCopyReportBtn.addEventListener('click', async () => {
    if (!lastLocalInspectResult) {
      showStatus(localStatusDiv, '请先完成一次检测。', 'error');
      showStatus(localStatusDiv, '请先完成一次检测。', 'error');
      return;
    }

    const result = await window.electronAPI.copyLocalSystemReport(lastLocalInspectResult);
    showStatus(localStatusDiv, result.message, result.success ? 'success' : 'error');
  });

  localExportTxtBtn.addEventListener('click', async () => {
    if (!lastLocalInspectResult) {
      showStatus(localStatusDiv, '请先完成一次检测。', 'error');
      showStatus(localStatusDiv, '请先完成一次检测。', 'error');
      return;
    }

    const result = await window.electronAPI.exportLocalSystemReport(lastLocalInspectResult, 'txt');
    showStatus(localStatusDiv, result.message, result.success ? 'success' : 'error');
  });

  localExportJsonBtn.addEventListener('click', async () => {
    if (!lastLocalInspectResult) {
      showStatus(localStatusDiv, '请先完成一次检测。', 'error');
      showStatus(localStatusDiv, '请先完成一次检测。', 'error');
      return;
    }

    const result = await window.electronAPI.exportLocalSystemReport(lastLocalInspectResult, 'json');
    showStatus(localStatusDiv, result.message, result.success ? 'success' : 'error');
  });

  const linuxScopeLabels: Record<LinuxInspectScope, string> = {
    full: '全量巡检',
    basic: '基础信息',
    resource: '资源负载',
    network: '网络与日志',
    runtime: '运行环境',
    security: '安全基线',
  };

  const runLinuxInspection = async (scope: LinuxInspectScope): Promise<void> => {
    const credentials = readLinuxCredentials();
    if (!credentials) {
      return;
    }

    linuxInspectBtn.disabled = true;
    linuxScopeButtons.forEach((button) => {
      button.disabled = true;
    });
    clearLinuxResult();
    showStatus(linuxStatusDiv, `正在执行${linuxScopeLabels[scope]}...`);

    try {
      const result = await window.electronAPI.inspectLinuxServer(credentials, scope);
      renderLinuxSummary(result);
      renderLinuxHighlights(result.highlights);
      renderLinuxScoreBreakdown(result.score.breakdown);
      renderLinuxServiceHealth(result.serviceHealth);
      renderLinuxAlerts(result.alerts);
      renderLinuxSections(result.sections);
      linuxLastChecked.textContent = new Date(result.inspectedAt).toLocaleString();
      showStatus(linuxStatusDiv, result.message, result.success ? 'success' : 'error');
    } catch (error) {
      clearLinuxResult();
      showStatus(linuxStatusDiv, `巡检失败: ${(error as Error).message}`, 'error');
    } finally {
      linuxInspectBtn.disabled = false;
      linuxScopeButtons.forEach((button) => {
        button.disabled = false;
      });
      linuxPasswordInput.value = '';
    }
  };

  const runLinuxQuickTool = async (action: LinuxQuickAction, runningText: string): Promise<void> => {
    const credentials = readLinuxCredentials();
    if (!credentials) {
      return;
    }

    linuxInspectBtn.disabled = true;
    linuxScopeButtons.forEach((button) => {
      button.disabled = true;
    });
    linuxViewNginxConfigBtn.disabled = true;
    linuxRestartNginxBtn.disabled = true;
    clearLinuxQuickActionOutput();
    showStatus(linuxQuickActionStatusDiv, runningText);

    try {
      const result = await window.electronAPI.runLinuxQuickAction(credentials, action);
      renderLinuxQuickActionResult(result);
      showStatus(linuxQuickActionStatusDiv, result.message, result.success ? 'success' : 'error');
    } catch (error) {
      clearLinuxQuickActionOutput();
      showStatus(linuxQuickActionStatusDiv, `执行失败: ${(error as Error).message}`, 'error');
    } finally {
      linuxInspectBtn.disabled = false;
      linuxScopeButtons.forEach((button) => {
        button.disabled = false;
      });
      linuxViewNginxConfigBtn.disabled = false;
      linuxRestartNginxBtn.disabled = false;
      linuxPasswordInput.value = '';
    }
  };

  linuxInspectBtn.addEventListener('click', async () => {
    await runLinuxInspection('full');
  });

  linuxScopeButtons.forEach((button) => {
    button.addEventListener('click', async () => {
      const scope = button.dataset.linuxScope as LinuxInspectScope | undefined;
      if (!scope) {
        return;
      }
      await runLinuxInspection(scope);
    });
  });

  linuxViewNginxConfigBtn.addEventListener('click', async () => {
    await runLinuxQuickTool('nginxConfig', '正在读取 Nginx 配置内容...');
  });

  linuxRestartNginxBtn.addEventListener('click', async () => {
    await runLinuxQuickTool('restartNginx', '正在重启 Nginx...');
  });

  selectFolderBtn.addEventListener('click', async () => {
    await chooseDirectory(folderPathInput, stringReplacerStatusDiv, '已选择文件夹');
  });

  startRenameBtn.addEventListener('click', async () => {
    const folderPath = folderPathInput.value.trim();
    if (!folderPath) {
      showStatus(stringReplacerStatusDiv, '请先选择文件夹。', 'error');
      return;
    }
    if (!searchStringInput.value) {
      showStatus(stringReplacerStatusDiv, '查找字符串不能为空。', 'error');
      return;
    }

    startRenameBtn.disabled = true;
    showStatus(stringReplacerStatusDiv, '正在批量重命名...');
    try {
      const result = await window.electronAPI.renameFiles(folderPath, searchStringInput.value, replaceStringInput.value);
      showStatus(stringReplacerStatusDiv, result.message, result.success ? 'success' : 'error');
    } finally {
      startRenameBtn.disabled = false;
    }
  });

  selectCodeAssistantFolderBtn.addEventListener('click', async () => {
    await chooseDirectory(codeAssistantFolderPathInput, codeAssistantStatusDiv, '已选择项目文件夹');
  });

  generateFileListBtn.addEventListener('click', async () => {
    const folderPath = codeAssistantFolderPathInput.value.trim();
    if (!folderPath) {
      showStatus(codeAssistantStatusDiv, '请先选择项目文件夹。', 'error');
      return;
    }

    generateFileListBtn.disabled = true;
    showStatus(codeAssistantStatusDiv, '正在生成文件列表...');
    try {
      const result = await window.electronAPI.generateFileList(folderPath);
      showStatus(codeAssistantStatusDiv, result.message, result.success ? 'success' : 'error');
    } finally {
      generateFileListBtn.disabled = false;
    }
  });

  selectArchiveFolderBtn.addEventListener('click', async () => {
    await chooseDirectory(archiveFolderPathInput, archiveStatusDiv, '已选择待解压文件夹');
  });

  const unsubscribeArchiveProgress = window.electronAPI.onArchiveProgress((payload) => {
    const overallPercent = payload.totalArchives > 0
      ? ((Math.max(payload.archiveIndex - 1, 0) + (payload.archivePercent ?? 0) / 100) / payload.totalArchives) * 100
      : payload.phase === 'done'
        ? 100
        : 0;

    archiveProgressBar.value = Math.max(0, Math.min(100, overallPercent));
    if (payload.phase === 'flattening' && payload.totalMovedFiles) {
      archiveProgressText.textContent = `(${payload.archiveIndex}/${Math.max(payload.totalArchives, 1)}) 提取文件 ${payload.movedFiles ?? 0}/${payload.totalMovedFiles}`;
    } else if (payload.totalArchives > 0) {
      archiveProgressText.textContent = `(${payload.archiveIndex}/${payload.totalArchives}) ${Math.round(payload.archivePercent ?? 0)}%`;
    } else {
      archiveProgressText.textContent = payload.message;
    }

    appendLog(archiveLog, payload.message, 14);
  });

  extractArchivesBtn.addEventListener('click', async () => {
    const folderPath = archiveFolderPathInput.value.trim();
    if (!folderPath) {
      showStatus(archiveStatusDiv, '请先选择文件夹。', 'error');
      return;
    }

    extractArchivesBtn.disabled = true;
    resetArchiveProgress();
    showStatus(archiveStatusDiv, '正在准备批量解压...');
    try {
      const result = await window.electronAPI.extractArchives(folderPath);
      archiveSuccessCount.textContent = String(result.processedArchives);
      archiveDeletedCount.textContent = String(result.deletedArchives);
      archiveFailureCount.textContent = String(result.failures.length);
      archiveExtractedCount.textContent = String(result.extractedFiles);
      showStatus(archiveStatusDiv, result.message, result.success ? 'success' : 'error');
      result.failures.forEach((failure) => appendLog(archiveLog, `失败: ${failure.archivePath} | ${failure.reason}`, 14));
    } catch (error) {
      showStatus(archiveStatusDiv, `发生错误: ${(error as Error).message}`, 'error');
    } finally {
      extractArchivesBtn.disabled = false;
    }
  });

  const unsubscribeDownloadProgress = window.electronAPI.onDownloadProgress((payload) => {
    const overallPercent = payload.totalItems > 0
      ? ((Math.max(payload.itemIndex - 1, 0) + (payload.percent ?? 0) / 100) / payload.totalItems) * 100
      : payload.phase === 'done'
        ? 100
        : 0;

    douyinProgressBar.value = Math.max(0, Math.min(100, overallPercent));
    if (payload.totalItems > 0) {
      const percentText = payload.percent !== undefined ? `${Math.round(payload.percent)}%` : '--';
      const speedText = payload.speed ? ` | ${payload.speed}` : '';
      const etaText = payload.eta ? ` | ETA ${payload.eta}` : '';
      douyinProgressText.textContent = `(${payload.itemIndex}/${payload.totalItems}) ${percentText}${speedText}${etaText}`;
    } else {
      douyinProgressText.textContent = payload.message;
    }
    appendLog(douyinLog, payload.message);
  });

  importLinksBtn.addEventListener('click', async () => {
    const content = await window.electronAPI.openTextFile();
    if (content === null) {
      return;
    }
    douyinLinksInput.value = content;
    showStatus(douyinStatusDiv, '已导入链接文本。', 'success');
  });

  selectDouyinOutputBtn.addEventListener('click', async () => {
    await chooseDirectory(douyinOutputPathInput, douyinStatusDiv, '已选择下载保存目录');
    await savePreferences();
  });

  selectCookieFileBtn.addEventListener('click', async () => {
    const filePath = await window.electronAPI.openCookieFile();
    if (!filePath) {
      return;
    }
    cookieFilePathInput.value = filePath;
    showStatus(douyinStatusDiv, '已选择 Cookie 文件。', 'success');
    await savePreferences();
  });

  clearCookieFileBtn.addEventListener('click', async () => {
    cookieFilePathInput.value = '';
    showStatus(douyinStatusDiv, '已清空 Cookie 文件。', 'success');
    await savePreferences();
  });

  namingPresetSelect.addEventListener('change', async () => {
    customTemplateRow.style.display = namingPresetSelect.value === 'custom' ? 'block' : 'none';
    await savePreferences();
  });

  [concurrencyInput, socketTimeoutInput, retryCountInput, limitRateInput, proxyInput, customTemplateInput].forEach((element) => {
    element.addEventListener('change', () => {
      void savePreferences();
    });
  });

  [
    includeThumbnailCheckbox,
    includeDescriptionCheckbox,
    includeSubtitlesCheckbox,
    dedupeCheckbox,
    skipExistingCheckbox,
  ].forEach((element) => {
    element.addEventListener('change', () => {
      void savePreferences();
    });
  });

  const collectPreviewOptions = (): Pick<DownloadPreferences, 'cookieFilePath' | 'proxy' | 'socketTimeout' | 'concurrency'> => ({
    cookieFilePath: cookieFilePathInput.value.trim(),
    proxy: proxyInput.value.trim(),
    socketTimeout: Math.max(0, Number(socketTimeoutInput.value) || 0),
    concurrency: Math.max(1, Number(concurrencyInput.value) || 1),
  });

  precheckBtn.addEventListener('click', async () => {
    const rawUrls = douyinLinksInput.value.trim();
    if (!rawUrls) {
      showStatus(douyinStatusDiv, '请先输入链接。', 'error');
      return;
    }

    precheckBtn.disabled = true;
    renderPreviewRows([]);
    showStatus(douyinStatusDiv, '正在预检查链接...');
    try {
      const items = await window.electronAPI.precheckDownloads(rawUrls, collectPreviewOptions());
      renderPreviewRows(items);
      const failedCount = items.filter((item) => !item.success).length;
      showStatus(
        douyinStatusDiv,
        failedCount === 0 ? `预检查完成，共 ${items.length} 条，全部可下载。` : `预检查完成，共 ${items.length} 条，其中 ${failedCount} 条失败。`,
        failedCount === 0 ? 'success' : 'error',
      );
    } catch (error) {
      showStatus(douyinStatusDiv, `预检查失败: ${(error as Error).message}`, 'error');
    } finally {
      precheckBtn.disabled = false;
    }
  });

  const runDownload = async (rawUrls: string): Promise<void> => {
    const preferences = readDownloadPreferencesFromForm();
    if (!rawUrls.trim()) {
      showStatus(douyinStatusDiv, '请先输入抖音视频链接。', 'error');
      return;
    }
    if (!preferences.outputDir) {
      showStatus(douyinStatusDiv, '请先选择下载保存目录。', 'error');
      return;
    }

    resetDownloadProgress();
    await savePreferences();
    startDouyinDownloadBtn.disabled = true;
    retryFailedBtn.disabled = true;
    pauseDownloadBtn.disabled = false;
    resumeDownloadBtn.disabled = true;
    cancelDownloadBtn.disabled = false;
    openDownloadFolderBtn.disabled = false;
    exportCsvBtn.disabled = true;
    exportTxtBtn.disabled = true;
    showStatus(douyinStatusDiv, '正在准备批量下载...');

    const totalUrls = rawUrls.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).length;
    douyinTotalCount.textContent = String(totalUrls);

    try {
      const result = await window.electronAPI.downloadVideos(rawUrls, preferences);
      lastDownloadResult = result;
      lastFailedUrls = result.results.filter((item) => !item.success && item.errorCategory !== '已取消').map((item) => item.url);
      updateDownloadStats(result);
      renderDownloadResults(result);
      showStatus(douyinStatusDiv, result.message, result.success ? 'success' : 'error');
      exportCsvBtn.disabled = false;
      exportTxtBtn.disabled = false;
      retryFailedBtn.disabled = lastFailedUrls.length === 0;
      const state = await window.electronAPI.getDownloadState();
      renderHistory(state.history);
    } catch (error) {
      showStatus(douyinStatusDiv, `下载任务失败: ${(error as Error).message}`, 'error');
    } finally {
      startDouyinDownloadBtn.disabled = false;
      pauseDownloadBtn.disabled = true;
      resumeDownloadBtn.disabled = true;
      cancelDownloadBtn.disabled = true;
    }
  };

  startDouyinDownloadBtn.addEventListener('click', async () => {
    await runDownload(douyinLinksInput.value);
  });

  retryFailedBtn.addEventListener('click', async () => {
    if (lastFailedUrls.length === 0) {
      showStatus(douyinStatusDiv, '当前没有可重试的失败链接。', 'error');
      return;
    }
    douyinLinksInput.value = lastFailedUrls.join('\n');
    await runDownload(lastFailedUrls.join('\n'));
  });

  pauseDownloadBtn.addEventListener('click', async () => {
    const result = await window.electronAPI.pauseDownloads();
    showStatus(douyinStatusDiv, result.message, result.success ? 'success' : 'error');
    if (result.success) {
      pauseDownloadBtn.disabled = true;
      resumeDownloadBtn.disabled = false;
    }
  });

  resumeDownloadBtn.addEventListener('click', async () => {
    const result = await window.electronAPI.resumeDownloads();
    showStatus(douyinStatusDiv, result.message, result.success ? 'success' : 'error');
    if (result.success) {
      pauseDownloadBtn.disabled = false;
      resumeDownloadBtn.disabled = true;
    }
  });

  cancelDownloadBtn.addEventListener('click', async () => {
    const result = await window.electronAPI.cancelDownloads();
    showStatus(douyinStatusDiv, result.message, result.success ? 'success' : 'error');
    pauseDownloadBtn.disabled = true;
    resumeDownloadBtn.disabled = true;
    cancelDownloadBtn.disabled = true;
    startDouyinDownloadBtn.disabled = false;
  });

  exportCsvBtn.addEventListener('click', async () => {
    if (!lastDownloadResult) {
      showStatus(douyinStatusDiv, '还没有可导出的下载报告。', 'error');
      return;
    }
    const result = await window.electronAPI.exportDownloadReport(lastDownloadResult, 'csv');
    showStatus(douyinStatusDiv, result.message, result.success ? 'success' : 'error');
  });

  exportTxtBtn.addEventListener('click', async () => {
    if (!lastDownloadResult) {
      showStatus(douyinStatusDiv, '还没有可导出的下载报告。', 'error');
      return;
    }
    const result = await window.electronAPI.exportDownloadReport(lastDownloadResult, 'txt');
    showStatus(douyinStatusDiv, result.message, result.success ? 'success' : 'error');
  });

  openDownloadFolderBtn.addEventListener('click', async () => {
    const targetPath = douyinOutputPathInput.value.trim();
    if (!targetPath) {
      showStatus(douyinStatusDiv, '请先选择下载目录。', 'error');
      return;
    }
    await window.electronAPI.openPath(targetPath);
  });

  const state = await window.electronAPI.getDownloadState();
  applyDownloadPreferencesToForm(state.preferences);
  ytDlpVersionText.textContent = `yt-dlp 版本：${state.version}`;
  ytDlpVersionHint.textContent = state.versionHint;
  renderHistory(state.history);
  renderPreviewRows([]);
  renderDownloadResults({
    success: true,
    message: '',
    totalUrls: 0,
    successfulDownloads: 0,
    failedDownloads: 0,
    canceledDownloads: 0,
    results: [],
  });
  resetArchiveProgress();
  resetDownloadProgress();
  clearLocalResult();
  clearLinuxResult();
  await applyArchiveRuntimeState();
  await applyDownloadRuntimeState();

  window.addEventListener('beforeunload', () => {
    unsubscribeArchiveProgress();
    unsubscribeDownloadProgress();
  });
});

export {};
