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

declare global {
  interface Window {
    electronAPI: {
      openDirectory: () => Promise<string | null>;
      openTextFile: () => Promise<string | null>;
      openCookieFile: () => Promise<string | null>;
      openPath: (targetPath: string) => Promise<boolean>;
      renameFiles: (folderPath: string, searchString: string, replaceString: string) => Promise<SimpleResult>;
      generateFileList: (folderPath: string) => Promise<SimpleResult>;
      extractArchives: (folderPath: string) => Promise<BatchExtractResult>;
      getDownloadState: () => Promise<DownloadToolState>;
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

  const clearStatus = (element: HTMLDivElement): void => {
    element.textContent = '';
    element.className = 'status-message';
  };

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

  const updateDownloadStats = (result: BatchDownloadResult): void => {
    douyinSuccessCount.textContent = String(result.successfulDownloads);
    douyinFailureCount.textContent = String(result.failedDownloads);
    douyinCanceledCount.textContent = String(result.canceledDownloads);
    douyinTotalCount.textContent = String(result.totalUrls);
  };

  const savePreferences = async (): Promise<void> => {
    await window.electronAPI.saveDownloadPreferences(readDownloadPreferencesFromForm());
  };

  navItems.forEach((item) => {
    item.addEventListener('click', (event) => {
      event.preventDefault();
      navItems.forEach((nav) => nav.classList.remove('active'));
      item.classList.add('active');
      showToolSection(`${item.id.replace('nav-', '')}-tool`);
      clearStatus(stringReplacerStatusDiv);
      clearStatus(codeAssistantStatusDiv);
      clearStatus(archiveStatusDiv);
      clearStatus(douyinStatusDiv);
    });
  });

  if (navItems.length > 0) {
    showToolSection(`${navItems[0].id.replace('nav-', '')}-tool`);
  }

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

  window.addEventListener('beforeunload', () => {
    unsubscribeArchiveProgress();
    unsubscribeDownloadProgress();
  });
});

export {};
