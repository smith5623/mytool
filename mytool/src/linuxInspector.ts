import { Client, ConnectConfig } from 'ssh2';

export type LinuxServerCredentials = {
  host: string;
  port?: number;
  username: string;
  password: string;
};

export type LinuxInspectScope = 'full' | 'basic' | 'resource' | 'network' | 'runtime' | 'security';

export type LinuxQuickAction = 'nginxConfig' | 'restartNginx';

export type LinuxServerSectionKey =
  | 'summary'
  | 'cpu'
  | 'memory'
  | 'disk'
  | 'diskTop'
  | 'ports'
  | 'processes'
  | 'journal'
  | 'jdk'
  | 'dockerImages'
  | 'dockerContainers'
  | 'nginx'
  | 'nginxCerts'
  | 'systemd'
  | 'security';

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

export type LinuxServerScoreBreakdown = {
  label: string;
  score: number;
  maxScore: number;
  detail: string;
};

export type LinuxServerCertificate = {
  path: string;
  subject?: string;
  issuer?: string;
  notBefore?: string;
  notAfter?: string;
  daysRemaining?: number;
  status: 'valid' | 'expiring' | 'expired' | 'unknown';
};

export type LinuxServiceHealth = {
  key: 'docker' | 'nginx' | 'jdk';
  title: string;
  status: 'healthy' | 'warning' | 'error' | 'missing';
  summary: string;
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
    failedServiceCount?: number;
    rootLogin?: string;
    passwordAuthentication?: string;
    firewallStatus?: string;
    selinuxStatus?: string;
    failedLoginCount?: number;
    expiringCertificateCount?: number;
    expiredCertificateCount?: number;
    earliestCertificateExpiryDays?: number;
    topCpuProcess?: string;
    topMemoryProcess?: string;
    largestDirectory?: string;
    riskyPortCount?: number;
    riskyPorts?: string[];
    recentErrorCount?: number;
    recentErrorPreview?: string;
    failedLoginIpCount?: number;
    topFailedLoginIp?: string;
    failedLoginSources?: string[];
  };
  score: {
    overall: number;
    label: string;
    breakdown: LinuxServerScoreBreakdown[];
  };
  highlights: string[];
  alerts: LinuxServerAlert[];
  certificates: LinuxServerCertificate[];
  serviceHealth: LinuxServiceHealth[];
  sections: LinuxServerSection[];
};

export type LinuxQuickActionResult = {
  success: boolean;
  message: string;
  inspectedAt: string;
  action: LinuxQuickAction;
  title: string;
  command: string;
  output: string;
};

type CommandDefinition = {
  key: LinuxServerSectionKey;
  title: string;
  command: string;
  timeoutMs?: number;
};

type SecuritySummary = Pick<
  LinuxServerInspectResult['summary'],
  | 'rootLogin'
  | 'passwordAuthentication'
  | 'firewallStatus'
  | 'selinuxStatus'
  | 'failedLoginCount'
  | 'failedLoginIpCount'
  | 'topFailedLoginIp'
  | 'failedLoginSources'
>;

type ExecStream = {
  on: (event: 'data', listener: (chunk: Buffer) => void) => void;
  once: (event: 'close', listener: () => void) => void;
  stderr: {
    on: (event: 'data', listener: (chunk: Buffer) => void) => void;
  };
};

const SSH_READY_TIMEOUT_MS = 15000;
const DEFAULT_COMMAND_TIMEOUT_MS = 60000;
const LONG_RUNNING_COMMAND_TIMEOUT_MS = 90000;
const SCOPE_COMMAND_KEYS: Record<LinuxInspectScope, LinuxServerSectionKey[]> = {
  full: ['summary', 'cpu', 'memory', 'disk', 'diskTop', 'ports', 'processes', 'journal', 'jdk', 'dockerImages', 'dockerContainers', 'nginx', 'nginxCerts', 'systemd', 'security'],
  basic: ['summary'],
  resource: ['summary', 'cpu', 'memory', 'disk', 'diskTop', 'processes'],
  network: ['summary', 'ports', 'journal'],
  runtime: ['summary', 'jdk', 'dockerImages', 'dockerContainers', 'nginx', 'nginxCerts', 'systemd'],
  security: ['summary', 'security'],
};

const SUMMARY_COMMAND = `
HOSTNAME_VALUE="$(hostname 2>/dev/null || uname -n)"
OS_VALUE="$( (grep '^PRETTY_NAME=' /etc/os-release 2>/dev/null | head -n 1 | cut -d= -f2- | tr -d '"') || uname -srm )"
KERNEL_VALUE="$(uname -srmo 2>/dev/null || uname -a)"
UPTIME_VALUE="$(uptime -p 2>/dev/null || uptime 2>/dev/null)"
PRIMARY_IP_VALUE="$(hostname -I 2>/dev/null | awk '{print $1}')"
printf 'HOSTNAME=%s\\nOS=%s\\nKERNEL=%s\\nUPTIME=%s\\nPRIMARY_IP=%s\\n' "$HOSTNAME_VALUE" "$OS_VALUE" "$KERNEL_VALUE" "$UPTIME_VALUE" "$PRIMARY_IP_VALUE"
`.trim();

const COMMANDS: CommandDefinition[] = [
  {
    key: 'summary',
    title: '基础信息',
    command: SUMMARY_COMMAND,
  },
  {
    key: 'cpu',
    title: 'CPU 信息',
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
    title: '内存信息',
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
    title: '磁盘使用',
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
    key: 'diskTop',
    title: '大目录分析',
    command: `
if command -v du >/dev/null 2>&1; then
  for target in /var /home /opt /usr /tmp; do
    if [ -d "$target" ]; then
      echo "TARGET=$target"
      du -xh --max-depth=1 "$target" 2>/dev/null | sort -hr | head -n 8
      echo "---"
    fi
  done
else
  echo 'du not available'
fi
`.trim(),
    timeoutMs: LONG_RUNNING_COMMAND_TIMEOUT_MS,
  },
  {
    key: 'ports',
    title: '监听端口与进程',
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
    key: 'processes',
    title: '高占用进程',
    command: `
if command -v ps >/dev/null 2>&1; then
  echo 'TOP_CPU_START'
  ps -eo pid,ppid,user,%cpu,%mem,stat,etime,comm --sort=-%cpu 2>/dev/null | head -n 8
  echo 'TOP_CPU_END'
  echo
  echo 'TOP_MEM_START'
  ps -eo pid,ppid,user,%cpu,%mem,stat,etime,comm --sort=-%mem 2>/dev/null | head -n 8
  echo 'TOP_MEM_END'
else
  echo 'ps not available'
fi
`.trim(),
  },
  {
    key: 'journal',
    title: '近期错误日志',
    command: `
if command -v journalctl >/dev/null 2>&1; then
  echo 'ERROR_LOGS_START'
  journalctl -p err -n 20 --no-pager --output short-iso 2>&1 || true
  echo 'ERROR_LOGS_END'
elif [ -f /var/log/messages ]; then
  echo 'ERROR_LOGS_START'
  grep -iE 'error|fail|fatal|panic|critical' /var/log/messages 2>/dev/null | tail -n 20 || true
  echo 'ERROR_LOGS_END'
elif [ -f /var/log/syslog ]; then
  echo 'ERROR_LOGS_START'
  grep -iE 'error|fail|fatal|panic|critical' /var/log/syslog 2>/dev/null | tail -n 20 || true
  echo 'ERROR_LOGS_END'
else
  echo 'journalctl and fallback logs are not available'
fi
`.trim(),
  },
  {
    key: 'jdk',
    title: 'Java 环境',
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
    title: 'Docker 镜像',
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
    title: 'Docker 容器',
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
    title: 'Nginx 关键配置',
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
    title: 'Nginx 证书',
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
  {
    key: 'systemd',
    title: 'Systemd 服务',
    command: `
if command -v systemctl >/dev/null 2>&1; then
  echo 'FAILED_SERVICES_START'
  systemctl --failed --no-pager --no-legend 2>&1 || true
  echo 'FAILED_SERVICES_END'
  echo
  echo 'ENABLED_SERVICES_START'
  systemctl list-unit-files --type=service --state=enabled --no-pager --no-legend 2>&1 | head -n 40 || true
  echo 'ENABLED_SERVICES_END'
else
  echo 'systemctl not available'
fi
`.trim(),
  },
  {
    key: 'security',
    title: '安全基线',
    command: `
ROOT_LOGIN_VALUE="$(sshd -T 2>/dev/null | awk '/^permitrootlogin / {print $2; exit}')"
if [ -z "$ROOT_LOGIN_VALUE" ] && [ -f /etc/ssh/sshd_config ]; then
  ROOT_LOGIN_VALUE="$(awk 'tolower($1)=="permitrootlogin" {print tolower($2); exit}' /etc/ssh/sshd_config 2>/dev/null)"
fi
[ -z "$ROOT_LOGIN_VALUE" ] && ROOT_LOGIN_VALUE="unknown"

PASSWORD_AUTH_VALUE="$(sshd -T 2>/dev/null | awk '/^passwordauthentication / {print $2; exit}')"
if [ -z "$PASSWORD_AUTH_VALUE" ] && [ -f /etc/ssh/sshd_config ]; then
  PASSWORD_AUTH_VALUE="$(awk 'tolower($1)=="passwordauthentication" {print tolower($2); exit}' /etc/ssh/sshd_config 2>/dev/null)"
fi
[ -z "$PASSWORD_AUTH_VALUE" ] && PASSWORD_AUTH_VALUE="unknown"

FIREWALL_VALUE="unknown"
if command -v ufw >/dev/null 2>&1; then
  FIREWALL_VALUE="ufw:$(ufw status 2>/dev/null | head -n 1)"
elif command -v firewall-cmd >/dev/null 2>&1; then
  FIREWALL_VALUE="firewalld:$(firewall-cmd --state 2>/dev/null || echo unknown)"
elif command -v systemctl >/dev/null 2>&1; then
  FIREWALL_VALUE="iptables:$(systemctl is-active iptables 2>/dev/null || echo unknown)"
fi

SELINUX_VALUE="$(getenforce 2>/dev/null)"
if [ -z "$SELINUX_VALUE" ] && command -v sestatus >/dev/null 2>&1; then
  SELINUX_VALUE="$(sestatus 2>/dev/null | awk -F: '/SELinux status/ {gsub(/^[ \\t]+/, "", $2); print $2; exit}')"
fi
[ -z "$SELINUX_VALUE" ] && SELINUX_VALUE="unknown"

FAILED_LOGINS_VALUE=""
FAILED_LOGIN_SOURCES_VALUE=""
if command -v lastb >/dev/null 2>&1; then
  FAILED_LOGINS_VALUE="$(lastb -n 20 2>/dev/null | awk 'NF > 0 && $1 != "btmp" {count++} END {print count + 0}')"
  FAILED_LOGIN_SOURCES_VALUE="$(lastb -n 50 2>/dev/null | awk '
    NF > 0 && $1 != "btmp" {
      for (i = 1; i <= NF; i++) {
        if ($i ~ /^([0-9]{1,3}\\.){3}[0-9]{1,3}$/ || $i ~ /:/) {
          ipCount[$i]++
          break
        }
      }
    }
    END {
      for (ip in ipCount) {
        printf "%s:%d\n", ip, ipCount[ip]
      }
    }' | sort -t: -k2,2nr | head -n 5 | paste -sd',' -)"
fi
[ -z "$FAILED_LOGINS_VALUE" ] && FAILED_LOGINS_VALUE="unknown"
[ -z "$FAILED_LOGIN_SOURCES_VALUE" ] && FAILED_LOGIN_SOURCES_VALUE="unknown"

printf 'ROOT_LOGIN=%s\\nPASSWORD_AUTH=%s\\nFIREWALL=%s\\nSELINUX=%s\\nFAILED_LOGINS=%s\\nFAILED_LOGIN_SOURCES=%s\\n' "$ROOT_LOGIN_VALUE" "$PASSWORD_AUTH_VALUE" "$FIREWALL_VALUE" "$SELINUX_VALUE" "$FAILED_LOGINS_VALUE" "$FAILED_LOGIN_SOURCES_VALUE"
`.trim(),
  },
];

const normalizeOutput = (value: string): string => {
  const trimmed = value.replace(/\r/g, '').trim();
  return trimmed || '（无输出）';
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
  const primaryBlock = output.split(/\n\s*\n/)[0] || output;
  const lines = primaryBlock
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !/^Filesystem/i.test(line));

  const percentages = lines
    .map((line) => {
      const match = line.match(/(\d+)%/);
      return match ? Number(match[1]) : undefined;
    })
    .filter((value): value is number => value !== undefined && Number.isFinite(value));

  return percentages.length > 0 ? Math.max(...percentages) : undefined;
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

const parseRiskyPorts = (output: string): string[] => {
  if (/ss, netstat and lsof are not installed/i.test(output)) {
    return [];
  }

  const riskyPortMap: Record<string, string> = {
    '22': 'SSH',
    '2375': 'Docker API',
    '3306': 'MySQL',
    '5432': 'PostgreSQL',
    '6379': 'Redis',
    '27017': 'MongoDB',
    '11211': 'Memcached',
    '9200': 'Elasticsearch',
    '9092': 'Kafka',
  };

  const results = new Set<string>();

  output
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !/^(Netid|Proto|COMMAND)\b/i.test(line))
    .forEach((line) => {
      const isPublicBind = /0\.0\.0\.0:|\[::\]:|\*:/.test(line);
      if (!isPublicBind) {
        return;
      }

      Object.entries(riskyPortMap).forEach(([port, label]) => {
        const pattern = new RegExp(`(:|\\*)${port}(\\s|$)`);
        if (pattern.test(line)) {
          results.add(`${label} ${port}`);
        }
      });
    });

  return Array.from(results);
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

const parseNginxCertificates = (output: string): LinuxServerCertificate[] => {
  if (/nginx or openssl not installed/i.test(output)) {
    return [];
  }

  const blocks = output
    .split('---')
    .map((block) => block.trim())
    .filter((block) => block.includes('CERT='));

  return blocks.map((block) => {
    const certificate: LinuxServerCertificate = {
      path: '',
      status: 'unknown',
    };

    block.split('\n').forEach((line) => {
      const trimmed = line.trim();

      if (trimmed.startsWith('CERT=')) {
        certificate.path = trimmed.slice('CERT='.length).trim();
      } else if (trimmed.startsWith('subject=')) {
        certificate.subject = trimmed.slice('subject='.length).trim();
      } else if (trimmed.startsWith('issuer=')) {
        certificate.issuer = trimmed.slice('issuer='.length).trim();
      } else if (trimmed.startsWith('notBefore=')) {
        certificate.notBefore = trimmed.slice('notBefore='.length).trim();
      } else if (trimmed.startsWith('notAfter=')) {
        certificate.notAfter = trimmed.slice('notAfter='.length).trim();
      }
    });

    if (certificate.notAfter) {
      const expiryTime = new Date(certificate.notAfter).getTime();
      if (!Number.isNaN(expiryTime)) {
        const daysRemaining = Math.ceil((expiryTime - Date.now()) / (1000 * 60 * 60 * 24));
        certificate.daysRemaining = daysRemaining;
        if (daysRemaining < 0) {
          certificate.status = 'expired';
        } else if (daysRemaining <= 30) {
          certificate.status = 'expiring';
        } else {
          certificate.status = 'valid';
        }
      }
    }

    return certificate;
  });
};

const parseFailedServiceCount = (output: string): number | undefined => {
  if (/systemctl not available/i.test(output)) {
    return undefined;
  }

  const blockMatch = output.match(/FAILED_SERVICES_START\s*([\s\S]*?)\s*FAILED_SERVICES_END/);
  if (!blockMatch) {
    return undefined;
  }

  const lines = blockMatch[1]
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length === 1 && /0 loaded units listed|No units/i.test(lines[0])) {
    return 0;
  }

  return lines.filter((line) => !/^UNIT\b/i.test(line)).length;
};

const parseSecuritySummary = (output: string): SecuritySummary => {
  const summary: SecuritySummary = {};

  output.split('\n').forEach((line) => {
    const separatorIndex = line.indexOf('=');
    if (separatorIndex < 0) {
      return;
    }

    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();

    if (key === 'ROOT_LOGIN') {
      summary.rootLogin = value || 'unknown';
    } else if (key === 'PASSWORD_AUTH') {
      summary.passwordAuthentication = value || 'unknown';
    } else if (key === 'FIREWALL') {
      summary.firewallStatus = value || 'unknown';
    } else if (key === 'SELINUX') {
      summary.selinuxStatus = value || 'unknown';
    } else if (key === 'FAILED_LOGINS') {
      const count = Number(value);
      summary.failedLoginCount = Number.isFinite(count) ? count : undefined;
    } else if (key === 'FAILED_LOGIN_SOURCES') {
      if (!value || value === 'unknown') {
        summary.failedLoginSources = [];
        return;
      }

      const sources = value
        .split(',')
        .map((item) => item.trim())
        .filter((item) => item.length > 0);

      summary.failedLoginSources = sources;
      summary.failedLoginIpCount = sources.length;
      summary.topFailedLoginIp = sources[0];
    }
  });

  return summary;
};

const parseTopEntryFromBlock = (output: string, startMarker: string, endMarker: string): string | undefined => {
  if (/ps not available/i.test(output)) {
    return undefined;
  }

  const blockMatch = output.match(new RegExp(`${startMarker}\\s*([\\s\\S]*?)\\s*${endMarker}`));
  if (!blockMatch) {
    return undefined;
  }

  const lines = blockMatch[1]
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const dataLines = lines.filter((line) => !/^PID\s+/i.test(line));
  return dataLines[0];
};

const parseLargestDirectory = (output: string): string | undefined => {
  if (/du not available/i.test(output)) {
    return undefined;
  }

  const blocks = output
    .split('---')
    .map((block) => block.trim())
    .filter((block) => block.length > 0);

  const candidates: Array<{ size: number; label: string }> = [];

  blocks.forEach((block) => {
    const lines = block
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !line.startsWith('TARGET='));

    lines.forEach((line) => {
      const parts = line.split(/\s+/, 2);
      if (parts.length < 2) {
        return;
      }

      const sizeMatch = parts[0].match(/^([\d.]+)([KMGTP]?)/i);
      if (!sizeMatch) {
        return;
      }

      const sizeValue = Number(sizeMatch[1]);
      if (!Number.isFinite(sizeValue)) {
        return;
      }

      const unit = sizeMatch[2].toUpperCase();
      const multiplierMap: Record<string, number> = {
        '': 1,
        K: 1024,
        M: 1024 ** 2,
        G: 1024 ** 3,
        T: 1024 ** 4,
        P: 1024 ** 5,
      };

      const bytes = sizeValue * (multiplierMap[unit] || 1);
      candidates.push({
        size: bytes,
        label: `${parts[1]} (${parts[0]})`,
      });
    });
  });

  candidates.sort((left, right) => right.size - left.size);
  return candidates[0]?.label;
};

const parseRecentErrorSummary = (output: string): { count: number; preview?: string } => {
  if (/journalctl and fallback logs are not available/i.test(output)) {
    return { count: 0 };
  }

  const blockMatch = output.match(/ERROR_LOGS_START\s*([\s\S]*?)\s*ERROR_LOGS_END/);
  if (!blockMatch) {
    return { count: 0 };
  }

  const lines = blockMatch[1]
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const meaningfulLines = lines.filter((line) => !/-- No entries --/i.test(line));
  return {
    count: meaningfulLines.length,
    preview: meaningfulLines[0],
  };
};

const hasAnyKey = (inspectedKeys: Set<LinuxServerSectionKey>, keys: LinuxServerSectionKey[]): boolean =>
  keys.some((key) => inspectedKeys.has(key));

const buildServiceHealth = (
  sections: LinuxServerSection[],
  summary: LinuxServerInspectResult['summary'],
  inspectedKeys: Set<LinuxServerSectionKey>,
): LinuxServiceHealth[] => {
  const items: LinuxServiceHealth[] = [];

  if (hasAnyKey(inspectedKeys, ['dockerImages', 'dockerContainers'])) {
    const dockerImagesSection = sections.find((item) => item.key === 'dockerImages');
    if (!dockerImagesSection || /docker not installed/i.test(dockerImagesSection.output)) {
      items.push({
        key: 'docker',
        title: 'Docker',
        status: 'missing',
        summary: '未安装 Docker',
        detail: '该服务器上无法使用 docker 命令。',
      });
    } else {
      const stoppedCount = Math.max((summary.dockerContainerCount || 0) - (summary.dockerRunningCount || 0), 0);
      items.push({
        key: 'docker',
        title: 'Docker',
        status: stoppedCount > 0 ? 'warning' : 'healthy',
        summary:
          (summary.dockerContainerCount || 0) > 0
            ? `${summary.dockerRunningCount || 0}/${summary.dockerContainerCount || 0} 个容器正在运行`
            : '已安装 Docker，未发现容器',
        detail:
          stoppedCount > 0
            ? `${stoppedCount} 个容器当前未运行。`
            : '根据采集结果，未发现已停止的容器。',
      });
    }
  }

  if (hasAnyKey(inspectedKeys, ['nginx', 'nginxCerts'])) {
    const nginxSection = sections.find((item) => item.key === 'nginx');
    if (!nginxSection || /nginx not installed/i.test(nginxSection.output)) {
      items.push({
        key: 'nginx',
        title: 'Nginx',
        status: 'missing',
        summary: '未安装 Nginx',
        detail: '该服务器上无法使用 nginx 命令。',
      });
    } else if (/test failed/i.test(nginxSection.output) || /emerg|failed/i.test(nginxSection.output)) {
      items.push({
        key: 'nginx',
        title: 'Nginx',
        status: 'error',
        summary: '配置检查失败',
        detail: 'nginx -t 返回错误，需要尽快处理。',
      });
    } else {
      items.push({
        key: 'nginx',
        title: 'Nginx',
        status: 'healthy',
        summary: '配置检查通过',
        detail:
          summary.earliestCertificateExpiryDays !== undefined
            ? `最早到期证书将在 ${summary.earliestCertificateExpiryDays} 天后过期。`
            : 'nginx -t 执行成功。',
      });
    }
  }

  if (inspectedKeys.has('jdk')) {
    const jdkSection = sections.find((item) => item.key === 'jdk');
    if (!jdkSection || /java not installed/i.test(jdkSection.output)) {
      items.push({
        key: 'jdk',
        title: 'Java',
        status: 'missing',
        summary: '未安装 Java',
        detail: '该服务器上无法使用 java 命令。',
      });
    } else if (/JAVA_HOME is not set/i.test(jdkSection.output)) {
      items.push({
        key: 'jdk',
        title: 'Java',
        status: 'warning',
        summary: '已安装 Java，但缺少 JAVA_HOME',
        detail: '服务器存在 java 命令，但未配置 JAVA_HOME。',
      });
    } else {
      items.push({
        key: 'jdk',
        title: 'Java',
        status: 'healthy',
        summary: '已检测到 Java 环境',
        detail: 'java 命令可用，且 JAVA_HOME 已配置。',
      });
    }
  }

  return items;
};

const addAlert = (alerts: LinuxServerAlert[], level: LinuxServerAlert['level'], title: string, detail: string): void => {
  alerts.push({ level, title, detail });
};

const buildAlerts = (
  sections: LinuxServerSection[],
  summary: LinuxServerInspectResult['summary'],
  certificates: LinuxServerCertificate[],
  inspectedKeys: Set<LinuxServerSectionKey>,
): LinuxServerAlert[] => {
  const alerts: LinuxServerAlert[] = [];

  if (inspectedKeys.has('memory') && summary.memoryUsagePercent !== undefined) {
    if (summary.memoryUsagePercent >= 90) {
      addAlert(alerts, 'error', '内存使用率过高', `当前内存使用率为 ${summary.memoryUsagePercent}%。`);
    } else if (summary.memoryUsagePercent >= 80) {
      addAlert(alerts, 'warning', '内存使用率偏高', `当前内存使用率为 ${summary.memoryUsagePercent}%。`);
    } else {
      addAlert(alerts, 'info', '内存使用正常', `当前内存使用率为 ${summary.memoryUsagePercent}%。`);
    }
  }

  if (inspectedKeys.has('disk') && summary.highestDiskUsagePercent !== undefined) {
    if (summary.highestDiskUsagePercent >= 90) {
      addAlert(alerts, 'error', '磁盘使用率过高', `最高文件系统使用率为 ${summary.highestDiskUsagePercent}%。`);
    } else if (summary.highestDiskUsagePercent >= 80) {
      addAlert(alerts, 'warning', '磁盘使用率偏高', `最高文件系统使用率为 ${summary.highestDiskUsagePercent}%。`);
    } else {
      addAlert(alerts, 'info', '磁盘使用正常', `最高文件系统使用率为 ${summary.highestDiskUsagePercent}%。`);
    }
  }

  if (inspectedKeys.has('ports') && summary.openPortCount !== undefined) {
    if (summary.openPortCount >= 20) {
      addAlert(alerts, 'warning', '监听端口较多', `检测到 ${summary.openPortCount} 条监听端口记录。`);
    } else {
      addAlert(alerts, 'info', '已采集监听端口', `检测到 ${summary.openPortCount} 条监听端口记录。`);
    }
  }

  if (inspectedKeys.has('ports') && (summary.riskyPortCount || 0) > 0) {
    addAlert(
      alerts,
      'warning',
      '发现高风险公网端口',
      `检测到 ${summary.riskyPortCount} 个高风险公网端口：${(summary.riskyPorts || []).join(', ')}。`,
    );
  }

  const jdkSection = sections.find((item) => item.key === 'jdk');
  if (inspectedKeys.has('jdk') && jdkSection) {
    if (/java not installed/i.test(jdkSection.output)) {
      addAlert(alerts, 'warning', '未安装 Java', '该服务器未安装 Java。');
    } else if (/JAVA_HOME is not set/i.test(jdkSection.output)) {
      addAlert(alerts, 'warning', '缺少 JAVA_HOME', '服务器存在 Java，但未设置 JAVA_HOME。');
    } else {
      addAlert(alerts, 'info', '已检测到 Java', 'java 命令可正常使用。');
    }
  }

  const dockerImagesSection = sections.find((item) => item.key === 'dockerImages');
  if (hasAnyKey(inspectedKeys, ['dockerImages', 'dockerContainers']) && dockerImagesSection && /docker not installed/i.test(dockerImagesSection.output)) {
    addAlert(alerts, 'info', '未检测到 Docker', '该服务器未安装 Docker。');
  } else if (hasAnyKey(inspectedKeys, ['dockerImages', 'dockerContainers']) && (summary.dockerContainerCount || 0) > 0) {
    const stoppedCount = (summary.dockerContainerCount || 0) - (summary.dockerRunningCount || 0);
    if (stoppedCount > 0) {
      addAlert(alerts, 'warning', '存在未运行的 Docker 容器', `${summary.dockerContainerCount || 0} 个容器中有 ${stoppedCount} 个未运行。`);
    } else {
      addAlert(alerts, 'info', 'Docker 容器状态正常', `${summary.dockerRunningCount || 0} / ${summary.dockerContainerCount || 0} 个容器正在运行。`);
    }
  }

  const nginxSection = sections.find((item) => item.key === 'nginx');
  if (hasAnyKey(inspectedKeys, ['nginx', 'nginxCerts']) && nginxSection) {
    if (/nginx not installed/i.test(nginxSection.output)) {
      addAlert(alerts, 'info', '未检测到 Nginx', '该服务器未安装 Nginx。');
    } else if (/test failed/i.test(nginxSection.output) || /emerg|failed/i.test(nginxSection.output)) {
      addAlert(alerts, 'error', 'Nginx 配置检查失败', 'nginx -t 检测到配置问题。');
    } else if (/syntax is ok/i.test(nginxSection.output) || /test is successful/i.test(nginxSection.output)) {
      addAlert(alerts, 'info', 'Nginx 配置正常', 'nginx -t 执行成功。');
    }
  }

  if (inspectedKeys.has('systemd') && (summary.failedServiceCount || 0) > 0) {
    addAlert(alerts, 'warning', '存在失败的 Systemd 服务', `检测到 ${summary.failedServiceCount} 个失败的 systemd 服务。`);
  } else if (inspectedKeys.has('systemd') && summary.failedServiceCount === 0) {
    addAlert(alerts, 'info', 'Systemd 服务正常', '未发现失败的 systemd 服务。');
  }

  if (inspectedKeys.has('processes') && summary.topCpuProcess) {
    addAlert(alerts, 'info', '已采集最高 CPU 占用进程', `最高 CPU 占用进程：${summary.topCpuProcess}。`);
  }

  if (inspectedKeys.has('processes') && summary.topMemoryProcess) {
    addAlert(alerts, 'info', '已采集最高内存占用进程', `最高内存占用进程：${summary.topMemoryProcess}。`);
  }

  if (inspectedKeys.has('diskTop') && summary.largestDirectory) {
    addAlert(alerts, 'info', '已识别最大目录', `采样结果中最大的目录为：${summary.largestDirectory}。`);
  }

  if (inspectedKeys.has('journal') && (summary.recentErrorCount || 0) > 0) {
    addAlert(
      alerts,
      summary.recentErrorCount >= 10 ? 'warning' : 'info',
      '发现近期错误日志',
      `采集到 ${summary.recentErrorCount} 条近期错误日志。${summary.recentErrorPreview ? ` 示例：${summary.recentErrorPreview}` : ''}`,
    );
  }

  if (inspectedKeys.has('security') && summary.rootLogin === 'yes') {
    addAlert(alerts, 'warning', '已开启 Root 登录', '当前已开启 SSH root 登录。');
  }

  if (inspectedKeys.has('security') && summary.passwordAuthentication === 'yes') {
    addAlert(alerts, 'warning', '已开启密码认证', '当前已开启 SSH 密码认证。');
  }

  if (inspectedKeys.has('security') && summary.firewallStatus) {
    if (/inactive|not running|dead|unknown/i.test(summary.firewallStatus)) {
      addAlert(alerts, 'warning', '防火墙状态需关注', `当前防火墙状态：${summary.firewallStatus}。`);
    } else {
      addAlert(alerts, 'info', '已采集防火墙状态', `当前防火墙状态：${summary.firewallStatus}。`);
    }
  }

  if (inspectedKeys.has('security') && summary.failedLoginCount !== undefined && summary.failedLoginCount >= 5) {
    addAlert(alerts, 'warning', '失败登录次数较多', `近期发现 ${summary.failedLoginCount} 条失败登录记录。`);
  }

  if (inspectedKeys.has('security') && (summary.failedLoginIpCount || 0) > 0) {
    addAlert(
      alerts,
      (summary.failedLoginIpCount || 0) >= 3 ? 'warning' : 'info',
      '已识别失败登录来源',
      `失败登录来源：${(summary.failedLoginSources || []).join(', ')}。`,
    );
  }

  const expiredCertificates = certificates.filter((item) => item.status === 'expired');
  const expiringCertificates = certificates.filter((item) => item.status === 'expiring');

  if (inspectedKeys.has('nginxCerts') && expiredCertificates.length > 0) {
    addAlert(alerts, 'error', '存在已过期证书', `${expiredCertificates.length} 个证书已经过期。`);
  } else if (inspectedKeys.has('nginxCerts') && expiringCertificates.length > 0) {
    addAlert(alerts, 'warning', '证书即将过期', `${expiringCertificates.length} 个证书将在 30 天内过期。`);
  } else if (inspectedKeys.has('nginxCerts') && certificates.length > 0) {
    addAlert(alerts, 'info', '证书状态正常', `共检查 ${certificates.length} 个证书文件。`);
  }

  const severityRank: Record<LinuxServerAlert['level'], number> = {
    error: 0,
    warning: 1,
    info: 2,
  };

  return alerts.sort((left, right) => severityRank[left.level] - severityRank[right.level]);
};

const buildScore = (
  summary: LinuxServerInspectResult['summary'],
  sections: LinuxServerSection[],
  certificates: LinuxServerCertificate[],
  inspectedKeys: Set<LinuxServerSectionKey>,
): LinuxServerInspectResult['score'] => {
  const breakdown: LinuxServerScoreBreakdown[] = [];

  if (hasAnyKey(inspectedKeys, ['memory', 'disk'])) {
    let resourceScore = 25;
    const resourceNotes: string[] = [];
    if (inspectedKeys.has('memory') && summary.memoryUsagePercent !== undefined) {
      if (summary.memoryUsagePercent >= 90) {
        resourceScore -= 13;
        resourceNotes.push(`内存 ${summary.memoryUsagePercent}%`);
      } else if (summary.memoryUsagePercent >= 80) {
        resourceScore -= 7;
        resourceNotes.push(`内存 ${summary.memoryUsagePercent}%`);
      }
    }
    if (inspectedKeys.has('disk') && summary.highestDiskUsagePercent !== undefined) {
      if (summary.highestDiskUsagePercent >= 90) {
        resourceScore -= 12;
        resourceNotes.push(`磁盘 ${summary.highestDiskUsagePercent}%`);
      } else if (summary.highestDiskUsagePercent >= 80) {
        resourceScore -= 6;
        resourceNotes.push(`磁盘 ${summary.highestDiskUsagePercent}%`);
      }
    }
    breakdown.push({
      label: '资源使用',
      score: Math.max(0, resourceScore),
      maxScore: 25,
      detail: resourceNotes.length > 0 ? `关注项：${resourceNotes.join('，')}。` : '内存和磁盘使用整体稳定。',
    });
  }

  if (hasAnyKey(inspectedKeys, ['systemd', 'dockerContainers'])) {
    let runtimeScore = 20;
    const runtimeNotes: string[] = [];
    if (inspectedKeys.has('systemd') && (summary.failedServiceCount || 0) > 0) {
      runtimeScore -= Math.min(10, (summary.failedServiceCount || 0) * 2);
      runtimeNotes.push(`${summary.failedServiceCount} 个失败服务`);
    }
    if (inspectedKeys.has('dockerContainers')) {
      const stoppedContainers = Math.max((summary.dockerContainerCount || 0) - (summary.dockerRunningCount || 0), 0);
      if (stoppedContainers > 0) {
        runtimeScore -= Math.min(10, stoppedContainers * 2);
        runtimeNotes.push(`${stoppedContainers} 个已停止容器`);
      }
    }
    breakdown.push({
      label: '运行时服务',
      score: Math.max(0, runtimeScore),
      maxScore: 20,
      detail: runtimeNotes.length > 0 ? `需要关注：${runtimeNotes.join('，')}。` : '未发现明显的运行时服务异常。',
    });
  }

  if (inspectedKeys.has('journal')) {
    let loggingScore = 10;
    if ((summary.recentErrorCount || 0) >= 10) {
      loggingScore -= 6;
    } else if ((summary.recentErrorCount || 0) > 0) {
      loggingScore -= 3;
    }
    breakdown.push({
      label: '近期错误日志',
      score: Math.max(0, loggingScore),
      maxScore: 10,
      detail:
        (summary.recentErrorCount || 0) > 0
          ? `共采集到 ${summary.recentErrorCount} 条近期错误日志。${summary.recentErrorPreview ? ` 示例：${summary.recentErrorPreview}` : ''}`
          : '未从 journal 或备用日志中采集到近期错误日志。',
    });
  }

  if (inspectedKeys.has('ports')) {
    let networkScore = 10;
    if (summary.openPortCount !== undefined && summary.openPortCount >= 20) {
      networkScore -= 4;
    }
    if ((summary.riskyPortCount || 0) > 0) {
      networkScore -= Math.min(6, (summary.riskyPortCount || 0) * 2);
    }
    breakdown.push({
      label: '网络暴露面',
      score: Math.max(0, networkScore),
      maxScore: 10,
      detail:
        summary.openPortCount !== undefined
          ? `共采集到 ${summary.openPortCount} 条监听端口记录。${(summary.riskyPortCount || 0) > 0 ? ` 高风险公网端口：${(summary.riskyPorts || []).join('，')}。` : ''}`
          : '未能获取监听端口数量。',
    });
  }

  if (inspectedKeys.has('processes')) {
    const processScore = 10;
    const processNotes: string[] = [];
    if (summary.topCpuProcess) {
      processNotes.push(`CPU Top ${summary.topCpuProcess}`);
    }
    if (summary.topMemoryProcess && summary.topMemoryProcess !== summary.topCpuProcess) {
      processNotes.push(`内存 Top ${summary.topMemoryProcess}`);
    }
    breakdown.push({
      label: '高占用进程',
      score: Math.max(0, processScore),
      maxScore: 10,
      detail: processNotes.length > 0 ? `已采集：${processNotes.join('；')}。` : '未能获取 CPU 和内存占用最高的进程信息。',
    });
  }

  if (inspectedKeys.has('nginx')) {
    let nginxScore = 15;
    const nginxSection = sections.find((item) => item.key === 'nginx');
    if (nginxSection && !/nginx not installed/i.test(nginxSection.output)) {
      if (/test failed/i.test(nginxSection.output) || /emerg|failed/i.test(nginxSection.output)) {
        nginxScore -= 12;
      }
    }
    breakdown.push({
      label: 'Nginx 配置',
      score: Math.max(0, nginxScore),
      maxScore: 15,
      detail:
        !nginxSection || /nginx not installed/i.test(nginxSection.output)
          ? '该服务器未检测到 Nginx。'
          : /syntax is ok/i.test(nginxSection.output) || /test is successful/i.test(nginxSection.output)
            ? 'nginx -t 执行成功。'
            : 'nginx -t 输出需要人工复核。',
    });
  }

  if (inspectedKeys.has('nginxCerts')) {
    let certificateScore = 15;
    const expiredCertificates = certificates.filter((item) => item.status === 'expired').length;
    const expiringCertificates = certificates.filter((item) => item.status === 'expiring').length;
    certificateScore -= Math.min(15, expiredCertificates * 8 + expiringCertificates * 4);
    breakdown.push({
      label: '证书状态',
      score: Math.max(0, certificateScore),
      maxScore: 15,
      detail:
        certificates.length === 0
          ? '未采集到 Nginx 证书信息。'
          : expiredCertificates > 0
            ? `检测到 ${expiredCertificates} 个已过期证书。`
            : expiringCertificates > 0
              ? `${expiringCertificates} 个证书将在 30 天内过期。`
              : `${certificates.length} 个证书状态正常。`,
    });
  }

  if (inspectedKeys.has('security')) {
    let securityScore = 15;
    const securityNotes: string[] = [];
    if (summary.rootLogin === 'yes') {
      securityScore -= 5;
      securityNotes.push('已开启 SSH root 登录');
    }
    if (summary.passwordAuthentication === 'yes') {
      securityScore -= 5;
      securityNotes.push('已开启密码认证');
    }
    if (summary.firewallStatus && /inactive|not running|dead|unknown/i.test(summary.firewallStatus)) {
      securityScore -= 3;
      securityNotes.push(`防火墙 ${summary.firewallStatus}`);
    }
    if (summary.failedLoginCount !== undefined && summary.failedLoginCount >= 5) {
      securityScore -= 2;
      securityNotes.push(`${summary.failedLoginCount} 次失败登录`);
    }
    if ((summary.failedLoginIpCount || 0) >= 3) {
      securityScore -= 2;
      securityNotes.push(`${summary.failedLoginIpCount} 个失败登录来源 IP`);
    }
    breakdown.push({
      label: '安全基线',
      score: Math.max(0, securityScore),
      maxScore: 15,
      detail: securityNotes.length > 0 ? `建议重点检查：${securityNotes.join('，')}。` : '从采集结果看，SSH 与防火墙基线基本正常。',
    });
  }

  const totalScore = breakdown.reduce((total, item) => total + item.score, 0);
  const totalMaxScore = breakdown.reduce((total, item) => total + item.maxScore, 0);
  const overall = totalMaxScore > 0 ? Math.round((totalScore / totalMaxScore) * 100) : 100;
  const label = overall >= 90 ? '优秀' : overall >= 75 ? '良好' : overall >= 60 ? '需关注' : '高风险';

  return {
    overall,
    label,
    breakdown,
  };
};

const buildHighlights = (
  summary: LinuxServerInspectResult['summary'],
  certificates: LinuxServerCertificate[],
  alerts: LinuxServerAlert[],
  inspectedKeys: Set<LinuxServerSectionKey>,
): string[] => {
  const highlights: string[] = [];

  if (inspectedKeys.has('memory') && summary.memoryUsagePercent !== undefined) {
    highlights.push(`内存使用率 ${summary.memoryUsagePercent}%。`);
  }

  if (inspectedKeys.has('disk') && summary.highestDiskUsagePercent !== undefined) {
    highlights.push(`最高磁盘使用率 ${summary.highestDiskUsagePercent}%。`);
  }

  if (inspectedKeys.has('systemd') && (summary.failedServiceCount || 0) > 0) {
    highlights.push(`检测到 ${summary.failedServiceCount} 个失败的 systemd 服务。`);
  }

  if (inspectedKeys.has('processes') && summary.topCpuProcess) {
    highlights.push(`最高 CPU 占用进程：${summary.topCpuProcess}。`);
  }

  if (inspectedKeys.has('diskTop') && summary.largestDirectory) {
    highlights.push(`采样结果中最大目录：${summary.largestDirectory}。`);
  }

  if (inspectedKeys.has('ports') && (summary.riskyPortCount || 0) > 0) {
    highlights.push(`高风险公网端口：${(summary.riskyPorts || []).join('，')}。`);
  }

  if (inspectedKeys.has('journal') && (summary.recentErrorCount || 0) > 0) {
    highlights.push(`近期错误日志条数：${summary.recentErrorCount}。`);
  }

  if (inspectedKeys.has('security') && summary.topFailedLoginIp) {
    highlights.push(`失败登录最高来源：${summary.topFailedLoginIp}。`);
  }

  if (inspectedKeys.has('security') && summary.rootLogin === 'yes') {
    highlights.push('当前已开启 SSH root 登录。');
  }

  if (inspectedKeys.has('security') && summary.passwordAuthentication === 'yes') {
    highlights.push('当前已开启 SSH 密码认证。');
  }

  const earliestCertificate = certificates
    .filter((item) => item.daysRemaining !== undefined)
    .sort((left, right) => (left.daysRemaining || 0) - (right.daysRemaining || 0))[0];
  if (inspectedKeys.has('nginxCerts') && earliestCertificate?.daysRemaining !== undefined) {
    highlights.push(`最早到期证书将在 ${earliestCertificate.daysRemaining} 天后过期。`);
  }

  if (highlights.length === 0) {
    const firstMeaningfulAlert = alerts.find((item) => item.level !== 'info') || alerts[0];
    if (firstMeaningfulAlert) {
      highlights.push(firstMeaningfulAlert.detail);
    }
  }

  return highlights.slice(0, 6);
};

const execCommand = (client: Client, command: string, timeoutMs = DEFAULT_COMMAND_TIMEOUT_MS): Promise<string> =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`命令执行超时，超过 ${timeoutMs}ms。`));
    }, timeoutMs);

    client.exec(`export LANG=C; export LC_ALL=C; ${command}`, (error: Error | undefined, stream: ExecStream) => {
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
      readyTimeout: SSH_READY_TIMEOUT_MS,
      keepaliveInterval: 5000,
      keepaliveCountMax: 2,
      hostVerifier: () => true,
    };

    client.once('ready', () => resolve(client));
    client.once('error', (error: Error) => reject(error));
    client.connect(config);
  });

export const inspectLinuxServer = async (
  credentials: LinuxServerCredentials,
  scope: LinuxInspectScope = 'full',
): Promise<LinuxServerInspectResult> => {
  const port = credentials.port || 22;
  const inspectedAt = new Date().toISOString();
  const client = await connect(credentials);

  try {
    const commandKeys = SCOPE_COMMAND_KEYS[scope] || SCOPE_COMMAND_KEYS.full;
    const inspectedKeys = new Set<LinuxServerSectionKey>(commandKeys);
    const commandsToRun = COMMANDS.filter((item) => inspectedKeys.has(item.key));
    const sections: LinuxServerSection[] = [];
    const failedSections: string[] = [];

    for (const item of commandsToRun) {
      let output: string;

      try {
        output = await execCommand(client, item.command, item.timeoutMs);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        failedSections.push(item.title);
        output = normalizeOutput(`[采集失败] ${message}`);
      }

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
    const processesSection = sections.find((item) => item.key === 'processes');
    const journalSection = sections.find((item) => item.key === 'journal');
    const dockerContainersSection = sections.find((item) => item.key === 'dockerContainers');
    const nginxCertsSection = sections.find((item) => item.key === 'nginxCerts');
    const systemdSection = sections.find((item) => item.key === 'systemd');
    const securitySection = sections.find((item) => item.key === 'security');
    const diskTopSection = sections.find((item) => item.key === 'diskTop');

    const summary = summarySection ? parseSummary(summarySection.output) : {};
    summary.memoryUsagePercent = memorySection ? parseMemoryUsagePercent(memorySection.output) : undefined;
    summary.highestDiskUsagePercent = diskSection ? parseHighestDiskUsagePercent(diskSection.output) : undefined;
    summary.openPortCount = portsSection ? parseOpenPortCount(portsSection.output) : undefined;
    summary.riskyPorts = portsSection ? parseRiskyPorts(portsSection.output) : [];
    summary.riskyPortCount = summary.riskyPorts.length;

    const dockerCounts = dockerContainersSection ? parseDockerContainerCounts(dockerContainersSection.output) : { total: 0, running: 0 };
    summary.dockerContainerCount = dockerCounts.total;
    summary.dockerRunningCount = dockerCounts.running;

    const certificates = nginxCertsSection ? parseNginxCertificates(nginxCertsSection.output) : [];
    summary.nginxCertificateCount = certificates.length;
    summary.expiredCertificateCount = certificates.filter((item) => item.status === 'expired').length;
    summary.expiringCertificateCount = certificates.filter((item) => item.status === 'expiring').length;

    const certificateDays = certificates
      .map((item) => item.daysRemaining)
      .filter((value): value is number => value !== undefined && Number.isFinite(value));
    summary.earliestCertificateExpiryDays = certificateDays.length > 0 ? Math.min(...certificateDays) : undefined;

    summary.failedServiceCount = systemdSection ? parseFailedServiceCount(systemdSection.output) : undefined;
    summary.topCpuProcess = processesSection ? parseTopEntryFromBlock(processesSection.output, 'TOP_CPU_START', 'TOP_CPU_END') : undefined;
    summary.topMemoryProcess = processesSection ? parseTopEntryFromBlock(processesSection.output, 'TOP_MEM_START', 'TOP_MEM_END') : undefined;
    summary.largestDirectory = diskTopSection ? parseLargestDirectory(diskTopSection.output) : undefined;
    const recentErrorSummary = journalSection ? parseRecentErrorSummary(journalSection.output) : { count: 0 };
    summary.recentErrorCount = recentErrorSummary.count;
    summary.recentErrorPreview = recentErrorSummary.preview;

    const securitySummary = securitySection ? parseSecuritySummary(securitySection.output) : {};
    summary.rootLogin = securitySummary.rootLogin;
    summary.passwordAuthentication = securitySummary.passwordAuthentication;
    summary.firewallStatus = securitySummary.firewallStatus;
    summary.selinuxStatus = securitySummary.selinuxStatus;
    summary.failedLoginCount = securitySummary.failedLoginCount;

    const alerts = buildAlerts(sections, summary, certificates, inspectedKeys);
    const score = buildScore(summary, sections, certificates, inspectedKeys);
    const highlights = buildHighlights(summary, certificates, alerts, inspectedKeys);
    const serviceHealth = buildServiceHealth(sections, summary, inspectedKeys);

    if (failedSections.length > 0) {
      alerts.unshift({
        level: 'warning',
        title: '部分巡检项采集失败',
        detail: `以下巡检项未能成功采集：${failedSections.join('，')}。`,
      });
    }

    const errorCount = alerts.filter((item) => item.level === 'error').length;
    const warningCount = alerts.filter((item) => item.level === 'warning').length;
    const message =
      failedSections.length > 0
        ? `巡检已完成，但存在部分数据缺失，共有 ${failedSections.length} 项未能成功采集。`
        : errorCount > 0 || warningCount > 0
        ? `巡检完成，发现 ${errorCount} 个严重问题和 ${warningCount} 个告警。`
        : '巡检完成，当前采集结果中未发现明显风险。';

    return {
      success: true,
      message,
      inspectedAt,
      server: {
        host: credentials.host,
        port,
        username: credentials.username,
      },
      summary,
      score,
      highlights,
      alerts,
      certificates,
      serviceHealth,
      sections,
    };
  } finally {
    client.end();
  }
};

const QUICK_ACTIONS: Record<LinuxQuickAction, { title: string; command: string; timeoutMs?: number }> = {
  nginxConfig: {
    title: 'Nginx 配置内容',
    command: `
if command -v nginx >/dev/null 2>&1; then
  nginx -T 2>&1
else
  echo 'nginx not installed'
fi
`.trim(),
    timeoutMs: LONG_RUNNING_COMMAND_TIMEOUT_MS,
  },
  restartNginx: {
    title: '重启 Nginx',
    command: `
if command -v systemctl >/dev/null 2>&1; then
  systemctl restart nginx 2>&1 && systemctl status nginx --no-pager -n 20 2>&1
elif command -v service >/dev/null 2>&1; then
  service nginx restart 2>&1 && service nginx status 2>&1
elif command -v nginx >/dev/null 2>&1; then
  nginx -s reload 2>&1
else
  echo 'nginx not installed'
fi
`.trim(),
    timeoutMs: DEFAULT_COMMAND_TIMEOUT_MS,
  },
};

export const runLinuxQuickAction = async (
  credentials: LinuxServerCredentials,
  action: LinuxQuickAction,
): Promise<LinuxQuickActionResult> => {
  const quickAction = QUICK_ACTIONS[action];
  if (!quickAction) {
    throw new Error('不支持的 Linux 快捷工具。');
  }

  const client = await connect(credentials);
  const inspectedAt = new Date().toISOString();

  try {
    const output = await execCommand(client, quickAction.command, quickAction.timeoutMs);
    return {
      success: true,
      message: `${quickAction.title}执行完成。`,
      inspectedAt,
      action,
      title: quickAction.title,
      command: quickAction.command,
      output,
    };
  } finally {
    client.end();
  }
};
