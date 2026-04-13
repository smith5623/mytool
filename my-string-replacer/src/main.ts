declare const MAIN_WINDOW_WEBPACK_ENTRY: string;
declare const MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY: string;
import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import * as path from 'path';
import * as fs from 'fs';

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
  app.quit();
}

const createWindow = (): void => {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    height: 600,
    width: 800,
    webPreferences: {
      preload: MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY,
      nodeIntegration: false, // Keep nodeIntegration false for security
      contextIsolation: true, // Keep contextIsolation true for security
    },
  });

  // and load the index.html of the app.
  mainWindow.loadURL(MAIN_WINDOW_WEBPACK_ENTRY);

  // Open the DevTools.
  mainWindow.webContents.openDevTools();
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow);

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// IPC handler for selecting a folder
ipcMain.handle('dialog:openDirectory', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    properties: ['openDirectory'],
  });
  if (canceled) {
    return null;
  } else {
    return filePaths[0];
  }
});

// IPC handler for renaming files/folders
ipcMain.handle('file:rename', async (event, folderPath: string, searchString: string, replaceString: string) => {
  try {
    if (!folderPath) {
      throw new Error('Folder path is not provided.');
    }
    if (!searchString) {
      throw new Error('Search string is not provided.');
    }

    const renameItem = (currentPath: string) => {
      const parentDir = path.dirname(currentPath);
      const baseName = path.basename(currentPath);

      if (baseName.includes(searchString)) {
        const newBaseName = baseName.replace(new RegExp(searchString, 'g'), replaceString);
        const newPath = path.join(parentDir, newBaseName);
        fs.renameSync(currentPath, newPath);
        return newPath; // Return new path if renamed
      }
      return currentPath; // Return original path if not renamed
    };

    const traverseDirectory = (currentDirPath: string) => {
      let renamedCurrentDirPath = renameItem(currentDirPath); // Rename current directory if needed
      const files = fs.readdirSync(renamedCurrentDirPath);

      for (const file of files) {
        const filePath = path.join(renamedCurrentDirPath, file);
        const stat = fs.statSync(filePath);

        if (stat.isDirectory()) {
          traverseDirectory(filePath); // Recurse into subdirectories
        } else {
          renameItem(filePath); // Rename files
        }
      }
    };

    traverseDirectory(folderPath);
    return { success: true, message: 'Renaming completed successfully.' };
  } catch (error) {
    return { success: false, message: error.message };
  }
});

// IPC handler for generating file list (now also saves it)
ipcMain.handle('file:generateFileList', async (event, folderPath: string) => {
  try {
    if (!folderPath) {
      throw new Error('Folder path is not provided.');
    }

    const markdownOutput: string[] = [];
    // Common Git-related files/folders to exclude
    const gitIgnorePatterns = ['.git', '.gitignore', '.gitmodules', '.gitattributes', '.gitkeep', 'node_modules', 'dist'];

    const isTextFile = (filePath: string): boolean => {
      const textExtensions = ['.txt', '.md', '.js', '.ts', '.jsx', '.tsx', '.json', '.css', '.html', '.vue', '.py', '.java', '.c', '.cpp', '.h', '.hpp', '.go', '.rs', '.xml', '.yml', '.yaml', '.toml'];
      const ext = path.extname(filePath).toLowerCase();
      return textExtensions.includes(ext) || ext === ''; // Assume no extension implies text
    };

    const traverseAndCollectFiles = (currentPath: string, level: number = 0) => {
      const filesAndDirs = fs.readdirSync(currentPath, { withFileTypes: true });

      for (const item of filesAndDirs) {
        const itemName = item.name;
        const itemPath = path.join(currentPath, itemName);

        // Exclude common ignored folders/files
        if (gitIgnorePatterns.includes(itemName) || itemName.startsWith('.')) {
          continue;
        }

        if (item.isDirectory()) {
          markdownOutput.push(`${'#'.repeat(level + 2)} 文件夹: ${itemName} [${itemPath}]`);
          traverseAndCollectFiles(itemPath, level + 1);
        } else if (item.isFile()) {
          markdownOutput.push(`${'#'.repeat(level + 2)} 文件: ${itemName}`);
          markdownOutput.push(`- **绝对路径**: ${itemPath}`);
          markdownOutput.push(`- **文件名**: ${itemName}`);
          markdownOutput.push(`- **文件内容**:\n\`\`\`\n`); // Corrected backticks
          try {
            const stats = fs.statSync(itemPath);
            if (stats.size > 1024 * 1024) { // Limit to 1MB
              markdownOutput.push(`[文件过大，内容已省略 (大小: ${(stats.size / (1024 * 1024)).toFixed(2)} MB)]`);
            } else if (!isTextFile(itemPath)) {
              markdownOutput.push(`[二进制文件，内容已省略]`);
            } else {
              const content = fs.readFileSync(itemPath, 'utf-8');
              markdownOutput.push(content);
            }
          } catch (readError) {
            markdownOutput.push(`[无法读取文件内容: ${readError.message}]`);
          }
          markdownOutput.push(`\n\`\`\`\n`); // Corrected backticks
        }
      }
    };

    markdownOutput.push(`# 项目文件列表: ${folderPath}\n`);
    traverseAndCollectFiles(folderPath);

    const { canceled, filePath } = await dialog.showSaveDialog({
      title: '保存项目文件列表为 Markdown',
      defaultPath: 'project_file_list.md',
      filters: [
        { name: 'Markdown Files', extensions: ['md'] },
        { name: 'All Files', extensions: ['*'] },
      ],
    });

    if (canceled) {
      return { success: false, message: '用户取消保存。' };
    } else if (filePath) {
      fs.writeFileSync(filePath, markdownOutput.join('\n'), 'utf-8');
      return { success: true, message: `文件已成功保存到: ${filePath}` };
    }
    return { success: false, message: '保存路径无效。' };
  } catch (error) {
    return { success: false, message: error.message };
  }
});