import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';

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
  totalArchives: number;
  extractedFiles: number;
  failures: Array<{ archivePath: string; reason: string }>;
};

contextBridge.exposeInMainWorld('electronAPI', {
  openDirectory: () => ipcRenderer.invoke('dialog:openDirectory') as Promise<string | null>,
  renameFiles: (folderPath: string, searchString: string, replaceString: string) =>
    ipcRenderer.invoke('file:rename', folderPath, searchString, replaceString) as Promise<{ success: boolean; message: string }>,
  generateFileList: (folderPath: string) =>
    ipcRenderer.invoke('file:generateFileList', folderPath) as Promise<{ success: boolean; message: string }>,
  extractArchives: (folderPath: string) =>
    ipcRenderer.invoke('archive:extractAll', folderPath) as Promise<BatchExtractResult>,
  onArchiveProgress: (listener: (payload: ArchiveProgressPayload) => void) => {
    const subscription = (_event: IpcRendererEvent, payload: ArchiveProgressPayload): void => listener(payload);
    ipcRenderer.on('archive:progress', subscription);
    return () => ipcRenderer.removeListener('archive:progress', subscription);
  },
});
