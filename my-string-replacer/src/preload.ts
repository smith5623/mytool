// See the Electron documentation for details on how to use preload scripts:
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  openDirectory: () => ipcRenderer.invoke('dialog:openDirectory'),
  renameFiles: (folderPath: string, searchString: string, replaceString: string) =>
    ipcRenderer.invoke('file:rename', folderPath, searchString, replaceString),
  generateFileList: (folderPath: string) =>
    ipcRenderer.invoke('file:generateFileList', folderPath),
  saveMarkdown: (markdownContent: string) =>
    ipcRenderer.invoke('file:saveMarkdown', markdownContent),
});
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts
