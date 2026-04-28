declare const MAIN_WINDOW_WEBPACK_ENTRY: string;
declare const MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY: string;

import { app, BrowserWindow, dialog, ipcMain, Notification, shell } from 'electron';
import { spawn, ChildProcessWithoutNullStreams } from 'child_process';
import { extractFull } from 'node-7z';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

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

type DownloadOptions = {
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

type DownloadPreferences = DownloadOptions & {
  defaultDownloadDir: string;
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

type DownloadToolState = {
  preferences: DownloadPreferences;
  version: string;
  versionHint: string;
  history: DownloadHistoryEntry[];
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

type DownloadTaskControl = 'none' | 'pause' | 'cancel';

type ActiveDownloadItem = {
  url: string;
  index: number;
  child: ChildProcessWithoutNullStreams;
  control: DownloadTaskControl;
};

type DownloadTask = {
  sender: Electron.WebContents;
  urls: string[];
  options: DownloadOptions;
  pendingIndexes: number[];
  activeItems: Map<number, ActiveDownloadItem>;
  results: Map<number, DownloadItemResult>;
  paused: boolean;
  canceled: boolean;
  completed: boolean;
  completionPromise: Promise<BatchDownloadResult>;
  resolve: (result: BatchDownloadResult) => void;
};

const ARCHIVE_EXTENSIONS = [
  '.zip',
  '.rar',
  '.7z',
  '.tar',
  '.gz',
  '.bz2',
  '.xz',
  '.tgz',
  '.tbz',
  '.tbz2',
  '.txz',
  '.tar.gz',
  '.tar.bz2',
  '.tar.xz',
];

const HISTORY_LIMIT = 12;
const DOWNLOAD_HISTORY_FILE = 'download-history.json';
const DOWNLOAD_PREFERENCES_FILE = 'download-preferences.json';
const DOWNLOAD_ARCHIVE_FILE = 'download-archive.txt';

let currentDownloadTask: DownloadTask | null = null;

if (require('electron-squirrel-startup')) {
  app.quit();
}

const createWindow = (): void => {
  const mainWindow = new BrowserWindow({
    width: 1240,
    height: 900,
    minWidth: 1080,
    minHeight: 760,
    webPreferences: {
      preload: MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY,
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  mainWindow.loadURL(MAIN_WINDOW_WEBPACK_ENTRY);
};

app.on('ready', createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

const getUserDataFilePath = (fileName: string): string => path.join(app.getPath('userData'), fileName);

const getDefaultDownloadPreferences = (): DownloadPreferences => ({
  defaultDownloadDir: app.getPath('downloads'),
  outputDir: app.getPath('downloads'),
  concurrency: 2,
  includeThumbnail: false,
  includeDescription: false,
  includeSubtitles: false,
  cookieFilePath: '',
  proxy: '',
  socketTimeout: 30,
  retries: 3,
  limitRate: '',
  namingPreset: 'title-id',
  customTemplate: '%(title).200B [%(id)s].%(ext)s',
  dedupe: true,
  skipExisting: true,
});

const ensureParentDirectory = async (filePath: string): Promise<void> => {
  await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
};

const readJsonFile = async <T>(filePath: string, fallbackValue: T): Promise<T> => {
  try {
    const content = await fs.promises.readFile(filePath, 'utf-8');
    return JSON.parse(content) as T;
  } catch {
    return fallbackValue;
  }
};

const writeJsonFile = async <T>(filePath: string, data: T): Promise<void> => {
  await ensureParentDirectory(filePath);
  await fs.promises.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
};

const loadDownloadPreferences = async (): Promise<DownloadPreferences> => {
  const filePath = getUserDataFilePath(DOWNLOAD_PREFERENCES_FILE);
  const defaults = getDefaultDownloadPreferences();
  const savedPreferences = await readJsonFile<Partial<DownloadPreferences>>(filePath, {});
  return {
    ...defaults,
    ...savedPreferences,
    outputDir: savedPreferences.outputDir || savedPreferences.defaultDownloadDir || defaults.outputDir,
    defaultDownloadDir: savedPreferences.defaultDownloadDir || defaults.defaultDownloadDir,
  };
};

const saveDownloadPreferences = async (preferences: DownloadPreferences): Promise<void> => {
  const filePath = getUserDataFilePath(DOWNLOAD_PREFERENCES_FILE);
  await writeJsonFile(filePath, preferences);
};

const loadDownloadHistory = async (): Promise<DownloadHistoryEntry[]> => {
  const filePath = getUserDataFilePath(DOWNLOAD_HISTORY_FILE);
  return readJsonFile<DownloadHistoryEntry[]>(filePath, []);
};

const appendDownloadHistory = async (entry: DownloadHistoryEntry): Promise<void> => {
  const history = await loadDownloadHistory();
  const nextHistory = [entry, ...history].slice(0, HISTORY_LIMIT);
  await writeJsonFile(getUserDataFilePath(DOWNLOAD_HISTORY_FILE), nextHistory);
};

const getDownloadArchiveFilePath = (): string => getUserDataFilePath(DOWNLOAD_ARCHIVE_FILE);

const getResourceExecutablePath = (resourceFolder: string, executableName: string): string => {
  const platformDir = process.platform === 'win32' ? 'win' : process.platform === 'darwin' ? 'mac' : 'linux';
  const candidatePaths = [
    path.join(process.resourcesPath, resourceFolder, platformDir, process.arch, executableName),
    path.join(app.getAppPath(), 'resources', resourceFolder, platformDir, process.arch, executableName),
    path.join(process.cwd(), 'resources', resourceFolder, platformDir, process.arch, executableName),
  ];

  const matchedPath = candidatePaths.find((candidatePath) => fs.existsSync(candidatePath));
  if (!matchedPath) {
    throw new Error(`${resourceFolder} executable not found. Checked: ${candidatePaths.join(' | ')}`);
  }

  return matchedPath;
};

const getBundled7ZipBinaryPath = (): string => {
  const executableName = process.platform === 'win32' ? '7za.exe' : '7za';
  return getResourceExecutablePath('7zip', executableName);
};

const getBundledYtDlpBinaryPath = (): string => {
  const executableName = process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp';
  return getResourceExecutablePath('yt-dlp', executableName);
};

const getYtDlpVersion = async (): Promise<string> =>
  new Promise((resolve) => {
    try {
      const child = spawn(getBundledYtDlpBinaryPath(), ['--version'], {
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let output = '';

      child.stdout.on('data', (chunk) => {
        output += chunk.toString('utf-8');
      });

      child.once('close', (code) => {
        resolve(code === 0 ? output.trim() || 'unknown' : 'unknown');
      });

      child.once('error', () => resolve('unknown'));
    } catch {
      resolve('unknown');
    }
  });

const getVersionHint = async (): Promise<string> => {
  try {
    const stats = await fs.promises.stat(getBundledYtDlpBinaryPath());
    const ageInDays = Math.floor((Date.now() - stats.mtimeMs) / (1000 * 60 * 60 * 24));
    if (ageInDays > 90) {
      return '内置下载器较久未更新，若后续遇到链接解析失败，建议替换为新版 yt-dlp。';
    }
    return '内置下载器状态正常。';
  } catch {
    return '未找到内置下载器。';
  }
};

const buildDownloadOutputTemplate = (options: DownloadOptions): string => {
  if (options.namingPreset === 'author-title-id') {
    return '%(uploader,creator,channel)s - %(title).180B [%(id)s].%(ext)s';
  }

  if (options.namingPreset === 'date-author-title') {
    return '%(upload_date>%Y-%m-%d)s - %(uploader,creator,channel)s - %(title).160B [%(id)s].%(ext)s';
  }

  if (options.namingPreset === 'custom' && options.customTemplate?.trim()) {
    return options.customTemplate.trim();
  }

  return '%(title).200B [%(id)s].%(ext)s';
};

const normalizeBatchUrls = (rawUrls: string): string[] =>
  rawUrls
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0);

const dedupeUrls = (urls: string[]): string[] => {
  const seen = new Set<string>();
  return urls.filter((url) => {
    if (seen.has(url)) {
      return false;
    }

    seen.add(url);
    return true;
  });
};

const classifyDownloadError = (errorMessage: string): string => {
  const lowerCase = errorMessage.toLowerCase();
  if (lowerCase.includes('cookies')) {
    return 'Cookie';
  }
  if (lowerCase.includes('proxy')) {
    return '代理';
  }
  if (lowerCase.includes('timeout') || lowerCase.includes('timed out')) {
    return '超时';
  }
  if (lowerCase.includes('http error 403') || lowerCase.includes('forbidden') || lowerCase.includes('login')) {
    return '权限限制';
  }
  if (lowerCase.includes('unable to extract') || lowerCase.includes('unsupported url') || lowerCase.includes('extractor')) {
    return '解析失败';
  }
  if (lowerCase.includes('network') || lowerCase.includes('connection') || lowerCase.includes('name resolution')) {
    return '网络';
  }
  if (lowerCase.includes('cancel')) {
    return '已取消';
  }
  return '未知';
};

const parseDownloadProgressLine = (line: string): Pick<DownloadProgressPayload, 'percent' | 'speed' | 'eta'> => {
  const percentMatch = line.match(/\[download\]\s+(\d+(?:\.\d+)?)%/);
  const speedMatch = line.match(/\sat\s+(.+?)\s+ETA/i);
  const etaMatch = line.match(/\sETA\s+(.+)$/i);
  return {
    percent: percentMatch ? Number(percentMatch[1]) : undefined,
    speed: speedMatch ? speedMatch[1].trim() : undefined,
    eta: etaMatch ? etaMatch[1].trim() : undefined,
  };
};

const isArchiveFile = (filePath: string): boolean => {
  const lowerCasePath = filePath.toLowerCase();
  return ARCHIVE_EXTENSIONS.some((extension) => lowerCasePath.endsWith(extension));
};

const sendArchiveProgress = (sender: Electron.WebContents, payload: ArchiveProgressPayload): void => {
  sender.send('archive:progress', payload);
};

const sendDownloadProgress = (sender: Electron.WebContents, payload: DownloadProgressPayload): void => {
  sender.send('download:progress', payload);
};

const collectArchiveFiles = async (rootDir: string): Promise<string[]> => {
  const archiveFiles: string[] = [];

  const traverse = async (currentDir: string): Promise<void> => {
    const entries = await fs.promises.readdir(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.name.startsWith('.')) {
        continue;
      }

      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        await traverse(fullPath);
      } else if (entry.isFile() && isArchiveFile(fullPath)) {
        archiveFiles.push(fullPath);
      }
    }
  };

  await traverse(rootDir);
  archiveFiles.sort((left, right) => left.localeCompare(right));
  return archiveFiles;
};

const collectFilesOnly = async (rootDir: string): Promise<string[]> => {
  const files: string[] = [];

  const traverse = async (currentDir: string): Promise<void> => {
    const entries = await fs.promises.readdir(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        await traverse(fullPath);
      } else if (entry.isFile()) {
        files.push(fullPath);
      }
    }
  };

  await traverse(rootDir);
  return files;
};

const getUniqueDestinationPath = async (destinationDir: string, fileName: string): Promise<string> => {
  const extension = path.extname(fileName);
  const basename = path.basename(fileName, extension);

  let candidatePath = path.join(destinationDir, fileName);
  let counter = 1;
  let pathAvailable = false;

  while (!pathAvailable) {
    try {
      await fs.promises.access(candidatePath);
      candidatePath = path.join(destinationDir, `${basename}${counter}${extension}`);
      counter += 1;
    } catch {
      pathAvailable = true;
    }
  }

  return candidatePath;
};

const moveFile = async (sourcePath: string, destinationPath: string): Promise<void> => {
  try {
    await fs.promises.rename(sourcePath, destinationPath);
  } catch (error) {
    const renameError = error as NodeJS.ErrnoException;
    if (renameError.code !== 'EXDEV') {
      throw error;
    }

    await fs.promises.copyFile(sourcePath, destinationPath);
    await fs.promises.unlink(sourcePath);
  }
};

const extractArchive = async (
  archivePath: string,
  outputDir: string,
  onProgress: (archivePercent: number, message: string) => void,
): Promise<void> =>
  new Promise((resolve, reject) => {
    const extractor = extractFull(archivePath, outputDir, {
      $bin: getBundled7ZipBinaryPath(),
      $progress: true,
      recursive: true,
      yes: true,
    });

    extractor.on('progress', (progress: { percent?: number }) => {
      onProgress(progress.percent ?? 0, '正在解压压缩包...');
    });

    extractor.on('data', (data: { file?: string }) => {
      if (data.file) {
        onProgress(100, `已处理: ${path.basename(data.file)}`);
      }
    });

    extractor.on('end', () => resolve());
    extractor.on('error', (error: Error & { stderr?: string }) => {
      const details = error.stderr?.trim();
      reject(new Error(details ? `${error.message} (${details})` : error.message));
    });
  });

const flattenExtractedFiles = async (
  extractedDir: string,
  destinationDir: string,
  onFileMoved: (movedFiles: number, totalMovedFiles: number, fileName: string) => void,
): Promise<number> => {
  const files = await collectFilesOnly(extractedDir);
  let movedFiles = 0;

  for (const filePath of files) {
    const destinationPath = await getUniqueDestinationPath(destinationDir, path.basename(filePath));
    await moveFile(filePath, destinationPath);
    movedFiles += 1;
    onFileMoved(movedFiles, files.length, path.basename(destinationPath));
  }

  return movedFiles;
};

const buildYtDlpArguments = (url: string, options: DownloadOptions): string[] => {
  const args = [
    '--ignore-config',
    '--newline',
    '--no-playlist',
    '--restrict-filenames',
    '--windows-filenames',
    '--print',
    'after_move:__FILE__:%(filepath)s',
    '-P',
    options.outputDir,
    '-o',
    buildDownloadOutputTemplate(options),
    url,
  ];

  if (options.includeThumbnail) {
    args.push('--write-thumbnail');
  }

  if (options.includeDescription) {
    args.push('--write-description');
  }

  if (options.includeSubtitles) {
    args.push('--write-subs', '--write-auto-subs', '--sub-langs', 'all');
  }

  if (options.cookieFilePath?.trim()) {
    args.push('--cookies', options.cookieFilePath.trim());
  }

  if (options.proxy?.trim()) {
    args.push('--proxy', options.proxy.trim());
  }

  if (options.socketTimeout && options.socketTimeout > 0) {
    args.push('--socket-timeout', String(options.socketTimeout));
  }

  if (options.retries !== undefined && options.retries >= 0) {
    args.push('--retries', String(options.retries));
  }

  if (options.limitRate?.trim()) {
    args.push('--limit-rate', options.limitRate.trim());
  }

  if (options.dedupe) {
    args.push('--download-archive', getDownloadArchiveFilePath());
  }

  if (options.skipExisting) {
    args.push('--no-overwrites');
  }

  return args;
};

const buildPreviewArguments = (url: string, options: Pick<DownloadOptions, 'cookieFilePath' | 'proxy' | 'socketTimeout'>): string[] => {
  const args = [
    '--ignore-config',
    '--skip-download',
    '--no-playlist',
    '--dump-single-json',
    url,
  ];

  if (options.cookieFilePath?.trim()) {
    args.push('--cookies', options.cookieFilePath.trim());
  }

  if (options.proxy?.trim()) {
    args.push('--proxy', options.proxy.trim());
  }

  if (options.socketTimeout && options.socketTimeout > 0) {
    args.push('--socket-timeout', String(options.socketTimeout));
  }

  return args;
};

const runSinglePreview = async (
  url: string,
  options: Pick<DownloadOptions, 'cookieFilePath' | 'proxy' | 'socketTimeout'>,
): Promise<DownloadPreviewItem> =>
  new Promise((resolve) => {
    const child = spawn(getBundledYtDlpBinaryPath(), buildPreviewArguments(url, options), {
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString('utf-8');
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString('utf-8');
    });

    child.once('error', (error) => {
      resolve({
        url,
        success: false,
        error: error.message,
      });
    });

    child.once('close', (code) => {
      if (code !== 0) {
        const errorMessage = stderr.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).pop() || `yt-dlp exited with code ${code}`;
        resolve({
          url,
          success: false,
          error: errorMessage,
        });
        return;
      }

      try {
        const json = JSON.parse(stdout) as Record<string, unknown>;
        const durationSeconds = typeof json.duration === 'number' ? json.duration : undefined;
        const durationText = durationSeconds !== undefined
          ? new Date(durationSeconds * 1000).toISOString().slice(durationSeconds >= 3600 ? 11 : 14, 19)
          : undefined;

        resolve({
          url,
          success: true,
          title: typeof json.title === 'string' ? json.title : undefined,
          uploader: typeof json.uploader === 'string' ? json.uploader : typeof json.creator === 'string' ? json.creator : undefined,
          durationText,
          thumbnail: typeof json.thumbnail === 'string' ? json.thumbnail : undefined,
        });
      } catch (error) {
        resolve({
          url,
          success: false,
          error: (error as Error).message,
        });
      }
    });
  });

const runWithConcurrency = async <T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> => {
  const safeConcurrency = Math.max(1, Math.min(concurrency, items.length || 1));
  const results: R[] = new Array(items.length);
  let currentIndex = 0;

  const runWorker = async (): Promise<void> => {
    while (currentIndex < items.length) {
      const nextIndex = currentIndex;
      currentIndex += 1;
      results[nextIndex] = await worker(items[nextIndex], nextIndex);
    }
  };

  await Promise.all(Array.from({ length: safeConcurrency }, () => runWorker()));
  return results;
};

const finalizeDownloadTask = async (task: DownloadTask): Promise<void> => {
  if (task.completed) {
    return;
  }

  if (task.activeItems.size > 0 || task.pendingIndexes.length > 0) {
    return;
  }

  task.completed = true;

  const orderedResults = task.urls.map((url, index) => task.results.get(index) || {
    url,
    success: false,
    error: 'Unknown result state',
    errorCategory: '未知',
  });

  const successfulDownloads = orderedResults.filter((item) => item.success).length;
  const canceledDownloads = orderedResults.filter((item) => item.errorCategory === '已取消').length;
  const failedDownloads = orderedResults.length - successfulDownloads - canceledDownloads;
  const success = failedDownloads === 0 && canceledDownloads === 0;
  const message = task.canceled
    ? `任务已取消。成功 ${successfulDownloads}，失败 ${failedDownloads}，取消 ${canceledDownloads}。`
    : success
      ? `全部下载完成，共 ${successfulDownloads} 个视频。`
      : `下载完成。成功 ${successfulDownloads}，失败 ${failedDownloads}，取消 ${canceledDownloads}。`;

  const result: BatchDownloadResult = {
    success,
    message,
    totalUrls: task.urls.length,
    successfulDownloads,
    failedDownloads,
    canceledDownloads,
    results: orderedResults,
  };

  await appendDownloadHistory({
    id: `task-${Date.now()}`,
    createdAt: new Date().toISOString(),
    outputDir: task.options.outputDir,
    totalUrls: result.totalUrls,
    successfulDownloads,
    failedDownloads,
    canceledDownloads,
  });

  sendDownloadProgress(task.sender, {
    phase: task.canceled ? 'canceled' : 'done',
    itemIndex: task.urls.length,
    totalItems: task.urls.length,
    percent: 100,
    message,
  });

  if (Notification.isSupported()) {
    new Notification({
      title: '批量下载已完成',
      body: message,
    }).show();
  }

  currentDownloadTask = null;
  task.resolve(result);
};

const pumpDownloadQueue = async (task: DownloadTask): Promise<void> => {
  if (task.paused || task.canceled) {
    await finalizeDownloadTask(task);
    return;
  }

  while (!task.paused && !task.canceled && task.activeItems.size < Math.max(1, task.options.concurrency) && task.pendingIndexes.length > 0) {
    const index = task.pendingIndexes.shift();
    if (index === undefined) {
      break;
    }

    const url = task.urls[index];
    sendDownloadProgress(task.sender, {
      phase: 'starting',
      itemIndex: index + 1,
      totalItems: task.urls.length,
      url,
      percent: 0,
      message: `开始下载 (${index + 1}/${task.urls.length})`,
    });

    const child = spawn(getBundledYtDlpBinaryPath(), buildYtDlpArguments(url, task.options), {
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const activeItem: ActiveDownloadItem = {
      url,
      index,
      child,
      control: 'none',
    };

    task.activeItems.set(index, activeItem);

    let stdout = '';
    let stderr = '';
    let finalFilePath = '';

    child.stdout.on('data', (chunk: Buffer) => {
      const text = chunk.toString('utf-8');
      stdout += text;
      for (const line of text.split(/\r?\n/)) {
        const trimmedLine = line.trim();
        if (!trimmedLine) {
          continue;
        }

        if (trimmedLine.startsWith('__FILE__:')) {
          finalFilePath = trimmedLine.replace('__FILE__:', '').trim();
        }
      }
    });

    child.stderr.on('data', (chunk: Buffer) => {
      const text = chunk.toString('utf-8');
      stderr += text;

      for (const line of text.split(/\r?\n/)) {
        const trimmedLine = line.trim();
        if (!trimmedLine) {
          continue;
        }

        const progressInfo = parseDownloadProgressLine(trimmedLine);
        sendDownloadProgress(task.sender, {
          phase: 'downloading',
          itemIndex: index + 1,
          totalItems: task.urls.length,
          url,
          percent: progressInfo.percent,
          speed: progressInfo.speed,
          eta: progressInfo.eta,
          message: trimmedLine,
        });
      }
    });

    child.once('error', async (error) => {
      task.activeItems.delete(index);
      task.results.set(index, {
        url,
        success: false,
        error: error.message,
        errorCategory: classifyDownloadError(error.message),
      });
      sendDownloadProgress(task.sender, {
        phase: 'error',
        itemIndex: index + 1,
        totalItems: task.urls.length,
        url,
        message: `下载失败: ${error.message}`,
      });
      await pumpDownloadQueue(task);
    });

    child.once('close', async (code) => {
      task.activeItems.delete(index);

      if (activeItem.control === 'pause') {
        task.pendingIndexes.unshift(index);
        sendDownloadProgress(task.sender, {
          phase: 'paused',
          itemIndex: index + 1,
          totalItems: task.urls.length,
          url,
          message: `已暂停，等待继续: ${url}`,
        });
        await finalizeDownloadTask(task);
        return;
      }

      if (activeItem.control === 'cancel') {
        task.results.set(index, {
          url,
          success: false,
          error: 'Canceled by user',
          errorCategory: '已取消',
        });
        await finalizeDownloadTask(task);
        return;
      }

      if (code === 0) {
        task.results.set(index, {
          url,
          success: true,
          filePath: finalFilePath || undefined,
        });
        sendDownloadProgress(task.sender, {
          phase: 'completed',
          itemIndex: index + 1,
          totalItems: task.urls.length,
          url,
          percent: 100,
          filePath: finalFilePath || undefined,
          message: `下载完成: ${finalFilePath || url}`,
        });
      } else {
        const outputLines = `${stderr}\n${stdout}`.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
        const errorMessage = outputLines[outputLines.length - 1] || `yt-dlp exited with code ${code}`;
        task.results.set(index, {
          url,
          success: false,
          error: errorMessage,
          errorCategory: classifyDownloadError(errorMessage),
        });
        sendDownloadProgress(task.sender, {
          phase: 'error',
          itemIndex: index + 1,
          totalItems: task.urls.length,
          url,
          message: `下载失败: ${errorMessage}`,
        });
      }

      await pumpDownloadQueue(task);
    });
  }

  await finalizeDownloadTask(task);
};

const createDownloadTask = (sender: Electron.WebContents, urls: string[], options: DownloadOptions): DownloadTask => {
  let resolveTask!: (result: BatchDownloadResult) => void;
  const completionPromise = new Promise<BatchDownloadResult>((resolve) => {
    resolveTask = resolve;
  });

  return {
    sender,
    urls,
    options,
    pendingIndexes: urls.map((_url, index) => index),
    activeItems: new Map<number, ActiveDownloadItem>(),
    results: new Map<number, DownloadItemResult>(),
    paused: false,
    canceled: false,
    completed: false,
    completionPromise,
    resolve: resolveTask,
  };
};

ipcMain.handle('dialog:openDirectory', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    properties: ['openDirectory'],
  });
  return canceled ? null : filePaths[0];
});

ipcMain.handle('dialog:openTextFile', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [{ name: 'Text Files', extensions: ['txt'] }, { name: 'All Files', extensions: ['*'] }],
  });

  if (canceled || filePaths.length === 0) {
    return null;
  }

  return fs.promises.readFile(filePaths[0], 'utf-8');
});

ipcMain.handle('dialog:openCookieFile', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [{ name: 'Cookie Files', extensions: ['txt', 'cookies'] }, { name: 'All Files', extensions: ['*'] }],
  });
  return canceled || filePaths.length === 0 ? null : filePaths[0];
});

ipcMain.handle('system:openPath', async (_event, targetPath: string) => {
  if (!targetPath) {
    return false;
  }
  await shell.openPath(targetPath);
  return true;
});

ipcMain.handle('download:getState', async (): Promise<DownloadToolState> => {
  const preferences = await loadDownloadPreferences();
  const version = await getYtDlpVersion();
  const versionHint = await getVersionHint();
  const history = await loadDownloadHistory();
  return {
    preferences,
    version,
    versionHint,
    history,
  };
});

ipcMain.handle('download:savePreferences', async (_event, preferences: DownloadPreferences): Promise<SimpleResult> => {
  await saveDownloadPreferences(preferences);
  return {
    success: true,
    message: '下载设置已保存。',
  };
});

ipcMain.handle('download:precheck', async (_event, rawUrls: string, options: Pick<DownloadOptions, 'cookieFilePath' | 'proxy' | 'socketTimeout' | 'concurrency'>) => {
  const urls = dedupeUrls(normalizeBatchUrls(rawUrls));
  if (urls.length === 0) {
    return [];
  }

  return runWithConcurrency(urls, Math.max(1, options.concurrency || 1), (url) =>
    runSinglePreview(url, {
      cookieFilePath: options.cookieFilePath,
      proxy: options.proxy,
      socketTimeout: options.socketTimeout,
    }),
  );
});

ipcMain.handle('download:batch', async (event, rawUrls: string, options: DownloadOptions): Promise<BatchDownloadResult> => {
  if (currentDownloadTask) {
    return {
      success: false,
      message: '已有下载任务正在进行，请先暂停或取消当前任务。',
      totalUrls: 0,
      successfulDownloads: 0,
      failedDownloads: 0,
      canceledDownloads: 0,
      results: [],
    };
  }

  const normalizedUrls = normalizeBatchUrls(rawUrls);
  const urls = options.dedupe ? dedupeUrls(normalizedUrls) : normalizedUrls;

  if (urls.length === 0) {
    return {
      success: false,
      message: '请至少输入一个视频链接。',
      totalUrls: 0,
      successfulDownloads: 0,
      failedDownloads: 0,
      canceledDownloads: 0,
      results: [],
    };
  }

  if (!options.outputDir) {
    return {
      success: false,
      message: '请先选择下载保存目录。',
      totalUrls: urls.length,
      successfulDownloads: 0,
      failedDownloads: urls.length,
      canceledDownloads: 0,
      results: [],
    };
  }

  const preferences: DownloadPreferences = {
    ...(await loadDownloadPreferences()),
    ...options,
    defaultDownloadDir: options.outputDir,
  };
  await saveDownloadPreferences(preferences);
  await ensureParentDirectory(getDownloadArchiveFilePath());

  const task = createDownloadTask(event.sender, urls, options);
  currentDownloadTask = task;
  void pumpDownloadQueue(task);
  return task.completionPromise;
});

ipcMain.handle('download:pause', async (): Promise<SimpleResult> => {
  if (!currentDownloadTask) {
    return { success: false, message: '当前没有正在进行的下载任务。' };
  }

  if (currentDownloadTask.paused) {
    return { success: false, message: '当前任务已经处于暂停状态。' };
  }

  currentDownloadTask.paused = true;
  currentDownloadTask.activeItems.forEach((item) => {
    item.control = 'pause';
    item.child.kill();
  });

  return { success: true, message: '下载队列已暂停。继续时会从未完成部分接着下载。' };
});

ipcMain.handle('download:resume', async (): Promise<SimpleResult> => {
  if (!currentDownloadTask) {
    return { success: false, message: '当前没有可继续的下载任务。' };
  }

  if (!currentDownloadTask.paused) {
    return { success: false, message: '当前任务并未暂停。' };
  }

  currentDownloadTask.paused = false;
  void pumpDownloadQueue(currentDownloadTask);
  return { success: true, message: '下载队列已继续。' };
});

ipcMain.handle('download:cancel', async (): Promise<SimpleResult> => {
  if (!currentDownloadTask) {
    return { success: false, message: '当前没有正在进行的下载任务。' };
  }

  currentDownloadTask.canceled = true;
  currentDownloadTask.pendingIndexes.forEach((index) => {
    const url = currentDownloadTask?.urls[index];
    if (!url || !currentDownloadTask) {
      return;
    }
    currentDownloadTask.results.set(index, {
      url,
      success: false,
      error: 'Canceled by user',
      errorCategory: '已取消',
    });
  });
  currentDownloadTask.pendingIndexes = [];

  currentDownloadTask.activeItems.forEach((item) => {
    item.control = 'cancel';
    item.child.kill();
  });

  await finalizeDownloadTask(currentDownloadTask);
  return { success: true, message: '下载任务已取消。' };
});

ipcMain.handle('download:exportReport', async (_event, result: BatchDownloadResult, format: 'csv' | 'txt'): Promise<SimpleResult> => {
  const { canceled, filePath } = await dialog.showSaveDialog({
    title: '导出下载报告',
    defaultPath: format === 'csv' ? 'download-report.csv' : 'download-report.txt',
    filters: [{ name: format.toUpperCase(), extensions: [format] }],
  });

  if (canceled || !filePath) {
    return { success: false, message: '已取消导出。' };
  }

  const content = format === 'csv'
    ? [
        'URL,Status,FilePath,ErrorCategory,Error',
        ...result.results.map((item) => [
          JSON.stringify(item.url),
          item.success ? 'Success' : 'Failed',
          JSON.stringify(item.filePath || ''),
          JSON.stringify(item.errorCategory || ''),
          JSON.stringify(item.error || ''),
        ].join(',')),
      ].join('\n')
    : [
        `Summary: total=${result.totalUrls}, success=${result.successfulDownloads}, failed=${result.failedDownloads}, canceled=${result.canceledDownloads}`,
        '',
        ...result.results.map((item) =>
          item.success
            ? `SUCCESS | ${item.url} | ${item.filePath || ''}`
            : `FAILED | ${item.url} | ${item.errorCategory || ''} | ${item.error || ''}`,
        ),
      ].join('\n');

  await fs.promises.writeFile(filePath, content, 'utf-8');
  return { success: true, message: `下载报告已导出到: ${filePath}` };
});

ipcMain.handle('file:rename', async (_event, folderPath: string, searchString: string, replaceString: string): Promise<SimpleResult> => {
  try {
    if (!folderPath) {
      throw new Error('Folder path is not provided.');
    }
    if (!searchString) {
      throw new Error('Search string is not provided.');
    }

    const renameItem = (currentPath: string): string => {
      const parentDir = path.dirname(currentPath);
      const baseName = path.basename(currentPath);

      if (!baseName.includes(searchString)) {
        return currentPath;
      }

      const newBaseName = baseName.replace(new RegExp(searchString, 'g'), replaceString);
      const newPath = path.join(parentDir, newBaseName);
      fs.renameSync(currentPath, newPath);
      return newPath;
    };

    const traverseDirectory = (currentDirPath: string): void => {
      const renamedCurrentDirPath = renameItem(currentDirPath);
      const files = fs.readdirSync(renamedCurrentDirPath);
      for (const file of files) {
        const filePath = path.join(renamedCurrentDirPath, file);
        const stat = fs.statSync(filePath);
        if (stat.isDirectory()) {
          traverseDirectory(filePath);
        } else {
          renameItem(filePath);
        }
      }
    };

    traverseDirectory(folderPath);
    return { success: true, message: '重命名已完成。' };
  } catch (error) {
    return { success: false, message: (error as Error).message };
  }
});

ipcMain.handle('file:generateFileList', async (_event, folderPath: string): Promise<SimpleResult> => {
  try {
    if (!folderPath) {
      throw new Error('Folder path is not provided.');
    }

    const markdownOutput: string[] = [];
    const ignoredNames = ['.git', '.gitignore', '.gitmodules', '.gitattributes', '.gitkeep', 'node_modules', 'dist'];

    const isTextFile = (filePath: string): boolean => {
      const textExtensions = ['.txt', '.md', '.js', '.ts', '.jsx', '.tsx', '.json', '.css', '.html', '.vue', '.py', '.java', '.c', '.cpp', '.h', '.hpp', '.go', '.rs', '.xml', '.yml', '.yaml', '.toml'];
      const extension = path.extname(filePath).toLowerCase();
      return textExtensions.includes(extension) || extension === '';
    };

    const traverseAndCollectFiles = (currentPath: string, level = 0): void => {
      const filesAndDirs = fs.readdirSync(currentPath, { withFileTypes: true });

      for (const item of filesAndDirs) {
        const itemName = item.name;
        const itemPath = path.join(currentPath, itemName);

        if (ignoredNames.includes(itemName) || itemName.startsWith('.')) {
          continue;
        }

        if (item.isDirectory()) {
          markdownOutput.push(`${'#'.repeat(level + 2)} Folder: ${itemName} [${itemPath}]`);
          traverseAndCollectFiles(itemPath, level + 1);
        } else if (item.isFile()) {
          markdownOutput.push(`${'#'.repeat(level + 2)} File: ${itemName}`);
          markdownOutput.push(`- **Absolute path**: ${itemPath}`);
          markdownOutput.push(`- **File name**: ${itemName}`);
          markdownOutput.push('- **Content**:\n```');

          try {
            const stats = fs.statSync(itemPath);
            if (stats.size > 1024 * 1024) {
              markdownOutput.push(`[File omitted because it is too large: ${(stats.size / (1024 * 1024)).toFixed(2)} MB]`);
            } else if (!isTextFile(itemPath)) {
              markdownOutput.push('[Binary file content omitted]');
            } else {
              markdownOutput.push(fs.readFileSync(itemPath, 'utf-8'));
            }
          } catch (readError) {
            markdownOutput.push(`[Unable to read file: ${(readError as Error).message}]`);
          }

          markdownOutput.push('```');
        }
      }
    };

    markdownOutput.push(`# Project File List: ${folderPath}\n`);
    traverseAndCollectFiles(folderPath);

    const { canceled, filePath } = await dialog.showSaveDialog({
      title: '保存项目文件列表',
      defaultPath: 'project_file_list.md',
      filters: [{ name: 'Markdown Files', extensions: ['md'] }],
    });

    if (canceled || !filePath) {
      return { success: false, message: '已取消保存。' };
    }

    fs.writeFileSync(filePath, markdownOutput.join('\n'), 'utf-8');
    return { success: true, message: `文件列表已保存到: ${filePath}` };
  } catch (error) {
    return { success: false, message: (error as Error).message };
  }
});

ipcMain.handle('archive:extractAll', async (event, folderPath: string): Promise<BatchExtractResult> => {
  if (!folderPath) {
    return {
      success: false,
      message: '请先选择文件夹。',
      processedArchives: 0,
      deletedArchives: 0,
      totalArchives: 0,
      extractedFiles: 0,
      failures: [],
    };
  }

  try {
    sendArchiveProgress(event.sender, {
      phase: 'scanning',
      archiveIndex: 0,
      totalArchives: 0,
      message: '正在扫描压缩文件...',
    });

    const archiveFiles = await collectArchiveFiles(folderPath);

    if (archiveFiles.length === 0) {
      sendArchiveProgress(event.sender, {
        phase: 'done',
        archiveIndex: 0,
        totalArchives: 0,
        message: '没有找到可解压的压缩文件。',
      });

      return {
        success: true,
        message: '没有找到可解压的压缩文件。',
        processedArchives: 0,
        deletedArchives: 0,
        totalArchives: 0,
        extractedFiles: 0,
        failures: [],
      };
    }

    let processedArchives = 0;
    let deletedArchives = 0;
    let extractedFiles = 0;
    const failures: Array<{ archivePath: string; reason: string }> = [];

    for (const [index, archivePath] of archiveFiles.entries()) {
      const archiveIndex = index + 1;
      const archiveDir = path.dirname(archivePath);
      const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'my-electron-tools-extract-'));

      try {
        sendArchiveProgress(event.sender, {
          phase: 'extracting',
          archiveIndex,
          totalArchives: archiveFiles.length,
          archivePath,
          archivePercent: 0,
          message: `正在解压 (${archiveIndex}/${archiveFiles.length}): ${path.basename(archivePath)}`,
        });

        await extractArchive(archivePath, tempDir, (archivePercent, message) => {
          sendArchiveProgress(event.sender, {
            phase: 'extracting',
            archiveIndex,
            totalArchives: archiveFiles.length,
            archivePath,
            archivePercent,
            message,
          });
        });

        sendArchiveProgress(event.sender, {
          phase: 'flattening',
          archiveIndex,
          totalArchives: archiveFiles.length,
          archivePath,
          archivePercent: 100,
          message: '正在提取文件到当前目录...',
        });

        const movedFiles = await flattenExtractedFiles(tempDir, archiveDir, (currentMovedFiles, totalMovedFiles, fileName) => {
          sendArchiveProgress(event.sender, {
            phase: 'flattening',
            archiveIndex,
            totalArchives: archiveFiles.length,
            archivePath,
            archivePercent: 100,
            movedFiles: currentMovedFiles,
            totalMovedFiles,
            message: `已提取文件: ${fileName}`,
          });
        });

        extractedFiles += movedFiles;
        await fs.promises.unlink(archivePath);
        deletedArchives += 1;
        processedArchives += 1;
      } catch (error) {
        const reason = (error as Error).message;
        failures.push({ archivePath, reason });
        sendArchiveProgress(event.sender, {
          phase: 'error',
          archiveIndex,
          totalArchives: archiveFiles.length,
          archivePath,
          message: `解压失败: ${path.basename(archivePath)} - ${reason}`,
        });
      } finally {
        await fs.promises.rm(tempDir, { recursive: true, force: true });
      }
    }

    const success = failures.length === 0;
    const message = success
      ? `解压完成，共处理 ${processedArchives} 个压缩包，提取 ${extractedFiles} 个文件。`
      : `解压完成。成功 ${processedArchives} 个，失败 ${failures.length} 个，提取 ${extractedFiles} 个文件。`;

    sendArchiveProgress(event.sender, {
      phase: 'done',
      archiveIndex: archiveFiles.length,
      totalArchives: archiveFiles.length,
      archivePercent: 100,
      message,
    });

    return {
      success,
      message,
      processedArchives,
      deletedArchives,
      totalArchives: archiveFiles.length,
      extractedFiles,
      failures,
    };
  } catch (error) {
    const message = (error as Error).message;
    sendArchiveProgress(event.sender, {
      phase: 'error',
      archiveIndex: 0,
      totalArchives: 0,
      message,
    });

    return {
      success: false,
      message,
      processedArchives: 0,
      deletedArchives: 0,
      totalArchives: 0,
      extractedFiles: 0,
      failures: [],
    };
  }
});
