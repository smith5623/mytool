declare global {
  interface Window {
    electronAPI: {
      openDirectory: () => Promise<string | null>;
      renameFiles: (folderPath: string, searchString: string, replaceString: string) => Promise<{ success: boolean; message: string }>;
      generateFileList: (folderPath: string) => Promise<{ success: boolean; markdown: string; message?: string }>;
    };
  }
}

document.addEventListener('DOMContentLoaded', () => {
  // 文件/文件夹字符串替换工具的UI元素
  const folderPathInput = document.getElementById('folderPath') as HTMLInputElement;
  const selectFolderBtn = document.getElementById('selectFolderBtn') as HTMLButtonElement;
  const searchStringInput = document.getElementById('searchString') as HTMLInputElement;
  const replaceStringInput = document.getElementById('replaceString') as HTMLInputElement;
  const startRenameBtn = document.getElementById('startRenameBtn') as HTMLButtonElement;
  const stringReplacerStatusDiv = document.querySelector('#string-replacer-tool .status-message') as HTMLDivElement;

  // 代码辅助工具的UI元素
  const codeAssistantFolderPathInput = document.getElementById('codeAssistantFolderPath') as HTMLInputElement;
  const selectCodeAssistantFolderBtn = document.getElementById('selectCodeAssistantFolderBtn') as HTMLButtonElement;
  const generateFileListBtn = document.getElementById('generateFileListBtn') as HTMLButtonElement;
  const codeAssistantStatusDiv = document.getElementById('codeAssistantStatus') as HTMLDivElement;
  const fileListOutputPre = document.getElementById('fileListOutput') as HTMLPreElement;

  // 导航逻辑
  const navItems = document.querySelectorAll('#sidebar ul li a');
  const toolSections = document.querySelectorAll<HTMLElement>('.tool-section');

  function showToolSection(sectionId: string) {
    toolSections.forEach(section => {
      section.classList.remove('active');
    });
    const activeSection = document.getElementById(sectionId);
    if (activeSection) {
      activeSection.classList.add('active');
    }
  }

  navItems.forEach(item => {
    item.addEventListener('click', (event) => {
      event.preventDefault();
      navItems.forEach(nav => nav.classList.remove('active'));
      item.classList.add('active');

      const targetId = item.id.replace('nav-', '') + '-tool'; // 根据导航项ID推断工具区ID
      showToolSection(targetId);
      // 切换工具时清除所有工具的状态和输出
      stringReplacerStatusDiv.textContent = '';
      stringReplacerStatusDiv.className = 'status-message';
      codeAssistantStatusDiv.textContent = '';
      codeAssistantStatusDiv.className = 'status-message';
      fileListOutputPre.textContent = '';
    });
  });

  // 默认显示第一个工具
  if (navItems.length > 0) {
    const firstToolId = navItems[0].id.replace('nav-', '') + '-tool';
    showToolSection(firstToolId);
  }

  // 文件/文件夹字符串替换工具的逻辑
  selectFolderBtn.addEventListener('click', async () => {
    stringReplacerStatusDiv.textContent = '正在选择文件夹...';
    stringReplacerStatusDiv.className = 'status-message';
    const folderPath = await window.electronAPI.openDirectory();
    if (folderPath) {
      folderPathInput.value = folderPath;
      stringReplacerStatusDiv.textContent = `已选择文件夹: ${folderPath}`;
      stringReplacerStatusDiv.classList.add('success');
    } else {
      stringReplacerStatusDiv.textContent = '未选择文件夹。';
      stringReplacerStatusDiv.classList.add('error');
    }
  });

  startRenameBtn.addEventListener('click', async () => {
    const folderPath = folderPathInput.value;
    const searchString = searchStringInput.value;
    const replaceString = replaceStringInput.value;

    if (!folderPath) {
      stringReplacerStatusDiv.textContent = '错误: 请先选择一个文件夹。';
      stringReplacerStatusDiv.classList.add('error');
      return;
    }
    if (!searchString) {
      stringReplacerStatusDiv.textContent = '错误: 查找字符串不能为空。';
      stringReplacerStatusDiv.classList.add('error');
      return;
    }

    stringReplacerStatusDiv.textContent = '正在开始替换...';
    stringReplacerStatusDiv.className = 'status-message'; // Clear previous status class
    startRenameBtn.disabled = true; // Disable button during operation

    try {
      const result = await window.electronAPI.renameFiles(folderPath, searchString, replaceString);
      if (result.success) {
        stringReplacerStatusDiv.textContent = `替换完成: ${result.message}`;
        stringReplacerStatusDiv.classList.add('success');
      } else {
        stringReplacerStatusDiv.textContent = `替换失败: ${result.message}`;
        stringReplacerStatusDiv.classList.add('error');
      }
    } catch (error) {
      stringReplacerStatusDiv.textContent = `发生未知错误: ${error.message}`;
      stringReplacerStatusDiv.classList.add('error');
    } finally {
      startRenameBtn.disabled = false; // Re-enable button
    }
  });

  // 代码辅助工具的逻辑
  selectCodeAssistantFolderBtn.addEventListener('click', async () => {
    codeAssistantStatusDiv.textContent = '正在选择文件夹...';
    codeAssistantStatusDiv.className = 'status-message';
    const folderPath = await window.electronAPI.openDirectory();
    if (folderPath) {
      codeAssistantFolderPathInput.value = folderPath;
      codeAssistantStatusDiv.textContent = `已选择项目文件夹: ${folderPath}`;
      codeAssistantStatusDiv.classList.add('success');
    } else {
      codeAssistantStatusDiv.textContent = '未选择项目文件夹。';
      codeAssistantStatusDiv.classList.add('error');
    }
    fileListOutputPre.textContent = ''; // Clear previous output
  });

  generateFileListBtn.addEventListener('click', async () => {
    const folderPath = codeAssistantFolderPathInput.value;

    if (!folderPath) {
      codeAssistantStatusDiv.textContent = '错误: 请先选择一个项目文件夹。';
      codeAssistantStatusDiv.classList.add('error');
      return;
    }

    codeAssistantStatusDiv.textContent = '正在生成文件列表...';
    codeAssistantStatusDiv.className = 'status-message';
    generateFileListBtn.disabled = true;

    try {
      const result = await window.electronAPI.generateFileList(folderPath);
      if (result.success) {
        codeAssistantStatusDiv.textContent = '文件列表生成成功。' + result.message ? ` (${result.message})` : '';
        codeAssistantStatusDiv.classList.add('success');
        fileListOutputPre.textContent = result.markdown;
      } else {
        codeAssistantStatusDiv.textContent = `生成失败: ${result.message}`;
        codeAssistantStatusDiv.classList.add('error');
        fileListOutputPre.textContent = '';
      }
    } catch (error) {
      codeAssistantStatusDiv.textContent = `发生未知错误: ${error.message}`;
      codeAssistantStatusDiv.classList.add('error');
      fileListOutputPre.textContent = '';
    } finally {
      generateFileListBtn.disabled = false;
    }
  });
});
