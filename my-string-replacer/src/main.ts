declare const MAIN_WINDOW_WEBPACK_ENTRY: string;
declare const MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY: string;

import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import { extractFull } from 'node-7z';
import { path7za } from '7zip-bin';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

type ProgressPayload = {
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
  totalArchives: number;
  extractedFiles: number;
  failures: Array<{ archivePath: string; reason: string }>;
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

if (require('electron-squirrel-startup')) {
  app.quit();
}

const createWindow = (): void => {
  const mainWindow = new BrowserWindow({
    height: 760,
    width: 1080,
    minHeight: 680,
    minWidth: 960,
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

const isArchiveFile = (filePath: string): boolean => {
  const lowerCasePath = filePath.toLowerCase();
  return ARCHIVE_EXTENSIONS.some((extension) => lowerCasePath.endsWith(extension));
};

const sendProgress = (sender: Electron.WebContents, payload: ProgressPayload): void => {
  sender.send('archive:progress', payload);
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
        continue;
      }

      if (entry.isFile() && isArchiveFile(fullPath)) {
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
      $bin: path7za,
      $progress: true,
      recursive: true,
      yes: true,
    });

    extractor.on('progress', (progress: { percent?: number }) => {
      onProgress(progress.percent ?? 0, '正在解压压缩包...');
    });

    extractor.on('data', (data: { file?: string; status?: string }) => {
      if (data.file) {
        const fileName = path.basename(data.file);
        onProgress(100, `已处理: ${fileName}`);
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

ipcMain.handle('dialog:openDirectory', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    properties: ['openDirectory'],
  });

  if (canceled) {
    return null;
  }

  return filePaths[0];
});

ipcMain.handle('file:rename', async (_event, folderPath: string, searchString: string, replaceString: string) => {
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

      if (baseName.includes(searchString)) {
        const newBaseName = baseName.replace(new RegExp(searchString, 'g'), replaceString);
        const newPath = path.join(parentDir, newBaseName);
        fs.renameSync(currentPath, newPath);
        return newPath;
      }

      return currentPath;
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
    return { success: true, message: 'Renaming completed successfully.' };
  } catch (error) {
    return { success: false, message: (error as Error).message };
  }
});

ipcMain.handle('file:generateFileList', async (_event, folderPath: string) => {
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
      title: 'Save project file list as Markdown',
      defaultPath: 'project_file_list.md',
      filters: [
        { name: 'Markdown Files', extensions: ['md'] },
        { name: 'All Files', extensions: ['*'] },
      ],
    });

    if (canceled) {
      return { success: false, message: 'Save canceled by user.' };
    }

    if (!filePath) {
      return { success: false, message: 'Invalid save path.' };
    }

    fs.writeFileSync(filePath, markdownOutput.join('\n'), 'utf-8');
    return { success: true, message: `File list saved to: ${filePath}` };
  } catch (error) {
    return { success: false, message: (error as Error).message };
  }
});

ipcMain.handle('archive:extractAll', async (event, folderPath: string): Promise<BatchExtractResult> => {
  if (!folderPath) {
    return {
      success: false,
      message: 'Please choose a folder first.',
      processedArchives: 0,
      totalArchives: 0,
      extractedFiles: 0,
      failures: [],
    };
  }

  try {
    sendProgress(event.sender, {
      phase: 'scanning',
      archiveIndex: 0,
      totalArchives: 0,
      message: '正在扫描压缩文件...',
    });

    const archiveFiles = await collectArchiveFiles(folderPath);

    if (archiveFiles.length === 0) {
      sendProgress(event.sender, {
        phase: 'done',
        archiveIndex: 0,
        totalArchives: 0,
        message: '没有找到可解压的压缩文件。',
      });

      return {
        success: true,
        message: 'No archive files were found.',
        processedArchives: 0,
        totalArchives: 0,
        extractedFiles: 0,
        failures: [],
      };
    }

    let processedArchives = 0;
    let extractedFiles = 0;
    const failures: Array<{ archivePath: string; reason: string }> = [];

    for (const [index, archivePath] of archiveFiles.entries()) {
      const archiveIndex = index + 1;
      const archiveDir = path.dirname(archivePath);
      const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'my-electron-tools-extract-'));

      try {
        sendProgress(event.sender, {
          phase: 'extracting',
          archiveIndex,
          totalArchives: archiveFiles.length,
          archivePath,
          archivePercent: 0,
          message: `正在解压 (${archiveIndex}/${archiveFiles.length}): ${path.basename(archivePath)}`,
        });

        await extractArchive(archivePath, tempDir, (archivePercent, message) => {
          sendProgress(event.sender, {
            phase: 'extracting',
            archiveIndex,
            totalArchives: archiveFiles.length,
            archivePath,
            archivePercent,
            message,
          });
        });

        sendProgress(event.sender, {
          phase: 'flattening',
          archiveIndex,
          totalArchives: archiveFiles.length,
          archivePath,
          archivePercent: 100,
          message: '正在提取文件到当前目录...',
        });

        const movedFiles = await flattenExtractedFiles(tempDir, archiveDir, (currentMovedFiles, totalMovedFiles, fileName) => {
          sendProgress(event.sender, {
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
        processedArchives += 1;
      } catch (error) {
        const reason = (error as Error).message;
        failures.push({ archivePath, reason });
        sendProgress(event.sender, {
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
      : `解压完成，但有 ${failures.length} 个压缩包失败。成功处理 ${processedArchives} 个，提取 ${extractedFiles} 个文件。`;

    sendProgress(event.sender, {
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
      totalArchives: archiveFiles.length,
      extractedFiles,
      failures,
    };
  } catch (error) {
    const message = (error as Error).message;
    sendProgress(event.sender, {
      phase: 'error',
      archiveIndex: 0,
      totalArchives: 0,
      message,
    });

    return {
      success: false,
      message,
      processedArchives: 0,
      totalArchives: 0,
      extractedFiles: 0,
      failures: [],
    };
  }
});
