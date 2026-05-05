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

type CommandDefinition = {
  key: LinuxServerSectionKey;
  title: string;
  command: string;
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
    key: 'diskTop',
    title: 'Large Directories',
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
    key: 'processes',
    title: 'Top Processes',
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
    title: 'Recent Error Logs',
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
  {
    key: 'systemd',
    title: 'Systemd Services',
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
    title: 'Security Baseline',
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

const buildServiceHealth = (
  sections: LinuxServerSection[],
  summary: LinuxServerInspectResult['summary'],
): LinuxServiceHealth[] => {
  const items: LinuxServiceHealth[] = [];

  const dockerImagesSection = sections.find((item) => item.key === 'dockerImages');
  if (!dockerImagesSection || /docker not installed/i.test(dockerImagesSection.output)) {
    items.push({
      key: 'docker',
      title: 'Docker',
      status: 'missing',
      summary: 'Docker not installed',
      detail: 'docker command is unavailable on this server.',
    });
  } else {
    const stoppedCount = Math.max((summary.dockerContainerCount || 0) - (summary.dockerRunningCount || 0), 0);
    items.push({
      key: 'docker',
      title: 'Docker',
      status: stoppedCount > 0 ? 'warning' : 'healthy',
      summary:
        (summary.dockerContainerCount || 0) > 0
          ? `${summary.dockerRunningCount || 0}/${summary.dockerContainerCount || 0} containers running`
          : 'Docker installed, no containers detected',
      detail:
        stoppedCount > 0
          ? `${stoppedCount} container(s) are not running.`
          : 'No stopped containers were detected from the collected output.',
    });
  }

  const nginxSection = sections.find((item) => item.key === 'nginx');
  if (!nginxSection || /nginx not installed/i.test(nginxSection.output)) {
    items.push({
      key: 'nginx',
      title: 'Nginx',
      status: 'missing',
      summary: 'Nginx not installed',
      detail: 'nginx command is unavailable on this server.',
    });
  } else if (/test failed/i.test(nginxSection.output) || /emerg|failed/i.test(nginxSection.output)) {
    items.push({
      key: 'nginx',
      title: 'Nginx',
      status: 'error',
      summary: 'Configuration check failed',
      detail: 'nginx -t reported an error and needs attention.',
    });
  } else {
    items.push({
      key: 'nginx',
      title: 'Nginx',
      status: 'healthy',
      summary: 'Configuration check passed',
      detail:
        summary.earliestCertificateExpiryDays !== undefined
          ? `Earliest certificate expires in ${summary.earliestCertificateExpiryDays} day(s).`
          : 'nginx -t completed successfully.',
    });
  }

  const jdkSection = sections.find((item) => item.key === 'jdk');
  if (!jdkSection || /java not installed/i.test(jdkSection.output)) {
    items.push({
      key: 'jdk',
      title: 'Java',
      status: 'missing',
      summary: 'Java not installed',
      detail: 'java command is unavailable on this server.',
    });
  } else if (/JAVA_HOME is not set/i.test(jdkSection.output)) {
    items.push({
      key: 'jdk',
      title: 'Java',
      status: 'warning',
      summary: 'Java available, JAVA_HOME missing',
      detail: 'java exists but JAVA_HOME is not configured.',
    });
  } else {
    items.push({
      key: 'jdk',
      title: 'Java',
      status: 'healthy',
      summary: 'Java environment detected',
      detail: 'java command is available and JAVA_HOME is configured.',
    });
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
): LinuxServerAlert[] => {
  const alerts: LinuxServerAlert[] = [];

  if (summary.memoryUsagePercent !== undefined) {
    if (summary.memoryUsagePercent >= 90) {
      addAlert(alerts, 'error', 'Memory Usage High', `Memory usage is ${summary.memoryUsagePercent}%.`);
    } else if (summary.memoryUsagePercent >= 80) {
      addAlert(alerts, 'warning', 'Memory Usage Warning', `Memory usage is ${summary.memoryUsagePercent}%.`);
    } else {
      addAlert(alerts, 'info', 'Memory Usage Normal', `Memory usage is ${summary.memoryUsagePercent}%.`);
    }
  }

  if (summary.highestDiskUsagePercent !== undefined) {
    if (summary.highestDiskUsagePercent >= 90) {
      addAlert(alerts, 'error', 'Disk Usage High', `Highest filesystem usage is ${summary.highestDiskUsagePercent}%.`);
    } else if (summary.highestDiskUsagePercent >= 80) {
      addAlert(alerts, 'warning', 'Disk Usage Warning', `Highest filesystem usage is ${summary.highestDiskUsagePercent}%.`);
    } else {
      addAlert(alerts, 'info', 'Disk Usage Normal', `Highest filesystem usage is ${summary.highestDiskUsagePercent}%.`);
    }
  }

  if (summary.openPortCount !== undefined) {
    if (summary.openPortCount >= 20) {
      addAlert(alerts, 'warning', 'Listening Ports Dense', `${summary.openPortCount} listening port record(s) were detected.`);
    } else {
      addAlert(alerts, 'info', 'Listening Ports Collected', `${summary.openPortCount} listening port record(s) were detected.`);
    }
  }

  if ((summary.riskyPortCount || 0) > 0) {
    addAlert(
      alerts,
      'warning',
      'Public Risk Ports Detected',
      `${summary.riskyPortCount} risky public-facing port(s) detected: ${(summary.riskyPorts || []).join(', ')}.`,
    );
  }

  const jdkSection = sections.find((item) => item.key === 'jdk');
  if (jdkSection) {
    if (/java not installed/i.test(jdkSection.output)) {
      addAlert(alerts, 'warning', 'JDK Missing', 'java is not installed on this server.');
    } else if (/JAVA_HOME is not set/i.test(jdkSection.output)) {
      addAlert(alerts, 'warning', 'JAVA_HOME Missing', 'Java exists but JAVA_HOME is not set.');
    } else {
      addAlert(alerts, 'info', 'JDK Detected', 'java command is available.');
    }
  }

  const dockerImagesSection = sections.find((item) => item.key === 'dockerImages');
  if (dockerImagesSection && /docker not installed/i.test(dockerImagesSection.output)) {
    addAlert(alerts, 'info', 'Docker Not Detected', 'docker command is not installed.');
  } else if ((summary.dockerContainerCount || 0) > 0) {
    const stoppedCount = (summary.dockerContainerCount || 0) - (summary.dockerRunningCount || 0);
    if (stoppedCount > 0) {
      addAlert(alerts, 'warning', 'Stopped Docker Containers', `${stoppedCount} container(s) are not running out of ${summary.dockerContainerCount || 0}.`);
    } else {
      addAlert(alerts, 'info', 'Docker Containers Healthy', `${summary.dockerRunningCount || 0} / ${summary.dockerContainerCount || 0} container(s) are running.`);
    }
  }

  const nginxSection = sections.find((item) => item.key === 'nginx');
  if (nginxSection) {
    if (/nginx not installed/i.test(nginxSection.output)) {
      addAlert(alerts, 'info', 'Nginx Not Detected', 'nginx command is not installed.');
    } else if (/test failed/i.test(nginxSection.output) || /emerg|failed/i.test(nginxSection.output)) {
      addAlert(alerts, 'error', 'Nginx Config Check Failed', 'nginx -t reported a configuration problem.');
    } else if (/syntax is ok/i.test(nginxSection.output) || /test is successful/i.test(nginxSection.output)) {
      addAlert(alerts, 'info', 'Nginx Config Valid', 'nginx -t completed successfully.');
    }
  }

  if ((summary.failedServiceCount || 0) > 0) {
    addAlert(alerts, 'warning', 'Failed Systemd Services', `${summary.failedServiceCount} failed service(s) were detected.`);
  } else if (summary.failedServiceCount === 0) {
    addAlert(alerts, 'info', 'Systemd Healthy', 'No failed systemd service was reported.');
  }

  if (summary.topCpuProcess) {
    addAlert(alerts, 'info', 'Top CPU Process Collected', `Top CPU process: ${summary.topCpuProcess}.`);
  }

  if (summary.topMemoryProcess) {
    addAlert(alerts, 'info', 'Top Memory Process Collected', `Top memory process: ${summary.topMemoryProcess}.`);
  }

  if (summary.largestDirectory) {
    addAlert(alerts, 'info', 'Large Directory Identified', `Largest sampled directory: ${summary.largestDirectory}.`);
  }

  if ((summary.recentErrorCount || 0) > 0) {
    addAlert(
      alerts,
      summary.recentErrorCount >= 10 ? 'warning' : 'info',
      'Recent Error Logs Found',
      `${summary.recentErrorCount} recent error log line(s) were collected.${summary.recentErrorPreview ? ` Sample: ${summary.recentErrorPreview}` : ''}`,
    );
  }

  if (summary.rootLogin === 'yes') {
    addAlert(alerts, 'warning', 'Root Login Enabled', 'SSH root login is enabled.');
  }

  if (summary.passwordAuthentication === 'yes') {
    addAlert(alerts, 'warning', 'Password Authentication Enabled', 'SSH password authentication is enabled.');
  }

  if (summary.firewallStatus) {
    if (/inactive|not running|dead|unknown/i.test(summary.firewallStatus)) {
      addAlert(alerts, 'warning', 'Firewall Needs Review', `Firewall status: ${summary.firewallStatus}.`);
    } else {
      addAlert(alerts, 'info', 'Firewall Status Collected', `Firewall status: ${summary.firewallStatus}.`);
    }
  }

  if (summary.failedLoginCount !== undefined && summary.failedLoginCount >= 5) {
    addAlert(alerts, 'warning', 'Repeated Failed Logins', `${summary.failedLoginCount} recent failed login record(s) were found.`);
  }

  if ((summary.failedLoginIpCount || 0) > 0) {
    addAlert(
      alerts,
      (summary.failedLoginIpCount || 0) >= 3 ? 'warning' : 'info',
      'Failed Login Sources Identified',
      `Failed login source(s): ${(summary.failedLoginSources || []).join(', ')}.`,
    );
  }

  const expiredCertificates = certificates.filter((item) => item.status === 'expired');
  const expiringCertificates = certificates.filter((item) => item.status === 'expiring');

  if (expiredCertificates.length > 0) {
    addAlert(alerts, 'error', 'Expired Certificates', `${expiredCertificates.length} certificate(s) are already expired.`);
  } else if (expiringCertificates.length > 0) {
    addAlert(alerts, 'warning', 'Certificates Expiring Soon', `${expiringCertificates.length} certificate(s) will expire within 30 days.`);
  } else if (certificates.length > 0) {
    addAlert(alerts, 'info', 'Certificates Healthy', `${certificates.length} certificate file(s) were checked.`);
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
): LinuxServerInspectResult['score'] => {
  const breakdown: LinuxServerScoreBreakdown[] = [];

  let resourceScore = 25;
  const resourceNotes: string[] = [];
  if (summary.memoryUsagePercent !== undefined) {
    if (summary.memoryUsagePercent >= 90) {
      resourceScore -= 13;
      resourceNotes.push(`memory ${summary.memoryUsagePercent}%`);
    } else if (summary.memoryUsagePercent >= 80) {
      resourceScore -= 7;
      resourceNotes.push(`memory ${summary.memoryUsagePercent}%`);
    }
  }
  if (summary.highestDiskUsagePercent !== undefined) {
    if (summary.highestDiskUsagePercent >= 90) {
      resourceScore -= 12;
      resourceNotes.push(`disk ${summary.highestDiskUsagePercent}%`);
    } else if (summary.highestDiskUsagePercent >= 80) {
      resourceScore -= 6;
      resourceNotes.push(`disk ${summary.highestDiskUsagePercent}%`);
    }
  }
  breakdown.push({
    label: 'Resources',
    score: Math.max(0, resourceScore),
    maxScore: 25,
    detail: resourceNotes.length > 0 ? `Observed ${resourceNotes.join(', ')}.` : 'Memory and disk usage look stable.',
  });

  let runtimeScore = 20;
  const runtimeNotes: string[] = [];
  if ((summary.failedServiceCount || 0) > 0) {
    runtimeScore -= Math.min(10, (summary.failedServiceCount || 0) * 2);
    runtimeNotes.push(`${summary.failedServiceCount} failed service(s)`);
  }
  const stoppedContainers = Math.max((summary.dockerContainerCount || 0) - (summary.dockerRunningCount || 0), 0);
  if (stoppedContainers > 0) {
    runtimeScore -= Math.min(10, stoppedContainers * 2);
    runtimeNotes.push(`${stoppedContainers} stopped container(s)`);
  }
  breakdown.push({
    label: 'Runtime Services',
    score: Math.max(0, runtimeScore),
    maxScore: 20,
    detail: runtimeNotes.length > 0 ? `Attention needed: ${runtimeNotes.join(', ')}.` : 'No obvious runtime service issue was detected.',
  });

  let loggingScore = 10;
  if ((summary.recentErrorCount || 0) >= 10) {
    loggingScore -= 6;
  } else if ((summary.recentErrorCount || 0) > 0) {
    loggingScore -= 3;
  }
  breakdown.push({
    label: 'Recent Error Logs',
    score: Math.max(0, loggingScore),
    maxScore: 10,
    detail:
      (summary.recentErrorCount || 0) > 0
        ? `${summary.recentErrorCount} recent error log line(s) were collected.${summary.recentErrorPreview ? ` Sample: ${summary.recentErrorPreview}` : ''}`
        : 'No recent error log lines were collected from journal or fallback logs.',
  });

  let networkScore = 10;
  if (summary.openPortCount !== undefined && summary.openPortCount >= 20) {
    networkScore -= 4;
  }
  if ((summary.riskyPortCount || 0) > 0) {
    networkScore -= Math.min(6, (summary.riskyPortCount || 0) * 2);
  }
  breakdown.push({
    label: 'Network Exposure',
    score: Math.max(0, networkScore),
    maxScore: 10,
    detail:
      summary.openPortCount !== undefined
        ? `${summary.openPortCount} listening port record(s) were collected.${(summary.riskyPortCount || 0) > 0 ? ` Risky public ports: ${(summary.riskyPorts || []).join(', ')}.` : ''}`
        : 'Listening port count was not available.',
  });

  const processScore = 10;
  const processNotes: string[] = [];
  if (summary.topCpuProcess) {
    processNotes.push(`cpu top ${summary.topCpuProcess}`);
  }
  if (summary.topMemoryProcess && summary.topMemoryProcess !== summary.topCpuProcess) {
    processNotes.push(`memory top ${summary.topMemoryProcess}`);
  }
  breakdown.push({
    label: 'Top Processes',
    score: Math.max(0, processScore),
    maxScore: 10,
    detail: processNotes.length > 0 ? `Captured ${processNotes.join('; ')}.` : 'Top CPU and memory process details were not available.',
  });

  let nginxScore = 15;
  const nginxSection = sections.find((item) => item.key === 'nginx');
  if (nginxSection && !/nginx not installed/i.test(nginxSection.output)) {
    if (/test failed/i.test(nginxSection.output) || /emerg|failed/i.test(nginxSection.output)) {
      nginxScore -= 12;
    }
  }
  breakdown.push({
    label: 'Nginx Configuration',
    score: Math.max(0, nginxScore),
    maxScore: 15,
    detail:
      !nginxSection || /nginx not installed/i.test(nginxSection.output)
        ? 'Nginx was not detected on this server.'
        : /syntax is ok/i.test(nginxSection.output) || /test is successful/i.test(nginxSection.output)
          ? 'nginx -t completed successfully.'
          : 'nginx -t output needs review.',
  });

  let certificateScore = 15;
  const expiredCertificates = certificates.filter((item) => item.status === 'expired').length;
  const expiringCertificates = certificates.filter((item) => item.status === 'expiring').length;
  certificateScore -= Math.min(15, expiredCertificates * 8 + expiringCertificates * 4);
  breakdown.push({
    label: 'Certificates',
    score: Math.max(0, certificateScore),
    maxScore: 15,
    detail:
      certificates.length === 0
        ? 'No Nginx certificate metadata was collected.'
        : expiredCertificates > 0
          ? `${expiredCertificates} expired certificate(s) detected.`
          : expiringCertificates > 0
            ? `${expiringCertificates} certificate(s) will expire within 30 days.`
            : `${certificates.length} certificate(s) look healthy.`,
  });

  let securityScore = 5;
  const securityNotes: string[] = [];
  if (summary.rootLogin === 'yes') {
    securityScore -= 5;
    securityNotes.push('root SSH login enabled');
  }
  if (summary.passwordAuthentication === 'yes') {
    securityScore -= 5;
    securityNotes.push('password authentication enabled');
  }
  if (summary.firewallStatus && /inactive|not running|dead|unknown/i.test(summary.firewallStatus)) {
    securityScore -= 3;
    securityNotes.push(`firewall ${summary.firewallStatus}`);
  }
  if (summary.failedLoginCount !== undefined && summary.failedLoginCount >= 5) {
    securityScore -= 2;
    securityNotes.push(`${summary.failedLoginCount} failed logins`);
  }
  if ((summary.failedLoginIpCount || 0) >= 3) {
    securityScore -= 2;
    securityNotes.push(`${summary.failedLoginIpCount} failed-login source IPs`);
  }
  breakdown.push({
    label: 'Security Baseline',
    score: Math.max(0, securityScore),
    maxScore: 15,
    detail: securityNotes.length > 0 ? `Review suggested: ${securityNotes.join(', ')}.` : 'SSH and firewall baseline look acceptable from collected data.',
  });

  const overall = breakdown.reduce((total, item) => total + item.score, 0);
  const label = overall >= 90 ? 'Excellent' : overall >= 75 ? 'Good' : overall >= 60 ? 'Needs Attention' : 'High Risk';

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
): string[] => {
  const highlights: string[] = [];

  if (summary.memoryUsagePercent !== undefined) {
    highlights.push(`Memory usage ${summary.memoryUsagePercent}%.`);
  }

  if (summary.highestDiskUsagePercent !== undefined) {
    highlights.push(`Highest disk usage ${summary.highestDiskUsagePercent}%.`);
  }

  if ((summary.failedServiceCount || 0) > 0) {
    highlights.push(`${summary.failedServiceCount} failed systemd service(s) detected.`);
  }

  if (summary.topCpuProcess) {
    highlights.push(`Top CPU process: ${summary.topCpuProcess}.`);
  }

  if (summary.largestDirectory) {
    highlights.push(`Largest sampled directory: ${summary.largestDirectory}.`);
  }

  if ((summary.riskyPortCount || 0) > 0) {
    highlights.push(`Risky public ports: ${(summary.riskyPorts || []).join(', ')}.`);
  }

  if ((summary.recentErrorCount || 0) > 0) {
    highlights.push(`Recent error log lines: ${summary.recentErrorCount}.`);
  }

  if (summary.topFailedLoginIp) {
    highlights.push(`Top failed login source: ${summary.topFailedLoginIp}.`);
  }

  if (summary.rootLogin === 'yes') {
    highlights.push('SSH root login is enabled.');
  }

  if (summary.passwordAuthentication === 'yes') {
    highlights.push('SSH password authentication is enabled.');
  }

  const earliestCertificate = certificates
    .filter((item) => item.daysRemaining !== undefined)
    .sort((left, right) => (left.daysRemaining || 0) - (right.daysRemaining || 0))[0];
  if (earliestCertificate?.daysRemaining !== undefined) {
    highlights.push(`Earliest certificate expires in ${earliestCertificate.daysRemaining} day(s).`);
  }

  if (highlights.length === 0) {
    const firstMeaningfulAlert = alerts.find((item) => item.level !== 'info') || alerts[0];
    if (firstMeaningfulAlert) {
      highlights.push(firstMeaningfulAlert.detail);
    }
  }

  return highlights.slice(0, 6);
};

const execCommand = (client: Client, command: string, timeoutMs = 20000): Promise<string> =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Command timed out after ${timeoutMs}ms`));
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

    const alerts = buildAlerts(sections, summary, certificates);
    const score = buildScore(summary, sections, certificates);
    const highlights = buildHighlights(summary, certificates, alerts);
    const serviceHealth = buildServiceHealth(sections, summary);

    const errorCount = alerts.filter((item) => item.level === 'error').length;
    const warningCount = alerts.filter((item) => item.level === 'warning').length;
    const message =
      errorCount > 0 || warningCount > 0
        ? `Server inspection completed with ${errorCount} critical issue(s) and ${warningCount} warning(s).`
        : 'Server inspection completed. No obvious risk was detected from the collected data.';

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
