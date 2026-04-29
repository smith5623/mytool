import { spawn } from 'child_process';
import * as os from 'os';

export type LocalSystemSection = {
  key: string;
  title: string;
  command: string;
  output: string;
};

export type LocalSystemInsight = {
  level: 'info' | 'warning' | 'error';
  title: string;
  detail: string;
};

export type LocalSystemScoreBreakdown = {
  label: string;
  score: number;
  maxScore: number;
  detail: string;
};

export type LocalSystemInspectResult = {
  success: boolean;
  message: string;
  inspectedAt: string;
  platform: NodeJS.Platform;
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

type CommandResult = {
  command: string;
  stdout: string;
};

type LocalSystemExportFormat = 'txt' | 'json';

type MemoryModule = {
  label?: string;
  manufacturer?: string;
  partNumber?: string;
  capacityBytes?: number;
  speedMHz?: number;
};

type DiskItem = {
  name: string;
  sizeBytes?: number;
  freeBytes?: number;
  usedBytes?: number;
  fileSystem?: string;
  model?: string;
  mediaType?: string;
  status?: string;
  isSystem?: boolean;
};

type BatteryInfo = {
  status: string;
  chargePercent?: number;
  healthPercent?: number;
  cycleCount?: number;
  condition?: string;
};

type JsonRecord = Record<string, unknown>;

const formatBytes = (value: number): string => {
  if (!Number.isFinite(value) || value <= 0) {
    return '0 B';
  }

  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = value;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  const digits = size >= 100 || unitIndex === 0 ? 0 : size >= 10 ? 1 : 2;
  return `${size.toFixed(digits)} ${units[unitIndex]}`;
};

const formatPercent = (value?: number): string => (value === undefined || !Number.isFinite(value) ? '-' : `${value.toFixed(value >= 10 ? 0 : 1)}%`);

const formatSeconds = (value: number): string => {
  const totalSeconds = Math.max(0, Math.floor(value));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const parts: string[] = [];
  if (days > 0) {
    parts.push(`${days}d`);
  }
  if (hours > 0 || parts.length > 0) {
    parts.push(`${hours}h`);
  }
  parts.push(`${minutes}m`);
  return parts.join(' ');
};

const normalizeOutput = (value: string): string => {
  const normalized = value.replace(/\r/g, '').trim();
  return normalized || '(no output)';
};

const normalizeArray = <T>(value: T | T[] | null | undefined): T[] => {
  if (Array.isArray(value)) {
    return value;
  }

  if (value === null || value === undefined) {
    return [];
  }

  return [value];
};

const toNumber = (value: unknown): number | undefined => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
};

const batteryStatusFromCode = (code?: number): string => {
  switch (code) {
    case 1:
      return '放电中';
    case 2:
      return '已接通电源';
    case 3:
      return '已充满';
    case 4:
      return '电量低';
    case 5:
      return '电量严重不足';
    case 6:
      return '充电中';
    case 7:
      return '高电量充电中';
    case 8:
      return '低电量充电中';
    case 9:
      return '紧急充电中';
    case 11:
      return '部分充满';
    default:
      return '未知';
  }
};

const scoreLabel = (value: number): string => {
  if (value >= 90) {
    return '优秀';
  }
  if (value >= 75) {
    return '良好';
  }
  if (value >= 55) {
    return '一般';
  }
  return '需要关注';
};

const runCommand = (file: string, args: string[], timeoutMs = 20000): Promise<CommandResult> =>
  new Promise((resolve, reject) => {
    const child = spawn(file, args, {
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(`Command timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString('utf-8');
    });

    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf-8');
    });

    child.once('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });

    child.once('close', (code) => {
      clearTimeout(timer);
      if (code !== 0 && !stdout.trim()) {
        reject(new Error(normalizeOutput(stderr) || `Command exited with code ${code}`));
        return;
      }

      resolve({
        command: [file, ...args].join(' '),
        stdout: normalizeOutput(stdout || stderr),
      });
    });
  });

const buildBaseSummary = (): LocalSystemInspectResult['summary'] => {
  const totalMemoryBytes = os.totalmem();
  return {
    hostname: os.hostname(),
    os: os.type(),
    version: os.release(),
    arch: os.arch(),
    uptime: formatSeconds(os.uptime()),
    cpuModel: os.cpus()[0]?.model || '未知处理器',
    cpuCores: os.cpus().length,
    totalMemory: formatBytes(totalMemoryBytes),
    totalMemoryBytes,
  };
};

const computeScore = (
  totalMemoryBytes: number,
  cpuThreads: number,
  systemDiskFreePercent: number | undefined,
  graphicsCount: number,
  insightCount: number,
): LocalSystemInspectResult['score'] => {
  const totalMemoryGb = totalMemoryBytes / 1024 ** 3;

  const memoryScore = totalMemoryGb >= 32 ? 30 : totalMemoryGb >= 16 ? 24 : totalMemoryGb >= 8 ? 16 : totalMemoryGb >= 4 ? 8 : 3;
  const cpuScore = cpuThreads >= 16 ? 25 : cpuThreads >= 12 ? 22 : cpuThreads >= 8 ? 18 : cpuThreads >= 4 ? 10 : 5;
  const diskScore = systemDiskFreePercent === undefined
    ? 10
    : systemDiskFreePercent >= 35
      ? 25
      : systemDiskFreePercent >= 20
        ? 18
        : systemDiskFreePercent >= 10
          ? 10
          : 4;
  const graphicsScore = graphicsCount >= 2 ? 10 : graphicsCount >= 1 ? 8 : 3;
  const stabilityScore = Math.max(0, 10 - insightCount * 2);

  const breakdown: LocalSystemScoreBreakdown[] = [
    { label: '内存', score: memoryScore, maxScore: 30, detail: `检测到 ${totalMemoryGb.toFixed(1)} GB 内存` },
    { label: '处理器', score: cpuScore, maxScore: 25, detail: `检测到 ${cpuThreads} 个逻辑线程` },
    { label: '系统盘', score: diskScore, maxScore: 25, detail: `剩余空间 ${formatPercent(systemDiskFreePercent)}` },
    { label: '显卡', score: graphicsScore, maxScore: 10, detail: `检测到 ${graphicsCount} 个图形适配器` },
    { label: '稳定性', score: stabilityScore, maxScore: 10, detail: `有 ${insightCount} 项值得关注` },
  ];

  const overall = breakdown.reduce((sum, item) => sum + item.score, 0);
  return {
    overall,
    label: scoreLabel(overall),
    breakdown,
  };
};

const buildInsights = (
  totalMemoryBytes: number,
  memoryModules: MemoryModule[],
  disks: DiskItem[],
  graphicsCount: number,
  battery: BatteryInfo | undefined,
): LocalSystemInsight[] => {
  const insights: LocalSystemInsight[] = [];
  const totalMemoryGb = totalMemoryBytes / 1024 ** 3;
  const systemDisk = disks.find((item) => item.isSystem) || disks[0];

  if (totalMemoryGb < 8) {
    insights.push({
      level: 'error',
      title: '内存偏低',
      detail: `当前仅检测到 ${totalMemoryGb.toFixed(1)} GB 内存，建议至少 8 GB 以获得更顺畅的日常体验。`,
    });
  } else if (totalMemoryGb < 16) {
    insights.push({
      level: 'warning',
      title: '内存余量有限',
      detail: `当前 ${totalMemoryGb.toFixed(1)} GB 内存可以使用，但如果经常多开应用，16 GB 及以上会更从容。`,
    });
  }

  const speedSet = Array.from(new Set(memoryModules.map((item) => item.speedMHz).filter((value): value is number => Boolean(value))));
  if (speedSet.length > 1) {
    insights.push({
      level: 'warning',
      title: '内存频率不一致',
      detail: `检测到不同内存条的标称频率不一致：${speedSet.join('、')} MHz。`,
    });
  }

  if (systemDisk?.freeBytes !== undefined && systemDisk.sizeBytes) {
    const freePercent = (systemDisk.freeBytes / systemDisk.sizeBytes) * 100;
    if (freePercent < 10) {
      insights.push({
        level: 'error',
        title: '系统盘空间严重不足',
        detail: `${systemDisk.name} 仅剩 ${formatBytes(systemDisk.freeBytes)} 可用空间（${formatPercent(freePercent)}），建议尽快清理。`,
      });
    } else if (freePercent < 20) {
      insights.push({
        level: 'warning',
        title: '系统盘空间偏紧',
        detail: `${systemDisk.name} 当前剩余 ${formatBytes(systemDisk.freeBytes)}（${formatPercent(freePercent)}）。`,
      });
    }
  }

  const unhealthyDisks = disks.filter((item) => item.status && item.status.toLowerCase() !== 'ok');
  unhealthyDisks.forEach((disk) => {
    insights.push({
      level: 'warning',
      title: `硬盘状态提醒：${disk.name}`,
      detail: `系统返回的磁盘状态为“${disk.status}”，建议进一步检查 SMART 或硬盘健康信息。`,
    });
  });

  if (graphicsCount === 0) {
    insights.push({
      level: 'warning',
      title: '未获取到显卡详情',
      detail: '系统没有返回图形适配器信息，可能与驱动、权限或系统接口限制有关。',
    });
  }

  if (battery) {
    if (battery.healthPercent !== undefined && battery.healthPercent < 80) {
      insights.push({
        level: 'warning',
        title: '电池健康度下降',
        detail: `当前估算电池健康度为 ${formatPercent(battery.healthPercent)}。`,
      });
    }

    if (battery.chargePercent !== undefined && battery.chargePercent < 20 && battery.status.toLowerCase().includes('discharging')) {
      insights.push({
        level: 'info',
        title: '电池电量较低',
        detail: `当前电池电量为 ${battery.chargePercent}%。`,
      });
    }
  }

  if (insights.length === 0) {
    insights.push({
      level: 'info',
      title: '暂未发现明显问题',
      detail: '基于当前快速检测结果，本机硬件状态看起来比较正常。',
    });
  }

  return insights;
};

const buildTextSection = (title: string, value: string): string => `## ${title}\n${value || '(no output)'}`;

export const formatLocalSystemReport = (result: LocalSystemInspectResult, format: LocalSystemExportFormat): string => {
  if (format === 'json') {
    return JSON.stringify(result, null, 2);
  }

  const summaryLines = [
    `平台：${result.platform}`,
    `主机名：${result.summary.hostname}`,
    `OS: ${result.summary.os}`,
    `版本：${result.summary.version}`,
    `架构：${result.summary.arch}`,
    `处理器：${result.summary.cpuModel}`,
    `线程数：${result.summary.cpuCores}`,
    `内存：${result.summary.totalMemory}`,
    `系统盘：${result.summary.systemDisk || '-'}`,
    `系统盘剩余：${result.summary.systemDiskFree || '-'}${result.summary.systemDiskFreePercent !== undefined ? `（${formatPercent(result.summary.systemDiskFreePercent)}）` : ''}`,
    `显卡数量：${result.summary.graphicsCount ?? '-'}`,
    `网卡数量：${result.summary.networkCount ?? '-'}`,
    `显示器数量：${result.summary.displayCount ?? '-'}`,
    `主板：${result.summary.motherboard || '-'}`,
    `BIOS/固件：${result.summary.biosVersion || '-'}`,
    `电池：${result.summary.batteryStatus || '-'}`,
    `运行时长：${result.summary.uptime}`,
  ];

  const scoreLines = [
    `综合评分：${result.score.overall}/100（${result.score.label}）`,
    ...result.score.breakdown.map((item) => `- ${item.label}：${item.score}/${item.maxScore} | ${item.detail}`),
  ];

  const insightLines = result.insights.map((item) => `- [${item.level === 'error' ? '高风险' : item.level === 'warning' ? '提醒' : '信息'}] ${item.title}：${item.detail}`);
  const sectionLines = result.sections.map((item) => buildTextSection(item.title, item.output));

  return [
    '# 本机硬件检测报告',
    `生成时间：${result.inspectedAt}`,
    '',
    buildTextSection('评分', scoreLines.join('\n')),
    '',
    buildTextSection('建议与提示', insightLines.join('\n')),
    '',
    buildTextSection('摘要', summaryLines.join('\n')),
    '',
    ...sectionLines,
  ].join('\n');
};

const inspectWindows = async (): Promise<LocalSystemInspectResult> => {
  const inspectedAt = new Date().toISOString();
  const query = `
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
$OutputEncoding = [Console]::OutputEncoding
$cpu = Get-CimInstance Win32_Processor | Select-Object Name, NumberOfCores, NumberOfLogicalProcessors, MaxClockSpeed, Manufacturer
$memory = Get-CimInstance Win32_PhysicalMemory | Select-Object Manufacturer, Capacity, Speed, PartNumber, BankLabel
$logicalDisks = Get-CimInstance Win32_LogicalDisk | Select-Object DeviceID, VolumeName, Size, FreeSpace, DriveType, FileSystem
$diskDrives = Get-CimInstance Win32_DiskDrive | Select-Object Model, SerialNumber, Status, Size, MediaType, InterfaceType
$gpu = Get-CimInstance Win32_VideoController | Select-Object Name, AdapterRAM, DriverVersion, VideoProcessor, CurrentHorizontalResolution, CurrentVerticalResolution
$osInfo = Get-CimInstance Win32_OperatingSystem | Select-Object Caption, Version, BuildNumber, LastBootUpTime, SystemDrive
$computer = Get-CimInstance Win32_ComputerSystem | Select-Object Manufacturer, Model, TotalPhysicalMemory
$baseBoard = Get-CimInstance Win32_BaseBoard | Select-Object Manufacturer, Product, SerialNumber
$bios = Get-CimInstance Win32_BIOS | Select-Object SMBIOSBIOSVersion, ReleaseDate, Manufacturer
$network = Get-CimInstance Win32_NetworkAdapterConfiguration | Where-Object { $_.IPEnabled } | Select-Object Description, MACAddress, IPAddress, DefaultIPGateway, DHCPEnabled
$monitors = Get-CimInstance Win32_DesktopMonitor | Select-Object Name, ScreenWidth, ScreenHeight, MonitorType
$battery = Get-CimInstance Win32_Battery | Select-Object Name, EstimatedChargeRemaining, BatteryStatus
[PSCustomObject]@{
  cpu = $cpu
  memory = $memory
  logicalDisks = $logicalDisks
  diskDrives = $diskDrives
  gpu = $gpu
  osInfo = $osInfo
  computer = $computer
  baseBoard = $baseBoard
  bios = $bios
  network = $network
  monitors = $monitors
  battery = $battery
} | ConvertTo-Json -Depth 7
  `.trim();

  const commandResult = await runCommand('powershell.exe', ['-NoProfile', '-Command', query], 30000);
  const parsed = JSON.parse(commandResult.stdout) as JsonRecord;

  const cpus = normalizeArray<JsonRecord>(parsed.cpu as JsonRecord | JsonRecord[] | undefined);
  const rawMemory = normalizeArray<JsonRecord>(parsed.memory as JsonRecord | JsonRecord[] | undefined);
  const logicalDisks = normalizeArray<JsonRecord>(parsed.logicalDisks as JsonRecord | JsonRecord[] | undefined);
  const diskDrives = normalizeArray<JsonRecord>(parsed.diskDrives as JsonRecord | JsonRecord[] | undefined);
  const gpus = normalizeArray<JsonRecord>(parsed.gpu as JsonRecord | JsonRecord[] | undefined);
  const networks = normalizeArray<JsonRecord>(parsed.network as JsonRecord | JsonRecord[] | undefined);
  const monitors = normalizeArray<JsonRecord>(parsed.monitors as JsonRecord | JsonRecord[] | undefined);
  const batteryRaw = normalizeArray<JsonRecord>(parsed.battery as JsonRecord | JsonRecord[] | undefined)[0];
  const osInfo = (parsed.osInfo || {}) as JsonRecord;
  const computer = (parsed.computer || {}) as JsonRecord;
  const baseBoard = normalizeArray<JsonRecord>(parsed.baseBoard as JsonRecord | JsonRecord[] | undefined)[0] || {};
  const bios = normalizeArray<JsonRecord>(parsed.bios as JsonRecord | JsonRecord[] | undefined)[0] || {};

  const memoryModules: MemoryModule[] = rawMemory.map((item) => ({
    label: String(item.BankLabel || 'Memory Module'),
    manufacturer: item.Manufacturer ? String(item.Manufacturer).trim() : undefined,
    partNumber: item.PartNumber ? String(item.PartNumber).trim() : undefined,
    capacityBytes: toNumber(item.Capacity),
    speedMHz: toNumber(item.Speed),
  }));

  const systemDrive = String(osInfo.SystemDrive || 'C:');
  const disks: DiskItem[] = logicalDisks
    .filter((item) => Number(item.DriveType) === 3)
    .map((item) => {
      const sizeBytes = toNumber(item.Size);
      const freeBytes = toNumber(item.FreeSpace);
      return {
        name: `${String(item.DeviceID || '(unknown drive)')}${item.VolumeName ? ` (${String(item.VolumeName)})` : ''}`,
        sizeBytes,
        freeBytes,
        usedBytes: sizeBytes !== undefined && freeBytes !== undefined ? Math.max(sizeBytes - freeBytes, 0) : undefined,
        fileSystem: item.FileSystem ? String(item.FileSystem) : undefined,
        isSystem: String(item.DeviceID || '').toUpperCase() === systemDrive.toUpperCase(),
      };
    });

  const systemDisk = disks.find((item) => item.isSystem) || disks[0];
  const systemDiskFreePercent = systemDisk?.sizeBytes && systemDisk.freeBytes !== undefined
    ? (systemDisk.freeBytes / systemDisk.sizeBytes) * 100
    : undefined;

  const battery: BatteryInfo | undefined = batteryRaw
    ? {
        status: batteryStatusFromCode(toNumber(batteryRaw.BatteryStatus)),
        chargePercent: toNumber(batteryRaw.EstimatedChargeRemaining),
      }
    : undefined;

  const summary = buildBaseSummary();
  summary.os = String(osInfo.Caption || 'Windows');
  summary.version = osInfo.Version
    ? `${String(osInfo.Version)}${osInfo.BuildNumber ? ` (Build ${String(osInfo.BuildNumber)})` : ''}`
    : summary.version;
  summary.cpuModel = cpus[0]?.Name ? String(cpus[0].Name) : summary.cpuModel;
  summary.cpuCores = toNumber(cpus[0]?.NumberOfLogicalProcessors) || toNumber(cpus[0]?.NumberOfCores) || summary.cpuCores;
  summary.totalMemoryBytes = toNumber(computer.TotalPhysicalMemory) || summary.totalMemoryBytes;
  summary.totalMemory = formatBytes(summary.totalMemoryBytes);
  summary.graphicsCount = gpus.length;
  summary.diskCount = disks.length;
  summary.networkCount = networks.length;
  summary.displayCount = monitors.length;
  summary.motherboard = [baseBoard.Manufacturer, baseBoard.Product].filter(Boolean).join(' ');
  summary.biosVersion = [bios.Manufacturer, bios.SMBIOSBIOSVersion].filter(Boolean).join(' ');
  summary.systemDisk = systemDisk?.name;
  summary.systemDiskFree = systemDisk?.freeBytes !== undefined ? formatBytes(systemDisk.freeBytes) : undefined;
  summary.systemDiskFreePercent = systemDiskFreePercent;
  summary.batteryStatus = battery ? `${battery.status}${battery.chargePercent !== undefined ? `（${battery.chargePercent}%）` : ''}` : '未检测到电池';

  const insights = buildInsights(summary.totalMemoryBytes, memoryModules, disks, summary.graphicsCount || 0, battery);
  const score = computeScore(summary.totalMemoryBytes, summary.cpuCores, summary.systemDiskFreePercent, summary.graphicsCount || 0, insights.filter((item) => item.level !== 'info').length);

  const cpuSection = cpus
    .map((cpu, index) =>
      [
        `${index + 1}. ${String(cpu.Name || '未知处理器')}`,
        cpu.Manufacturer ? `  厂商：${String(cpu.Manufacturer)}` : '',
        cpu.NumberOfCores ? `  核心数：${cpu.NumberOfCores}` : '',
        cpu.NumberOfLogicalProcessors ? `  线程数：${cpu.NumberOfLogicalProcessors}` : '',
        cpu.MaxClockSpeed ? `  最高主频：${cpu.MaxClockSpeed} MHz` : '',
      ]
        .filter(Boolean)
        .join('\n'),
    )
    .join('\n\n') || '(no cpu info)';

  const memorySection = [
    `总容量：${summary.totalMemory}`,
    `内存条数量：${memoryModules.length}`,
    '',
    memoryModules
      .map((memory, index) =>
        [
          `${index + 1}. ${memory.label || '内存条'}`,
          memory.manufacturer ? `  厂商：${memory.manufacturer}` : '',
          memory.partNumber ? `  型号：${memory.partNumber}` : '',
          memory.capacityBytes ? `  容量：${formatBytes(memory.capacityBytes)}` : '',
          memory.speedMHz ? `  频率：${memory.speedMHz} MHz` : '',
        ]
          .filter(Boolean)
          .join('\n'),
      )
      .join('\n\n'),
  ]
    .filter(Boolean)
    .join('\n');

  const diskDriveMap = diskDrives.map((item) =>
    [
      `${String(item.Model || '磁盘设备')}`,
      item.Size ? `  容量：${formatBytes(Number(item.Size))}` : '',
      item.InterfaceType ? `  接口：${String(item.InterfaceType)}` : '',
      item.MediaType ? `  介质类型：${String(item.MediaType)}` : '',
      item.Status ? `  状态：${String(item.Status)}` : '',
    ]
      .filter(Boolean)
      .join('\n'),
  ).join('\n\n');

  const logicalDiskText = disks
    .map((disk) =>
      [
        `${disk.name}${disk.isSystem ? ' [系统盘]' : ''}`,
        disk.sizeBytes ? `  容量：${formatBytes(disk.sizeBytes)}` : '',
        disk.usedBytes !== undefined ? `  已用：${formatBytes(disk.usedBytes)}` : '',
        disk.freeBytes !== undefined ? `  可用：${formatBytes(disk.freeBytes)}` : '',
        disk.fileSystem ? `  文件系统：${disk.fileSystem}` : '',
      ]
        .filter(Boolean)
        .join('\n'),
    )
    .join('\n\n');

  const gpuSection = gpus.map((gpu, index) =>
    [
      `${index + 1}. ${String(gpu.Name || '未知显卡')}`,
      gpu.VideoProcessor ? `  芯片：${String(gpu.VideoProcessor)}` : '',
      gpu.AdapterRAM ? `  显存：${formatBytes(Number(gpu.AdapterRAM))}` : '',
      gpu.DriverVersion ? `  驱动版本：${String(gpu.DriverVersion)}` : '',
      gpu.CurrentHorizontalResolution && gpu.CurrentVerticalResolution
        ? `  分辨率：${gpu.CurrentHorizontalResolution} x ${gpu.CurrentVerticalResolution}`
        : '',
    ]
      .filter(Boolean)
      .join('\n'),
  ).join('\n\n') || '(no graphics adapters found)';

  const networkSection = networks.map((network, index) =>
    [
      `${index + 1}. ${String(network.Description || '网卡')}`,
      network.MACAddress ? `  MAC：${String(network.MACAddress)}` : '',
      Array.isArray(network.IPAddress) ? `  IP：${(network.IPAddress as string[]).join('，')}` : '',
      Array.isArray(network.DefaultIPGateway) ? `  网关：${(network.DefaultIPGateway as string[]).join('，')}` : '',
      network.DHCPEnabled !== undefined ? `  DHCP：${Boolean(network.DHCPEnabled) ? '已启用' : '已关闭'}` : '',
    ]
      .filter(Boolean)
      .join('\n'),
  ).join('\n\n') || '(no active network adapters found)';

  const displaySection = monitors.map((monitor, index) =>
    [
      `${index + 1}. ${String(monitor.Name || '显示器')}`,
      monitor.MonitorType ? `  类型：${String(monitor.MonitorType)}` : '',
      monitor.ScreenWidth && monitor.ScreenHeight ? `  分辨率：${monitor.ScreenWidth} x ${monitor.ScreenHeight}` : '',
    ]
      .filter(Boolean)
      .join('\n'),
  ).join('\n\n') || '未获取到显示器详情';

  const batterySection = battery
    ? [
        `状态：${battery.status}`,
        battery.chargePercent !== undefined ? `电量：${battery.chargePercent}%` : '',
      ]
        .filter(Boolean)
        .join('\n')
    : '未检测到电池';

  return {
    success: true,
    message: '本机硬件检测完成。',
    inspectedAt,
    platform: process.platform,
    score,
    summary,
    insights,
    sections: [
      {
        key: 'system',
        title: '系统概览',
        command: commandResult.command,
        output: [
          `厂商：${String(computer.Manufacturer || '-')}`,
          `机型：${String(computer.Model || '-')}`,
          `系统：${summary.os}`,
          `版本：${summary.version}`,
          `主机名：${summary.hostname}`,
          `架构：${summary.arch}`,
          `运行时长：${summary.uptime}`,
        ].join('\n'),
      },
      { key: 'cpu', title: '处理器', command: 'Get-CimInstance Win32_Processor', output: cpuSection },
      { key: 'memory', title: '内存', command: 'Get-CimInstance Win32_PhysicalMemory', output: memorySection },
      { key: 'disk', title: '逻辑磁盘', command: 'Get-CimInstance Win32_LogicalDisk', output: logicalDiskText || '未获取到磁盘信息' },
      { key: 'disk-drive', title: '磁盘硬件', command: 'Get-CimInstance Win32_DiskDrive', output: diskDriveMap || '未获取到磁盘硬件信息' },
      { key: 'gpu', title: '显卡', command: 'Get-CimInstance Win32_VideoController', output: gpuSection },
      { key: 'network', title: '网络', command: 'Get-CimInstance Win32_NetworkAdapterConfiguration', output: networkSection },
      {
        key: 'firmware',
        title: '主板 / BIOS',
        command: 'Get-CimInstance Win32_BaseBoard + Win32_BIOS',
        output: [
          `主板：${summary.motherboard || '-'}`,
          `主板序列号：${String(baseBoard.SerialNumber || '-')}`,
          `BIOS：${summary.biosVersion || '-'}`,
          `BIOS 日期：${String(bios.ReleaseDate || '-')}`,
        ].join('\n'),
      },
      { key: 'display', title: '显示器', command: 'Get-CimInstance Win32_DesktopMonitor', output: displaySection },
      { key: 'battery', title: '电池', command: 'Get-CimInstance Win32_Battery', output: batterySection },
    ],
  };
};

const parseDfOutput = (output: string): { freeBytes?: number; sizeBytes?: number; usedPercent?: number } => {
  const lines = output.split('\n').map((line) => line.trim()).filter(Boolean);
  const dataLine = lines.find((line) => line.includes('/')) || '';
  const parts = dataLine.split(/\s+/);
  if (parts.length < 6) {
    return {};
  }

  const sizeKb = Number(parts[1]);
  const freeKb = Number(parts[3]);
  const usedPercent = Number(String(parts[4]).replace('%', ''));
  return {
    sizeBytes: Number.isFinite(sizeKb) ? sizeKb * 1024 : undefined,
    freeBytes: Number.isFinite(freeKb) ? freeKb * 1024 : undefined,
    usedPercent: Number.isFinite(usedPercent) ? usedPercent : undefined,
  };
};

const inspectMac = async (): Promise<LocalSystemInspectResult> => {
  const inspectedAt = new Date().toISOString();
  const profiler = await runCommand(
    'system_profiler',
    ['SPHardwareDataType', 'SPDisplaysDataType', 'SPStorageDataType', 'SPNetworkDataType', 'SPPowerDataType', '-json'],
    40000,
  );
  const diskFree = await runCommand('df', ['-k', '/']);
  const parsed = JSON.parse(profiler.stdout) as Record<string, JsonRecord[]>;

  const hardware = parsed.SPHardwareDataType?.[0] || {};
  const displayCards = (parsed.SPDisplaysDataType || []) as JsonRecord[];
  const displayEntries = displayCards.flatMap((card) => normalizeArray<JsonRecord>(card.spdisplays_ndrvs as JsonRecord | JsonRecord[] | undefined));
  const storage = (parsed.SPStorageDataType || []) as JsonRecord[];
  const networkEntries = (parsed.SPNetworkDataType || []) as JsonRecord[];
  const powerEntries = (parsed.SPPowerDataType || []) as JsonRecord[];

  const memoryMatch = String(hardware.physical_memory || '').match(/(\d+(?:\.\d+)?)\s*(GB|TB)/i);
  const totalMemoryBytes = memoryMatch
    ? Number(memoryMatch[1]) * (memoryMatch[2].toUpperCase() === 'TB' ? 1024 ** 4 : 1024 ** 3)
    : os.totalmem();
  const dfInfo = parseDfOutput(diskFree.stdout);

  const batterySource = powerEntries.find((item) => item.sppower_battery_health_info || item.sppower_battery_charge_info) || {};
  const batteryHealthInfo = (batterySource.sppower_battery_health_info || {}) as Record<string, unknown>;
  const batteryChargeInfo = (batterySource.sppower_battery_charge_info || {}) as Record<string, unknown>;
  const battery: BatteryInfo | undefined = Object.keys(batteryHealthInfo).length > 0 || Object.keys(batteryChargeInfo).length > 0
    ? {
        status: String(batteryChargeInfo.sppower_battery_state || batteryChargeInfo.charging || batteryHealthInfo.sppower_battery_health || '已检测到电池'),
        chargePercent: toNumber(batteryChargeInfo.sppower_battery_charge || batteryChargeInfo.sppower_battery_current_capacity),
        condition: batteryHealthInfo.sppower_battery_health ? String(batteryHealthInfo.sppower_battery_health) : undefined,
        cycleCount: toNumber(batteryHealthInfo.sppower_battery_cycle_count),
        healthPercent: batteryHealthInfo.sppower_battery_max_capacity && batteryHealthInfo.sppower_battery_design_capacity
          ? Math.min(
              100,
              (Number(batteryHealthInfo.sppower_battery_max_capacity) / Number(batteryHealthInfo.sppower_battery_design_capacity)) * 100,
            )
          : undefined,
      }
    : undefined;

  const disks: DiskItem[] = storage.map((item) => ({
    name: String(item._name || 'Storage Device'),
    sizeBytes: toNumber(item.size_in_bytes) || toNumber(item.size),
    freeBytes: item.mount_point === '/' ? dfInfo.freeBytes : undefined,
    usedBytes: item.mount_point === '/' && dfInfo.sizeBytes !== undefined && dfInfo.freeBytes !== undefined
      ? Math.max(dfInfo.sizeBytes - dfInfo.freeBytes, 0)
      : undefined,
    fileSystem: item.file_system ? String(item.file_system) : undefined,
    model: item.physical_drive ? String(item.physical_drive) : undefined,
    isSystem: item.mount_point === '/',
  }));

  const summary = buildBaseSummary();
  summary.os = String(hardware.os_version || 'macOS');
  summary.version = os.release();
  summary.arch = String(hardware.chip_type || hardware.machine_model || summary.arch);
  summary.cpuModel = String(hardware.chip_type || hardware.cpu_type || summary.cpuModel);
  summary.cpuCores = toNumber(hardware.number_processors) || toNumber(hardware.packages) || summary.cpuCores;
  summary.totalMemoryBytes = totalMemoryBytes;
  summary.totalMemory = formatBytes(totalMemoryBytes);
  summary.graphicsCount = displayCards.length;
  summary.diskCount = disks.length;
  summary.networkCount = networkEntries.length;
  summary.displayCount = displayEntries.length;
  summary.motherboard = String(hardware.machine_model || hardware.model_identifier || '');
  summary.biosVersion = String(hardware.boot_rom_version || hardware.secure_rom_version || '');
  summary.systemDisk = disks.find((item) => item.isSystem)?.name;
  summary.systemDiskFree = dfInfo.freeBytes !== undefined ? formatBytes(dfInfo.freeBytes) : undefined;
  summary.systemDiskFreePercent = dfInfo.sizeBytes !== undefined && dfInfo.freeBytes !== undefined ? (dfInfo.freeBytes / dfInfo.sizeBytes) * 100 : undefined;
  summary.batteryStatus = battery
    ? `${battery.status}${battery.chargePercent !== undefined ? ` (${battery.chargePercent}%)` : ''}${battery.condition ? ` / ${battery.condition}` : ''}`
    : '未检测到电池';

  const memoryModules: MemoryModule[] = [{
    label: '统一内存/系统内存',
    capacityBytes: totalMemoryBytes,
  }];

  const insights = buildInsights(summary.totalMemoryBytes, memoryModules, disks, summary.graphicsCount || 0, battery);
  const score = computeScore(summary.totalMemoryBytes, summary.cpuCores, summary.systemDiskFreePercent, summary.graphicsCount || 0, insights.filter((item) => item.level !== 'info').length);

  const cpuSection = [
    hardware.chip_type ? `芯片：${String(hardware.chip_type)}` : '',
    hardware.cpu_type ? `处理器：${String(hardware.cpu_type)}` : '',
    hardware.number_processors ? `处理器数量：${String(hardware.number_processors)}` : '',
    hardware.packages ? `封装数：${String(hardware.packages)}` : '',
    hardware.physical_cpu ? `物理核心：${String(hardware.physical_cpu)}` : '',
    hardware.logical_cpu ? `逻辑核心：${String(hardware.logical_cpu)}` : '',
  ]
    .filter(Boolean)
    .join('\n') || '未获取到处理器信息';

  const memorySection = [
    `物理内存：${String(hardware.physical_memory || summary.totalMemory)}`,
    hardware.user_mem ? `用户可用内存：${String(hardware.user_mem)}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  const diskSection = disks.map((disk) =>
    [
      `${disk.name}${disk.isSystem ? ' [系统盘]' : ''}`,
      disk.sizeBytes ? `  容量：${formatBytes(disk.sizeBytes)}` : '',
      disk.freeBytes !== undefined ? `  可用：${formatBytes(disk.freeBytes)}` : '',
      disk.usedBytes !== undefined ? `  已用：${formatBytes(disk.usedBytes)}` : '',
      disk.model ? `  物理磁盘：${disk.model}` : '',
      disk.fileSystem ? `  文件系统：${disk.fileSystem}` : '',
    ]
      .filter(Boolean)
      .join('\n'),
  ).join('\n\n') || '未获取到存储设备信息';

  const gpuSection = displayCards.map((card, index) =>
    [
      `${index + 1}. ${String(card._name || card.sppci_model || '图形适配器')}`,
      card.spdisplays_vendor ? `  厂商：${String(card.spdisplays_vendor)}` : '',
      card.spdisplays_vram ? `  显存：${String(card.spdisplays_vram)}` : '',
      card.spdisplays_device_id ? `  设备 ID：${String(card.spdisplays_device_id)}` : '',
    ]
      .filter(Boolean)
      .join('\n'),
  ).join('\n\n') || '未获取到显卡信息';

  const displaySection = displayEntries.map((display, index) =>
    [
      `${index + 1}. ${String(display._name || '显示器')}`,
      display.spdisplays_resolution ? `  分辨率：${String(display.spdisplays_resolution)}` : '',
      display._spdisplays_display_type ? `  类型：${String(display._spdisplays_display_type)}` : '',
      display.spdisplays_pixels ? `  像素：${String(display.spdisplays_pixels)}` : '',
    ]
      .filter(Boolean)
      .join('\n'),
  ).join('\n\n') || '未获取到显示器详情';

  const networkSection = networkEntries.map((network, index) =>
    [
      `${index + 1}. ${String(network._name || network.interface || '网络接口')}`,
      network.interface ? `  接口：${String(network.interface)}` : '',
      network.ip_address ? `  IP：${String(network.ip_address)}` : '',
      network.hardware ? `  硬件：${String(network.hardware)}` : '',
      network.proxies ? `  代理：${String(network.proxies)}` : '',
    ]
      .filter(Boolean)
      .join('\n'),
  ).join('\n\n') || '未获取到活动网卡信息';

  const firmwareSection = [
    `机型：${summary.motherboard || '-'}`,
    `序列号：${String(hardware.serial_number || '-')}`,
    `Boot ROM：${summary.biosVersion || '-'}`,
    hardware.provisioning_UDID ? `设备 UDID：${String(hardware.provisioning_UDID)}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  const batterySection = battery
    ? [
        `状态：${battery.status}`,
        battery.chargePercent !== undefined ? `电量：${battery.chargePercent}%` : '',
        battery.condition ? `健康状态：${battery.condition}` : '',
        battery.healthPercent !== undefined ? `健康度：${formatPercent(battery.healthPercent)}` : '',
        battery.cycleCount !== undefined ? `循环次数：${battery.cycleCount}` : '',
      ]
        .filter(Boolean)
        .join('\n')
    : '未检测到电池';

  return {
    success: true,
    message: '本机硬件检测完成。',
    inspectedAt,
    platform: process.platform,
    score,
    summary,
    insights,
    sections: [
      {
        key: 'system',
        title: '系统概览',
        command: profiler.command,
        output: [
          `机型：${summary.motherboard || '-'}`,
          `序列号：${String(hardware.serial_number || '-')}`,
          `系统：${summary.os}`,
          `内核：${summary.version}`,
          `主机名：${summary.hostname}`,
          `架构：${summary.arch}`,
          `运行时长：${summary.uptime}`,
        ].join('\n'),
      },
      { key: 'cpu', title: '处理器', command: 'system_profiler SPHardwareDataType -json', output: cpuSection },
      { key: 'memory', title: '内存', command: 'system_profiler SPHardwareDataType -json', output: memorySection },
      { key: 'disk', title: '磁盘', command: 'system_profiler SPStorageDataType -json + df -k /', output: diskSection },
      { key: 'gpu', title: '显卡', command: 'system_profiler SPDisplaysDataType -json', output: gpuSection },
      { key: 'display', title: '显示器', command: 'system_profiler SPDisplaysDataType -json', output: displaySection },
      { key: 'network', title: '网络', command: 'system_profiler SPNetworkDataType -json', output: networkSection },
      { key: 'firmware', title: '机型 / 固件', command: 'system_profiler SPHardwareDataType -json', output: firmwareSection },
      { key: 'battery', title: '电池', command: 'system_profiler SPPowerDataType -json', output: batterySection },
    ],
  };
};

export const inspectLocalSystem = async (): Promise<LocalSystemInspectResult> => {
  if (process.platform === 'win32') {
    return inspectWindows();
  }

  if (process.platform === 'darwin') {
    return inspectMac();
  }

  throw new Error(`当前仅支持在 Windows 和 macOS 上进行本机硬件检测，当前平台：${process.platform}`);
};
