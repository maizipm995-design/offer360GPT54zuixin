const fs = require('fs');
const path = require('path');

function loadEnvFile(filePath) {
  const abs = path.resolve(process.cwd(), filePath);
  if (!fs.existsSync(abs)) return;
  const content = fs.readFileSync(abs, 'utf8');
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const idx = line.indexOf('=');
    if (idx < 0) continue;
    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

function repairJsonText(jsonText) {
  let inString = false;
  let escaping = false;
  let output = '';

  for (let i = 0; i < jsonText.length; i += 1) {
    const ch = jsonText[i];
    if (inString) {
      if (!escaping && ch === '"') {
        inString = false;
        output += ch;
        continue;
      }

      if (!escaping && ch === '\\\\') {
        escaping = true;
        output += ch;
        continue;
      }

      if (escaping) {
        escaping = false;
        output += ch;
        continue;
      }

      if (ch === '\\n') {
        output += '\\\\n';
        continue;
      }

      if (ch === '\\r') {
        output += '\\\\r';
        continue;
      }

      if (ch === '\\t') {
        output += '\\\\t';
        continue;
      }

      if (ch === '\\b') {
        output += '\\\\b';
        continue;
      }

      if (ch === '\\f') {
        output += '\\\\f';
        continue;
      }

      const code = ch.charCodeAt(0);
      if (code >= 0 && code < 0x20) {
        output += `\\\\u${code.toString(16).padStart(4, '0')}`;
        continue;
      }

      output += ch;
      continue;
    }

    if (ch === '"') {
      inString = true;
      escaping = false;
      output += ch;
      continue;
    }

    output += ch;
  }

  return output;
}

function parseErrorPosition(message) {
  const match = String(message).match(/position\\s+(\\d+)/i);
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isFinite(value) ? value : null;
}

async function main() {
  loadEnvFile('.env');

  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();

  const log = await prisma.resumeAiOptimizationLog.findFirst({
    where: { optimizeType: 'translate' },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      status: true,
      errorCode: true,
      errorMessage: true,
      inputTokens: true,
      outputTokens: true,
      responseText: true,
      createdAt: true,
    },
  });

  if (!log) {
    throw new Error('No translate log found');
  }

  const text = log.responseText || '';
  const head = text.slice(0, 300);
  const tail = text.slice(-300);

  const report = {
    id: log.id,
    status: log.status,
    errorCode: log.errorCode,
    errorMessage: log.errorMessage,
    inputTokens: log.inputTokens,
    outputTokens: log.outputTokens,
    responseTextLength: text.length,
    head,
    tail,
    parse: {
      raw: null,
      repaired: null,
    },
  };

  try {
    JSON.parse(text);
    report.parse.raw = { ok: true };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    const pos = parseErrorPosition(msg);
    report.parse.raw = { ok: false, error: msg, pos };
    if (pos !== null) {
      report.parse.raw.snippet = text.slice(Math.max(0, pos - 60), Math.min(text.length, pos + 60));
    }
  }

  const repaired = repairJsonText(text);
  try {
    JSON.parse(repaired);
    report.parse.repaired = { ok: true };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    const pos = parseErrorPosition(msg);
    report.parse.repaired = { ok: false, error: msg, pos };
    if (pos !== null) {
      report.parse.repaired.snippet = repaired.slice(Math.max(0, pos - 60), Math.min(repaired.length, pos + 60));
    }
  }

  console.log(JSON.stringify(report, null, 2));
  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

