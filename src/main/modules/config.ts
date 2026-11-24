import { app, ipcMain } from 'electron';
import Store from 'electron-store';
import * as path from 'path';

import { createDefaultShortcuts, type ShortcutsConfig } from '../../shared/shortcuts';
import set from '../set.json';

type SetConfig = {
  isProxy: boolean;
  proxyConfig: {
    enable: boolean;
    protocol: string;
    host: string;
    port: number;
  };
  enableRealIP: boolean;
  realIP: string;
  noAnimate: boolean;
  animationSpeed: number;
  author: string;
  authorUrl: string;
  musicApiPort: number;
  closeAction: 'ask' | 'minimize' | 'close';
  musicQuality: string;
  fontFamily: string;
  fontScope: 'global' | 'lyric';
  language: string;
  showTopAction: boolean;
  enableGpuAcceleration: boolean;
  downloadPath: string;
  enableDiskCache: boolean;
  diskCacheDir: string;
  diskCacheMaxSizeMB: number;
  diskCacheCleanupPolicy: 'lru' | 'fifo';
  musicSourcePlugins?: unknown[];
};
interface StoreType {
  set: SetConfig;
  shortcuts: ShortcutsConfig;
}

// 模块级单例：主进程所有模块共享同一个 config.json Store 实例。
// 多个独立 Store 实例并发读写同一文件，会在 Windows 上与杀毒/云同步的文件锁
// 叠加触发 EBUSY 未捕获异常（#714）
const store = new Store<StoreType>({
  name: 'config',
  defaults: {
    set: set as SetConfig,
    shortcuts: createDefaultShortcuts()
  }
});

let initialized = false;

/**
 * 初始化配置管理（幂等：重复调用不会重复注册 IPC 监听）
 */
export function initializeConfig() {
  if (initialized) {
    return store;
  }
  initialized = true;

  try {
    store.get('set.downloadPath') || store.set('set.downloadPath', app.getPath('downloads'));
    store.get('set.diskCacheDir') ||
      store.set('set.diskCacheDir', path.join(app.getPath('userData'), 'cache'));
    if (store.get('set.diskCacheMaxSizeMB') === undefined) {
      store.set('set.diskCacheMaxSizeMB', 4096);
    }
    if (!store.get('set.diskCacheCleanupPolicy')) {
      store.set('set.diskCacheCleanupPolicy', 'lru');
    }
    if (store.get('set.enableDiskCache') === undefined) {
      store.set('set.enableDiskCache', true);
    }
  } catch (error) {
    console.error('[config] 初始化默认配置失败:', error);
  }

  const allowedSetKeys = new Set(Object.keys(set as SetConfig));
  const hasUnsafeObjectKeys = (value: unknown, depth = 0): boolean => {
    if (depth > 20) return true;
    if (!value || typeof value !== 'object') return false;
    if (Array.isArray(value)) {
      return value.some((item) => hasUnsafeObjectKeys(item, depth + 1));
    }
    return Object.entries(value).some(
      ([key, item]) =>
        ['__proto__', 'prototype', 'constructor'].includes(key) ||
        hasUnsafeObjectKeys(item, depth + 1)
    );
  };

  // Renderer 只能读写已知的 set 配置对象，不能通过通用 IPC 读写任意 electron-store 键。
  ipcMain.on('set-store-value', (_, key, value) => {
    if (
      key !== 'set' ||
      !value ||
      typeof value !== 'object' ||
      Array.isArray(value) ||
      Object.keys(value).some((item) => !allowedSetKeys.has(item)) ||
      hasUnsafeObjectKeys(value)
    ) {
      console.warn('[config] 拒绝无效的 renderer 配置写入');
      return;
    }

    try {
      const serialized = JSON.stringify(value);
      if (!serialized || Buffer.byteLength(serialized, 'utf8') > 5 * 1024 * 1024) {
        console.warn('[config] 拒绝超出大小限制的 renderer 配置写入');
        return;
      }
      store.set('set', value as SetConfig);
    } catch (error) {
      // config.json 可能被杀毒/云同步短暂锁定，丢一次写入无害，避免主进程崩溃
      console.error('[config] 写入配置失败:', error);
    }
  });

  ipcMain.on('get-store-value', (event, key) => {
    if (key !== 'set') {
      event.returnValue = '';
      return;
    }

    try {
      event.returnValue = store.get('set');
    } catch (error) {
      console.error('[config] 读取配置失败:', error);
      event.returnValue = '';
    }
  });

  // GPU加速设置更新处理
  // 注意：GPU加速设置必须在应用启动时在app.ready之前设置才能生效
  ipcMain.on('update-gpu-acceleration', (event, enabled: boolean) => {
    try {
      if (typeof enabled !== 'boolean') return;
      console.log('GPU加速设置更新:', enabled);
      store.set('set.enableGpuAcceleration', enabled);

      // GPU加速设置需要重启应用才能生效
      event.sender.send('gpu-acceleration-updated', enabled);
      console.log('GPU加速设置已保存，重启应用后生效');
    } catch (error) {
      console.error('GPU加速设置更新失败:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      event.sender.send('gpu-acceleration-update-error', errorMessage);
    }
  });

  return store;
}

export function getStore() {
  return store;
}

/**
 * 供主进程其他模块共享同一个 config.json Store 实例
 * （不要再 new Store()，多实例并发读写是 #714 EBUSY 崩溃的诱因之一）
 */
export function getSharedStore(): Store<Record<string, unknown>> {
  return store as unknown as Store<Record<string, unknown>>;
}
