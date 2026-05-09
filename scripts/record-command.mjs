#!/usr/bin/env node
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workspaceRoot = path.resolve(__dirname, '..');
const docsDir = path.join(workspaceRoot, 'docs');
const commandLogsDir = path.join(docsDir, 'command-logs');
const ledgerFile = path.join(docsDir, '项目迭代总台账.md');
const MAX_CAPTURE_SIZE = 200 * 1024;
const MAX_LOG_OUTPUT = 12000;
const TEXT_FILE_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json', '.md', '.txt', '.yml', '.yaml', '.env', '.example', '.css', '.scss', '.html', '.sql', '.prisma', '.sh', '.xml', '.toml', '.ini', '.conf', '.lock'
]);

function printHelp() {
  console.log(`用法：
  npm run record:cmd -- [记录参数] -- <实际命令>

示例：
  npm run record:cmd -- --category 开发 --title "后台订单联调" --summary "验证后台订单链路" --append-ledger -- npm run build:web

支持参数：
  --cwd <目录>             指定命令执行目录，默认仓库根目录
  --title <标题>           本次记录标题
  --category <分类>        记录分类，如 开发 / 调试 / 修改 / 配置 / 校验
  --summary <内容>         本次核心操作简述
  --done <内容>            本次已完成事项
  --followup <内容>        后续待跟进事项
  --issue <内容>           遗留问题说明
  --append-ledger          将简要记录同步追加到 项目迭代总台账
  --command <命令字符串>   直接传入完整命令
  --help                   查看帮助
`);
}

function parseArgs(argv) {
  const options = {
    cwd: workspaceRoot,
    title: '',
    category: '开发',
    summary: '',
    done: '',
    followup: '',
    issue: '',
    appendLedger: false,
    command: '',
  };

  const commandParts = [];
  let inCommand = false;

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];

    if (inCommand) {
      commandParts.push(current);
      continue;
    }

    if (current === '--') {
      inCommand = true;
      continue;
    }

    if (current === '--help' || current === '-h') {
      options.help = true;
      continue;
    }

    if (current === '--append-ledger') {
      options.appendLedger = true;
      continue;
    }

    const next = argv[index + 1];
    if (['--cwd', '--title', '--category', '--summary', '--done', '--followup', '--issue', '--command'].includes(current)) {
      if (!next || next.startsWith('--')) {
        throw new Error(`${current} 缺少参数值`);
      }
      const key = current.replace(/^--/, '');
      options[key] = next;
      index += 1;
      continue;
    }

    commandParts.push(current);
  }

  const command = options.command || commandParts.join(' ').trim();
  return { options, command };
}

function normalizeRelative(targetPath) {
  return path.relative(workspaceRoot, targetPath).split(path.sep).join('/');
}

function shouldIgnore(relativePath, isDirectory) {
  const normalized = relativePath.split(path.sep).join('/');
  const parts = normalized.split('/').filter(Boolean);

  if (!normalized) return false;
  if (parts.includes('.git') || parts.includes('node_modules') || parts.includes('.next') || parts.includes('dist') || parts.includes('coverage')) return true;
  if (normalized.startsWith('docs/command-logs')) return true;
  if (normalized === '.DS_Store' || normalized.endsWith('/.DS_Store')) return true;
  if (!isDirectory && normalized.endsWith('.log')) return true;
  return false;
}

function isTextFile(filePath, buffer) {
  const extension = path.extname(filePath).toLowerCase();
  if (TEXT_FILE_EXTENSIONS.has(extension)) return true;
  const basename = path.basename(filePath).toLowerCase();
  if (basename.startsWith('.env')) return true;
  return !buffer.includes(0);
}

async function walkSnapshot(directory, snapshot = new Map()) {
  const entries = await fsp.readdir(directory, { withFileTypes: true });

  for (const entry of entries) {
    const absolutePath = path.join(directory, entry.name);
    const relativePath = normalizeRelative(absolutePath);

    if (shouldIgnore(relativePath, entry.isDirectory())) {
      continue;
    }

    if (entry.isDirectory()) {
      await walkSnapshot(absolutePath, snapshot);
      continue;
    }

    const stat = await fsp.stat(absolutePath);
    const buffer = await fsp.readFile(absolutePath);
    const hash = crypto.createHash('sha1').update(buffer).digest('hex').slice(0, 12);
    const text = buffer.length <= MAX_CAPTURE_SIZE && isTextFile(absolutePath, buffer) ? buffer.toString('utf8') : null;

    snapshot.set(relativePath, {
      relativePath,
      size: stat.size,
      mtimeMs: stat.mtimeMs,
      hash,
      text,
    });
  }

  return snapshot;
}

function truncate(text, limit = MAX_LOG_OUTPUT) {
  if (!text) return '';
  return text.length > limit ? `${text.slice(0, limit)}\n...（内容已截断）` : text;
}

function formatDate(date = new Date()) {
  const pad = (value) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function formatFileDateToken(date = new Date()) {
  const pad = (value) => String(value).padStart(2, '0');
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

function slugify(raw) {
  return raw
    .trim()
    .replace(/[\s/\\]+/g, '-')
    .replace(/[^\p{Letter}\p{Number}\u4e00-\u9fa5_-]+/gu, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40) || '命令记录';
}

function collectDiff(before, after) {
  const newFiles = [];
  const modifiedFiles = [];
  const deletedFiles = [];

  for (const [relativePath, beforeItem] of before.entries()) {
    if (!after.has(relativePath)) {
      deletedFiles.push({ type: 'deleted', relativePath, before: beforeItem });
      continue;
    }

    const afterItem = after.get(relativePath);
    if (beforeItem.hash !== afterItem.hash) {
      modifiedFiles.push({ type: 'modified', relativePath, before: beforeItem, after: afterItem });
    }
  }

  for (const [relativePath, afterItem] of after.entries()) {
    if (!before.has(relativePath)) {
      newFiles.push({ type: 'added', relativePath, after: afterItem });
    }
  }

  return { newFiles, modifiedFiles, deletedFiles };
}

function summarizeTextChange(beforeText, afterText) {
  if (beforeText === null || afterText === null) {
    return '文件体积较大或非文本文件，未输出行级摘要。';
  }

  const beforeLines = beforeText.split(/\r?\n/);
  const afterLines = afterText.split(/\r?\n/);
  let start = 0;

  while (start < beforeLines.length && start < afterLines.length && beforeLines[start] === afterLines[start]) {
    start += 1;
  }

  let beforeEnd = beforeLines.length - 1;
  let afterEnd = afterLines.length - 1;
  while (beforeEnd >= start && afterEnd >= start && beforeLines[beforeEnd] === afterLines[afterEnd]) {
    beforeEnd -= 1;
    afterEnd -= 1;
  }

  if (start > beforeEnd && start > afterEnd) {
    return '文件内容发生变化，但未能提取出稳定的差异区间。';
  }

  const nextPreview = afterLines.slice(start, Math.min(afterEnd + 1, start + 5)).join(' | ').trim();
  const beforeRange = beforeEnd >= start ? `${start + 1}-${beforeEnd + 1}` : '无';
  const afterRange = afterEnd >= start ? `${start + 1}-${afterEnd + 1}` : '无';
  return `原行 ${beforeRange} -> 新行 ${afterRange}${nextPreview ? `；新内容预览：${nextPreview}` : ''}`;
}

function summarizeChangeItems(diff) {
  const items = [];

  for (const file of diff.newFiles) {
    const preview = file.after.text ? file.after.text.split(/\r?\n/).slice(0, 5).join(' | ').trim() : '';
    items.push(`- **新增** \`${file.relativePath}\`：${preview ? `文件已创建，内容预览：${preview}` : '文件已创建。'}`);
  }

  for (const file of diff.modifiedFiles) {
    items.push(`- **修改** \`${file.relativePath}\`：${summarizeTextChange(file.before.text, file.after.text)}`);
  }

  for (const file of diff.deletedFiles) {
    items.push(`- **删除** \`${file.relativePath}\`：命令执行后文件已不存在。`);
  }

  return items.length ? items.join('\n') : '- **无文件变更**：本次命令未造成工作区文件新增、修改或删除。';
}

async function ensureLedgerFile() {
  await fsp.mkdir(docsDir, { recursive: true });
  try {
    await fsp.access(ledgerFile);
  } catch {
    await fsp.writeFile(ledgerFile, '# 项目迭代总台账\n\n## 五、迭代记录\n\n', 'utf8');
  }
}

async function appendLedgerEntry({ title, category, summary, done, followup, issue, logRelativePath }) {
  await ensureLedgerFile();
  const now = formatDate();
  const section = `\n### ${now}｜${category}｜${title}\n\n- **核心操作**：${summary || '执行记录命令并沉淀专项文档'}\n- **已完成**：${done || '命令已执行，专项记录已生成'}\n- **待跟进**：${followup || '-'}\n- **遗留问题**：${issue || '-'}\n- **专项记录**：\`${logRelativePath}\`\n`;
  await fsp.appendFile(ledgerFile, section, 'utf8');
}

function buildLogMarkdown({
  title,
  category,
  command,
  cwd,
  status,
  exitCode,
  durationMs,
  stdout,
  stderr,
  diff,
  summary,
  done,
  followup,
  issue,
}) {
  const changedFiles = [...diff.newFiles, ...diff.modifiedFiles, ...diff.deletedFiles].map((item) => item.relativePath);
  const durationSeconds = (durationMs / 1000).toFixed(2);

  return `# ${title}\n\n## 一、执行概览\n\n- **记录时间**：${formatDate()}\n- **命令分类**：${category}\n- **执行目录**：\`${normalizeRelative(cwd) || '.'}\`\n- **执行结果**：${status}\n- **退出码**：${exitCode}\n- **耗时**：${durationSeconds} 秒\n- **运行环境**：\`${os.platform()} ${os.release()}\` / Node \`${process.version}\`\n- **版本上下文**：当前目录未检测到 Git 仓库，文件变更使用**文件系统快照前后对比**生成。\n\n## 二、执行命令\n\n\`\`\`bash\n${command}\n\`\`\`\n\n## 三、涉及文件\n\n- **新增文件数**：${diff.newFiles.length}\n- **修改文件数**：${diff.modifiedFiles.length}\n- **删除文件数**：${diff.deletedFiles.length}\n- **涉及文件列表**：${changedFiles.length ? changedFiles.map((item) => `\`${item}\``).join('、') : '无'}\n\n## 四、具体改动点\n\n${summarizeChangeItems(diff)}\n\n## 五、操作说明\n\n- **核心操作**：${summary || '-'}\n- **已完成事项**：${done || '-'}\n- **待跟进事项**：${followup || '-'}\n- **未解决遗留问题**：${issue || '-'}\n\n## 六、标准输出\n\n\`\`\`text\n${truncate(stdout) || '（无）'}\n\`\`\`\n\n## 七、标准错误\n\n\`\`\`text\n${truncate(stderr) || '（无）'}\n\`\`\`\n`;
}

async function main() {
  const { options, command } = parseArgs(process.argv.slice(2));

  if (options.help) {
    printHelp();
    return;
  }

  if (!command) {
    printHelp();
    throw new Error('未传入需要执行的命令');
  }

  const executionCwd = path.resolve(workspaceRoot, options.cwd);
  const title = options.title || command;
  const startedAt = Date.now();
  await fsp.mkdir(commandLogsDir, { recursive: true });

  const beforeSnapshot = await walkSnapshot(workspaceRoot);
  let stdout = '';
  let stderr = '';
  let exitCode = 0;

  try {
    exitCode = await new Promise((resolve, reject) => {
      const child = spawn(command, {
        cwd: executionCwd,
        env: process.env,
        shell: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      child.stdout.on('data', (chunk) => {
        stdout += chunk.toString();
      });

      child.stderr.on('data', (chunk) => {
        stderr += chunk.toString();
      });

      child.on('error', reject);
      child.on('close', (code) => resolve(code ?? 1));
    });
  } catch (error) {
    stderr += `\n[record-command] 命令执行异常：${error instanceof Error ? error.message : String(error)}\n`;
    exitCode = 1;
  }

  const afterSnapshot = await walkSnapshot(workspaceRoot);
  const diff = collectDiff(beforeSnapshot, afterSnapshot);
  const status = exitCode === 0 ? '成功' : '失败';
  const durationMs = Date.now() - startedAt;
  const fileName = `${formatFileDateToken()}-${slugify(title)}.md`;
  const logAbsolutePath = path.join(commandLogsDir, fileName);
  const logRelativePath = normalizeRelative(logAbsolutePath);

  if (options.appendLedger) {
    await appendLedgerEntry({
      title,
      category: options.category,
      summary: options.summary,
      done: options.done,
      followup: options.followup,
      issue: options.issue,
      logRelativePath,
    });
  }

  const markdown = buildLogMarkdown({
    title,
    category: options.category,
    command,
    cwd: executionCwd,
    status,
    exitCode,
    durationMs,
    stdout,
    stderr,
    diff,
    summary: options.summary,
    done: options.done,
    followup: options.followup,
    issue: options.issue,
  });

  await fsp.writeFile(logAbsolutePath, markdown, 'utf8');

  console.log(`命令记录已生成：${logRelativePath}`);
  if (options.appendLedger) {
    console.log(`总台账已同步更新：${normalizeRelative(ledgerFile)}`);
  }

  if (exitCode !== 0) {
    process.exit(exitCode);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
