import { Client, ConnectConfig } from 'ssh2';

export type LinuxServerCredentials = {
  host: string;
  port?: number;
  username: string;
  password: string;
};

export type LinuxServerSectionKey =
  | 'summary'
  | 'cpu'
  | 'memory'
  | 'disk'
  | 'ports'
  | 'jdk'
  | 'dockerImages'
  | 'dockerContainers'
  | 'nginx'
  | 'nginxCerts';

export type LinuxServerSection = {
  key: LinuxServerSectionKey;
  title: string;
  command: string;
  output: string;
};

export type LinuxServerAlert = {
  level: 'info' | 'warning' | 'error';
  title: string;
  detail: string;
};

export type LinuxServerInspectResult = {
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
  };
  alerts: LinuxServerAlert[];
  sections: LinuxServerSection[];
};

type CommandDefinition = {
  key: LinuxServerSectionKey;
  title: string;
  command: string;
};

const SUMMARY_COMMAND = `
HOSTNAME_VALUE="$(hostname 2>/dev/null || uname -n)"
OS_VALUE="$( (grep '^PRETTY_NAME=' /etc/os-release 2>/dev/null | head -n 1 | cut -d= -f2- | tr -d '"') || uname -srm )"
KERNEL_VALUE="$(uname -srmo 2>/dev/null || uname -a)"
UPTIME_VALUE="$(uptime -p 2>/dev/null || uptime 2>/dev/null)"
PRIMARY_IP_VALUE="$(hostname -I 2>/dev/null | awk '{print $1}')"
printf 'HOSTNAME=%s\nOS=%s\nKERNEL=%s\nUPTIME=%s\nPRIMARY_IP=%s\n' "$HOSTNAME_VALUE" "$OS_VALUE" "$KERNEL_VALUE" "$UPTIME_VALUE" "$PRIMARY_IP_VALUE"
`.trim();

const COMMANDS: CommandDefinition[] = [
  {
    key: 'summary',
    title: 'Basic Summary',
    command: SUMMARY_COMMAND,
  },
  {
    key: 'cpu',
    title: 'CPU',
    command: `
if command -v lscpu >/dev/null 2>&1; then
  lscpu
else
  echo "Architecture: $(uname -m 2>/dev/null)"
  echo "CPU(s): $(getconf _NPROCESSORS_ONLN 2>/dev/null || nproc 2>/dev/null || grep -c '^processor' /proc/cpuinfo 2>/dev/null)"
  awk -F: '/model name/ {gsub(/^[ \\t]+/, "", $2); print "Model: " $2; exit}' /proc/cpuinfo 2>/dev/null
fi
`.trim(),
  },
  {
    key: 'memory',
    title: 'Memory',
    command: `
if command -v free >/dev/null 2>&1; then
  free -h
  echo
  free -m
else
  cat /proc/meminfo
fi
`.trim(),
  },
  {
    key: 'disk',
    title: 'Disk Usage',
    command: `
if command -v df >/dev/null 2>&1; then
  df -h
  echo
  df -i
else
  echo 'df not available'
fi
`.trim(),
  },
  {
    key: 'ports',
    title: 'Open Ports And Processes',
    command: `
if command -v ss >/dev/null 2>&1; then
  ss -lntup 2>&1
elif command -v netstat >/dev/null 2>&1; then
  netstat -lntup 2>&1
elif command -v lsof >/dev/null 2>&1; then
  lsof -nP -iTCP -sTCP:LISTEN 2>&1
else
  echo 'ss, netstat and lsof are not installed'
fi
`.trim(),
  },
  {
    key: 'jdk',
    title: 'JDK',
    command: `
if command -v java >/dev/null 2>&1; then
  java -version 2>&1
else
  echo 'java not installed'
fi
echo
if command -v javac >/dev/null 2>&1; then
  javac -version 2>&1
else
  echo 'javac not installed'
fi
if [ -n "$JAVA_HOME" ]; then
  echo
  echo "JAVA_HOME=$JAVA_HOME"
else
  echo
  echo 'JAVA_HOME is not set'
fi
`.trim(),
  },
  {
    key: 'dockerImages',
    title: 'Docker Images',
    command: `
if command -v docker >/dev/null 2>&1; then
  docker --version 2>&1
  echo
  docker images --format 'table {{.Repository}}\\t{{.Tag}}\\t{{.ID}}\\t{{.Size}}\\t{{.CreatedSince}}' 2>&1 || docker images 2>&1
else
  echo 'docker not installed'
fi
`.trim(),
  },
  {
    key: 'dockerContainers',
    title: 'Docker Containers',
    command: `
if command -v docker >/dev/null 2>&1; then
  docker ps -a --format 'table {{.Names}}\\t{{.Image}}\\t{{.Status}}\\t{{.Ports}}' 2>&1 || docker ps -a 2>&1
else
  echo 'docker not installed'
fi
`.trim(),
  },
  {
    key: 'nginx',
    title: 'Nginx Key Config',
    command: `
if command -v nginx >/dev/null 2>&1; then
  nginx -v 2>&1
  echo
  nginx -t 2>&1 || true
  echo
  nginx -T 2>&1 | grep -E '^[[:space:]]*(user|worker_processes|worker_connections|server_name|listen|root|proxy_pass|ssl_certificate|ssl_certificate_key|access_log|error_log)' | head -n 160 || true
else
  echo 'nginx not installed'
fi
`.trim(),
  },
  {
    key: 'nginxCerts',
    title: 'Nginx Certificates',
    command: `
if command -v nginx >/dev/null 2>&1 && command -v openssl >/dev/null 2>&1; then
  nginx -T 2>&1 | sed -n 's/^[[:space:]]*ssl_certificate[[:space:]]\\+\\([^;]*\\);/\\1/p' | sort -u | while read cert; do
    if [ -n "$cert" ] && [ -f "$cert" ]; then
      echo "CERT=$cert"
      openssl x509 -in "$cert" -noout -subject -issuer -dates 2>/dev/null
      echo "---"
    fi
  done
else
  echo 'nginx or openssl not installed'
fi
`.trim(),
  },
];

const normalizeOutput = (value: string): string => {
  const trimmed = value.replace(/\r/g, '').trim();
  return trimmed || '(no output)';
};

const parseSummary = (output: string): LinuxServerInspectResult['summary'] => {
  const summary: LinuxServerInspectResult['summary'] = {};

  output.split('\n').forEach((line) => {
    const separatorIndex = line.indexOf('=');
    if (separatorIndex < 0) {
      return;
    }

    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();
    if (!value) {
      return;
    }

    if (key === 'HOSTNAME') {
      summary.hostname = value;
    } else if (key === 'OS') {
      summary.os = value;
    } else if (key === 'KERNEL') {
      summary.kernel = value;
    } else if (key === 'UPTIME') {
      summary.uptime = value;
    } else if (key === 'PRIMARY_IP') {
      summary.primaryIp = value;
    }
  });

  return summary;
};

const parseMemoryUsagePercent = (output: string): number | undefined => {
  const lines = output.split('\n');
  const memLine = lines.find((line) => /^Mem:\s+/i.test(line));
  if (!memLine) {
    return undefined;
  }

  const columns = memLine.trim().split(/\s+/);
  if (columns.length < 3) {
    return undefined;
  }

  const total = Number(columns[1]);
  const used = Number(columns[2]);
  if (!Number.isFinite(total) || !Number.isFinite(used) || total <= 0) {
    return undefined;
  }

  return Math.round((used / total) * 100);
};

const parseHighestDiskUsagePercent = (output: string): number | undefined => {
  const matches = Array.from(output.matchAll(/(\d+)%/g)).map((item) => Number(item[1]));
  const valid = matches.filter((item) => Number.isFinite(item));
  return valid.length > 0 ? Math.max(...valid) : undefined;
};

const parseOpenPortCount = (output: string): number | undefined => {
  if (/ss, netstat and lsof are not installed/i.test(output)) {
    return undefined;
  }

  const lines = output
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const contentLines = lines.filter((line) => {
    if (/^(Netid|Proto|COMMAND)\b/i.test(line)) {
      return false;
    }

    return /LISTEN/i.test(line) || /^tcp/i.test(line);
  });

  return contentLines.length;
};

const parseDockerContainerCounts = (output: string): { total: number; running: number } => {
  const lines = output
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length === 0 || /docker not installed/i.test(output)) {
    return { total: 0, running: 0 };
  }

  const contentLines = lines.filter((line) => !/^NAMES\s+/i.test(line));
  let running = 0;

  contentLines.forEach((line) => {
    if (/Up\s+/i.test(line) || /\bUp\b/i.test(line)) {
      running += 1;
    }
  });

  return {
    total: contentLines.length,
    running,
  };
};

const parseNginxCertificateCount = (output: string): number => {
  return output
    .split('\n')
    .filter((line) => line.startsWith('CERT='))
    .length;
};

const buildAlerts = (sections: LinuxServerSection[], summary: LinuxServerInspectResult['summary']): LinuxServerAlert[] => {
  const alerts: LinuxServerAlert[] = [];
  const memoryUsagePercent = summary.memoryUsagePercent;
  const highestDiskUsagePercent = summary.highestDiskUsagePercent;

  if (memoryUsagePercent !== undefined) {
    if (memoryUsagePercent >= 90) {
      alerts.push({ level: 'error', title: 'Memory Usage High', detail: `Memory usage is ${memoryUsagePercent}%.` });
    } else if (memoryUsagePercent >= 80) {
      alerts.push({ level: 'warning', title: 'Memory Usage Warning', detail: `Memory usage is ${memoryUsagePercent}%.` });
    } else {
      alerts.push({ level: 'info', title: 'Memory Usage Normal', detail: `Memory usage is ${memoryUsagePercent}%.` });
    }
  }

  if (highestDiskUsagePercent !== undefined) {
    if (highestDiskUsagePercent >= 90) {
      alerts.push({ level: 'error', title: 'Disk Usage High', detail: `Highest filesystem usage is ${highestDiskUsagePercent}%.` });
    } else if (highestDiskUsagePercent >= 80) {
      alerts.push({ level: 'warning', title: 'Disk Usage Warning', detail: `Highest filesystem usage is ${highestDiskUsagePercent}%.` });
    } else {
      alerts.push({ level: 'info', title: 'Disk Usage Normal', detail: `Highest filesystem usage is ${highestDiskUsagePercent}%.` });
    }
  }

  if (summary.openPortCount !== undefined) {
    alerts.push({
      level: 'info',
      title: 'Listening Ports Collected',
      detail: `${summary.openPortCount} listening port record(s) were detected.`,
    });
  }

  const jdkSection = sections.find((item) => item.key === 'jdk');
  if (jdkSection) {
    if (/java not installed/i.test(jdkSection.output)) {
      alerts.push({ level: 'warning', title: 'JDK Missing', detail: 'java is not installed on this server.' });
    } else if (/JAVA_HOME is not set/i.test(jdkSection.output)) {
      alerts.push({ level: 'warning', title: 'JAVA_HOME Missing', detail: 'Java exists but JAVA_HOME is not set.' });
    } else {
      alerts.push({ level: 'info', title: 'JDK Detected', detail: 'java command is available.' });
    }
  }

  const dockerImagesSection = sections.find((item) => item.key === 'dockerImages');
  const dockerContainersSection = sections.find((item) => item.key === 'dockerContainers');
  if (dockerImagesSection && dockerContainersSection) {
    if (/docker not installed/i.test(dockerImagesSection.output)) {
      alerts.push({ level: 'warning', title: 'Docker Missing', detail: 'docker command is not installed.' });
    } else {
      const stoppedCount = (summary.dockerContainerCount || 0) - (summary.dockerRunningCount || 0);
      if (stoppedCount > 0) {
        alerts.push({
          level: 'warning',
          title: 'Stopped Docker Containers',
          detail: `${stoppedCount} container(s) are not running out of ${summary.dockerContainerCount || 0}.`,
        });
      } else {
        alerts.push({
          level: 'info',
          title: 'Docker Containers Healthy',
          detail: `${summary.dockerRunningCount || 0} / ${summary.dockerContainerCount || 0} container(s) are running.`,
        });
      }
    }
  }

  const nginxSection = sections.find((item) => item.key === 'nginx');
  if (nginxSection) {
    if (/nginx not installed/i.test(nginxSection.output)) {
      alerts.push({ level: 'warning', title: 'Nginx Missing', detail: 'nginx command is not installed.' });
    } else if (/test failed/i.test(nginxSection.output) || /emerg|failed/i.test(nginxSection.output)) {
      alerts.push({ level: 'error', title: 'Nginx Config Check Failed', detail: 'nginx -t reported a configuration problem.' });
    } else if (/syntax is ok/i.test(nginxSection.output) || /test is successful/i.test(nginxSection.output)) {
      alerts.push({ level: 'info', title: 'Nginx Config Valid', detail: 'nginx -t completed successfully.' });
    }
  }

  const nginxCertsSection = sections.find((item) => item.key === 'nginxCerts');
  if (nginxCertsSection) {
    if (/nginx or openssl not installed/i.test(nginxCertsSection.output)) {
      alerts.push({ level: 'warning', title: 'Certificate Check Unavailable', detail: 'nginx or openssl is unavailable.' });
    } else if ((summary.nginxCertificateCount || 0) === 0) {
      alerts.push({ level: 'warning', title: 'No Nginx Certificates Found', detail: 'No ssl_certificate entries were detected from nginx config.' });
    } else {
      alerts.push({
        level: 'info',
        title: 'Nginx Certificates Detected',
        detail: `${summary.nginxCertificateCount || 0} certificate file(s) were found in nginx config.`,
      });
    }
  }

  return alerts;
};

const execCommand = (client: Client, command: string, timeoutMs = 20000): Promise<string> =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Command timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    client.exec(`export LANG=C; export LC_ALL=C; ${command}`, (error: Error | undefined, stream: any) => {
      if (error) {
        clearTimeout(timer);
        reject(error);
        return;
      }

      let stdout = '';
      let stderr = '';

      stream.on('data', (chunk: Buffer) => {
        stdout += chunk.toString('utf-8');
      });

      stream.stderr.on('data', (chunk: Buffer) => {
        stderr += chunk.toString('utf-8');
      });

      stream.once('close', () => {
        clearTimeout(timer);
        resolve(normalizeOutput(`${stdout}${stderr ? `\n${stderr}` : ''}`));
      });
    });
  });

const connect = (credentials: LinuxServerCredentials): Promise<Client> =>
  new Promise((resolve, reject) => {
    const client = new Client();
    const config: ConnectConfig = {
      host: credentials.host,
      port: credentials.port || 22,
      username: credentials.username,
      password: credentials.password,
      readyTimeout: 10000,
      keepaliveInterval: 5000,
      keepaliveCountMax: 2,
      hostVerifier: () => true,
    };

    client.once('ready', () => resolve(client));
    client.once('error', (error: Error) => reject(error));
    client.connect(config);
  });

export const inspectLinuxServer = async (credentials: LinuxServerCredentials): Promise<LinuxServerInspectResult> => {
  const port = credentials.port || 22;
  const inspectedAt = new Date().toISOString();
  const client = await connect(credentials);

  try {
    const sections: LinuxServerSection[] = [];

    for (const item of COMMANDS) {
      const output = await execCommand(client, item.command);
      sections.push({
        key: item.key,
        title: item.title,
        command: item.command,
        output,
      });
    }

    const summarySection = sections.find((item) => item.key === 'summary');
    const memorySection = sections.find((item) => item.key === 'memory');
    const diskSection = sections.find((item) => item.key === 'disk');
    const portsSection = sections.find((item) => item.key === 'ports');
    const dockerContainersSection = sections.find((item) => item.key === 'dockerContainers');
    const nginxCertsSection = sections.find((item) => item.key === 'nginxCerts');

    const summary = summarySection ? parseSummary(summarySection.output) : {};
    summary.memoryUsagePercent = memorySection ? parseMemoryUsagePercent(memorySection.output) : undefined;
    summary.highestDiskUsagePercent = diskSection ? parseHighestDiskUsagePercent(diskSection.output) : undefined;
    summary.openPortCount = portsSection ? parseOpenPortCount(portsSection.output) : undefined;

    const dockerCounts = dockerContainersSection ? parseDockerContainerCounts(dockerContainersSection.output) : { total: 0, running: 0 };
    summary.dockerContainerCount = dockerCounts.total;
    summary.dockerRunningCount = dockerCounts.running;
    summary.nginxCertificateCount = nginxCertsSection ? parseNginxCertificateCount(nginxCertsSection.output) : 0;

    const alerts = buildAlerts(sections, summary);

    return {
      success: true,
      message: 'Server inspection completed.',
      inspectedAt,
      server: {
        host: credentials.host,
        port,
        username: credentials.username,
      },
      summary,
      alerts,
      sections,
    };
  } finally {
    client.end();
  }
};
