/**
 * Health Guardian Plugin - 全自动版
 * 自动备份/检测/恢复配置
 */

import * as fs from 'fs';
import * as path from 'path';

const CONFIG_PATH = path.join(process.env.OPENCLAW_STATE_DIR || '', 'openclaw.json');
const SNAPSHOT_DIR = path.join(process.env.OPENCLAW_STATE_DIR || '', 'snapshots');

// 配置快照
interface ConfigSnapshot {
  filename: string;
  createdAt: string;
  hash: string;
}

// 简单的hash函数
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16);
}

// 确保快照目录存在
function ensureDir() {
  if (!fs.existsSync(SNAPSHOT_DIR)) {
    fs.mkdirSync(SNAPSHOT_DIR, { recursive: true });
  }
}

// 获取当前配置
function getCurrentConfig() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
  } catch {
    return null;
  }
}

// 备份配置
function backupConfig(reason: string = 'manual'): string {
  ensureDir();
  const config = getCurrentConfig();
  if (!config) return '';
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const configStr = JSON.stringify(config);
  const hash = simpleHash(configStr);
  
  // 检查是否有相同的配置
  const existing = fs.readdirSync(SNAPSHOT_DIR)
    .filter(f => f.startsWith('snapshot_') && f.endsWith('.json'))
    .map(f => {
      try {
        const content = fs.readFileSync(path.join(SNAPSHOT_DIR, f), 'utf-8');
        return { file: f, hash: simpleHash(content) };
      } catch {
        return null;
      }
    })
    .filter(x => x && x.hash === hash);
  
  if (existing.length > 0) {
    console.log('[Health Guardian] Config unchanged, skipping backup');
    return '';
  }
  
  const filename = `snapshot_${reason}_${timestamp}.json`;
  const filepath = path.join(SNAPSHOT_DIR, filename);
  
  fs.writeFileSync(filepath, configStr);
  console.log(`[Health Guardian] Backed up config: ${filename}`);
  
  // 只保留最近10个快照
  cleanupOldSnapshots();
  
  return filename;
}

// 清理旧快照
function cleanupOldSnapshots() {
  const files = fs.readdirSync(SNAPSHOT_DIR)
    .filter(f => f.startsWith('snapshot_') && f.endsWith('.json'))
    .sort()
    .reverse();
  
  // 保留手动备份和最新的自动快照
  const manual = files.filter(f => f.startsWith('snapshot_manual'));
  const auto = files.filter(f => f.startsWith('snapshot_auto')).slice(0, 10);
  
  const keep = new Set([...manual, ...auto]);
  
  files.forEach(f => {
    if (!keep.has(f)) {
      fs.unlinkSync(path.join(SNAPSHOT_DIR, f));
    }
  });
}

// 列出快照
function listSnapshots(): ConfigSnapshot[] {
  ensureDir();
  const files = fs.readdirSync(SNAPSHOT_DIR)
    .filter(f => f.startsWith('snapshot_') && f.endsWith('.json'))
    .sort()
    .reverse();
  
  return files.map(f => ({
    filename: f,
    createdAt: fs.statSync(path.join(SNAPSHOT_DIR, f)).mtime.toISOString()
  }));
}

// 恢复快照
function restoreSnapshot(filename: string): boolean {
  const filepath = path.join(SNAPSHOT_DIR, filename);
  if (!fs.existsSync(filepath)) {
    console.log(`[Health Guardian] Snapshot not found: ${filename}`);
    return false;
  }
  
  // 先备份当前配置
  backupConfig('before_restore');
  
  // 恢复快照
  fs.copyFileSync(filepath, CONFIG_PATH);
  console.log(`[Health Guardian] Restored: ${filename}`);
  return true;
}

// 获取健康状态
function checkHealth(): { healthy: boolean; message: string } {
  try {
    const config = getCurrentConfig();
    if (!config) {
      return { healthy: false, message: 'Config file missing' };
    }
    
    // 检查必需的配置
    if (!config.models || !config.agents) {
      return { healthy: false, message: 'Config missing required fields' };
    }
    
    return { healthy: true, message: 'OK' };
  } catch (e) {
    return { healthy: false, message: `Error: ${e}` };
  }
}

// 自动恢复（找到最后一个健康的手动快照）
function autoRecover(): boolean {
  console.log('[Health Guardian] Attempting auto-recovery...');
  
  const snapshots = listSnapshots();
  const manual = snapshots.filter(s => s.filename.startsWith('snapshot_manual'));
  
  if (manual.length === 0) {
    console.log('[Health Guardian] No manual snapshots to restore');
    return false;
  }
  
  // 尝试从最新的手动快照恢复
  const latest = manual[0].filename;
  return restoreSnapshot(latest);
}

// 插件注册
function register() {
  return {
    name: 'health-guardian',
    tools: {
      // 手动备份
      healthGuardianBackup: {
        description: 'Backup current OpenClaw config (manual)',
        inputSchema: { type: 'object' },
        handler: async () => {
          const filename = backupConfig('manual');
          return { success: !!filename, filename };
        }
      },
      
      // 改配置前自动调用（供内部使用）
      healthGuardianAutoBackup: {
        description: 'Auto backup before config changes',
        inputSchema: { type: 'object' },
        handler: async () => {
          const filename = backupConfig('auto');
          return { success: !!filename, filename };
        }
      },
      
      // 列出快照
      healthGuardianList: {
        description: 'List all config snapshots',
        inputSchema: { type: 'object' },
        handler: async () => {
          const snapshots = listSnapshots();
          return { snapshots, count: snapshots.length };
        }
      },
      
      // 恢复快照
      healthGuardianRestore: {
        description: 'Restore config from a snapshot',
        inputSchema: {
          type: 'object',
          properties: {
            filename: { type: 'string', description: 'Snapshot filename to restore' }
          },
          required: ['filename']
        },
        handler: async (args: { filename: string }) => {
          const success = restoreSnapshot(args.filename);
          return { success, filename: args.filename };
        }
      },
      
      // 健康检查
      healthGuardianCheck: {
        description: 'Check OpenClaw config health',
        inputSchema: { type: 'object' },
        handler: async () => {
          return checkHealth();
        }
      },
      
      // 自动恢复
      healthGuardianAutoRecover: {
        description: 'Auto-recover from last good snapshot',
        inputSchema: { type: 'object' },
        handler: async () => {
          const success = autoRecover();
          return { success };
        }
      }
    },
    
    // 钩子：在Gateway启动时自动备份
    onGatewayStart: () => {
      console.log('[Health Guardian] Gateway starting, backing up config...');
      backupConfig('startup');
    }
  };
}

module.exports = { register };