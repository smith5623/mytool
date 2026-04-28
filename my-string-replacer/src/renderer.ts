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

type OperationResult = {
  success: boolean;
  message: string;
};

type BatchExtractResult = OperationResult & {
  processedArchives: number;
  totalArchives: number;
  extractedFiles: number;
  failures: Array<{ archivePath: string; reason: string }>;
};

declare global {
  interface Window {
    electronAPI: {
      openDirectory: () => Promise<string | null>;
      renameFiles: (folderPath: string, searchString: string, replaceString: string) => Promise<OperationResult>;
      generateFileList: (folderPath: string) => Promise<OperationResult>;
      extractArchives: (folderPath: string) => Promise<BatchExtractResult>;
      onArchiveProgress: (listener: (payload: ArchiveProgressPayload) => void) => () => void;
    };
  }
}

document.addEventListener('DOMContentLoaded', () => {
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

  const navItems = document.querySelectorAll<HTMLAnchorElement>('#sidebar ul li a');
  const toolSections = document.querySelectorAll<HTMLElement>('.tool-section');

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

  const resetArchiveProgress = (): void => {
    archiveProgressBar.value = 0;
    archiveProgressText.textContent = '等待开始';
    archiveLog.textContent = '';
  };

  const appendArchiveLog = (message: string): void => {
    const lines = archiveLog.textContent ? archiveLog.textContent.split('\n') : [];
    lines.push(message);
    archiveLog.textContent = lines.slice(-14).join('\n');
    archiveLog.scrollTop = archiveLog.scrollHeight;
  };

  const showToolSection = (sectionId: string): void => {
    toolSections.forEach((section) => section.classList.remove('active'));
    const activeSection = document.getElementById(sectionId);
    if (activeSection) {
      activeSection.classList.add('active');
    }
  };

  navItems.forEach((item) => {
    item.addEventListener('click', (event) => {
      event.preventDefault();
      navItems.forEach((nav) => nav.classList.remove('active'));
      item.classList.add('active');

      const targetId = `${item.id.replace('nav-', '')}-tool`;
      showToolSection(targetId);
      clearStatus(stringReplacerStatusDiv);
      clearStatus(codeAssistantStatusDiv);
      clearStatus(archiveStatusDiv);
    });
  });

  if (navItems.length > 0) {
    const firstToolId = `${navItems[0].id.replace('nav-', '')}-tool`;
    showToolSection(firstToolId);
  }

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

  selectFolderBtn.addEventListener('click', async () => {
    await chooseDirectory(folderPathInput, stringReplacerStatusDiv, '已选择文件夹');
  });

  startRenameBtn.addEventListener('click', async () => {
    const folderPath = folderPathInput.value.trim();
    const searchString = searchStringInput.value;
    const replaceString = replaceStringInput.value;

    if (!folderPath) {
      showStatus(stringReplacerStatusDiv, '请先选择文件夹。', 'error');
      return;
    }

    if (!searchString) {
      showStatus(stringReplacerStatusDiv, '查找字符串不能为空。', 'error');
      return;
    }

    startRenameBtn.disabled = true;
    showStatus(stringReplacerStatusDiv, '正在批量重命名...');

    try {
      const result = await window.electronAPI.renameFiles(folderPath, searchString, replaceString);
      showStatus(stringReplacerStatusDiv, result.message, result.success ? 'success' : 'error');
    } catch (error) {
      showStatus(stringReplacerStatusDiv, `发生错误: ${(error as Error).message}`, 'error');
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
    showStatus(codeAssistantStatusDiv, '正在生成项目文件列表...');

    try {
      const result = await window.electronAPI.generateFileList(folderPath);
      showStatus(codeAssistantStatusDiv, result.message, result.success ? 'success' : 'error');
    } catch (error) {
      showStatus(codeAssistantStatusDiv, `发生错误: ${(error as Error).message}`, 'error');
    } finally {
      generateFileListBtn.disabled = false;
    }
  });

  selectArchiveFolderBtn.addEventListener('click', async () => {
    await chooseDirectory(archiveFolderPathInput, archiveStatusDiv, '已选择待解压文件夹');
  });

  const unsubscribeArchiveProgress = window.electronAPI.onArchiveProgress((payload) => {
    const archiveLabel = payload.archivePath ? payload.archivePath.split(/[/\\]/).pop() : '';
    const overallPercent = payload.totalArchives > 0
      ? ((Math.max(payload.archiveIndex - 1, 0) + (payload.archivePercent ?? 0) / 100) / payload.totalArchives) * 100
      : payload.phase === 'done'
        ? 100
        : 0;

    archiveProgressBar.value = Math.max(0, Math.min(100, overallPercent));

    if (payload.phase === 'flattening' && payload.totalMovedFiles) {
      archiveProgressText.textContent = `(${payload.archiveIndex}/${Math.max(payload.totalArchives, 1)}) ${archiveLabel} | 提取文件 ${payload.movedFiles ?? 0}/${payload.totalMovedFiles}`;
    } else if (payload.totalArchives > 0) {
      archiveProgressText.textContent = `(${payload.archiveIndex}/${payload.totalArchives}) ${archiveLabel} | ${Math.round(payload.archivePercent ?? 0)}%`;
    } else {
      archiveProgressText.textContent = payload.message;
    }

    appendArchiveLog(payload.message);
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
      showStatus(archiveStatusDiv, result.message, result.success ? 'success' : 'error');

      if (result.failures.length > 0) {
        result.failures.forEach((failure) => {
          appendArchiveLog(`失败: ${failure.archivePath} | ${failure.reason}`);
        });
      }
    } catch (error) {
      showStatus(archiveStatusDiv, `发生错误: ${(error as Error).message}`, 'error');
    } finally {
      extractArchivesBtn.disabled = false;
    }
  });

  window.addEventListener('beforeunload', () => {
    unsubscribeArchiveProgress();
  });

  resetArchiveProgress();
});

export {};
