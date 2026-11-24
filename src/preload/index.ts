import type { IpcRendererEvent } from 'electron';
import { contextBridge, ipcRenderer } from 'electron';

import type { AppUpdateState } from '../shared/appUpdate';
import type { WebdavConfig, WebdavResult } from '../shared/webdav';

// Custom APIs for renderer
const api = {
  minimize: () => ipcRenderer.send('minimize-window'),
  maximize: () => ipcRenderer.send('maximize-window'),
  isMaximized: () => ipcRenderer.invoke('is-window-maximized') as Promise<boolean>,
  onWindowMaximizedState: (callback: (maximized: boolean) => void) => {
    const listener = (_event: IpcRendererEvent, maximized: boolean) => callback(maximized);
    ipcRenderer.on('window-maximized-state', listener);
    return () => ipcRenderer.removeListener('window-maximized-state', listener);
  },
  toggleFullScreen: () => ipcRenderer.send('toggle-fullscreen'),
  isFullScreen: () => ipcRenderer.invoke('is-fullscreen') as Promise<boolean>,
  onWindowFullScreenState: (callback: (fullscreen: boolean) => void) => {
    const listener = (_event: IpcRendererEvent, fullscreen: boolean) => callback(fullscreen);
    ipcRenderer.on('window-fullscreen-state', listener);
    return () => ipcRenderer.removeListener('window-fullscreen-state', listener);
  },
  close: () => ipcRenderer.send('close-window'),
  quitApp: () => ipcRenderer.send('quit-app'),
  dragStart: (data) => ipcRenderer.send('drag-start', data),
  miniTray: () => ipcRenderer.send('mini-tray'),
  miniWindow: () => ipcRenderer.send('mini-window'),
  restore: () => ipcRenderer.send('restore-window'),
  restart: () => ipcRenderer.send('restart'),
  resizeWindow: (width, height) => ipcRenderer.send('resize-window', width, height),
  resizeMiniWindow: (showPlaylist) => ipcRenderer.send('resize-mini-window', showPlaylist),
  openLyric: () => ipcRenderer.send('open-lyric'),
  sendLyric: (data) => ipcRenderer.send('send-lyric', data),
  sendSong: (data) => ipcRenderer.send('update-current-song', data),
  unblockMusic: (id, data, enabledSources) =>
    ipcRenderer.invoke('unblock-music', id, data, enabledSources),
  importCustomApiPlugin: () => ipcRenderer.invoke('import-custom-api-plugin'),
  importLxMusicScript: () => ipcRenderer.invoke('import-lx-music-script'),
  importMusicSourcePlugin: () => ipcRenderer.invoke('import-music-source-plugin'),
  fetchMusicSourcePlugin: (url: string) => ipcRenderer.invoke('fetch-music-source-plugin', url),
  // 歌词窗口关闭事件
  onLyricWindowClosed: (callback: () => void) => {
    ipcRenderer.on('lyric-window-closed', () => callback());
  },
  // 歌词窗口就绪事件（Vue 加载完成，可以接收数据）
  onLyricWindowReady: (callback: () => void) => {
    ipcRenderer.on('lyric-window-ready', () => callback());
  },
  getAppUpdateState: () => ipcRenderer.invoke('app-update:get-state') as Promise<AppUpdateState>,
  checkAppUpdate: (manual = false) =>
    ipcRenderer.invoke('app-update:check', { manual }) as Promise<AppUpdateState>,
  downloadAppUpdate: () => ipcRenderer.invoke('app-update:download') as Promise<AppUpdateState>,
  installAppUpdate: () => ipcRenderer.invoke('app-update:quit-and-install') as Promise<boolean>,
  openAppUpdatePage: () => ipcRenderer.invoke('app-update:open-release-page') as Promise<boolean>,
  onAppUpdateState: (callback: (state: AppUpdateState) => void) => {
    ipcRenderer.on('app-update:state', (_event, state: AppUpdateState) => callback(state));
  },
  removeAppUpdateListeners: () => {
    ipcRenderer.removeAllListeners('app-update:state');
  },
  // 语言相关
  onLanguageChanged: (callback: (locale: string) => void) => {
    ipcRenderer.on('language-changed', (_event, locale) => {
      callback(locale);
    });
  },
  // 歌词缓存相关
  invoke: (channel: string, ...args: any[]) => {
    const validChannels = [
      'get-lyrics',
      'clear-lyrics-cache',
      'get-system-fonts',
      'get-cached-lyric',
      'cache-lyric',
      'clear-lyric-cache',
      'scan-local-music',
      'scan-local-music-with-stats',
      'parse-local-music-metadata'
    ];
    if (validChannels.includes(channel)) {
      return ipcRenderer.invoke(channel, ...args);
    }
    return Promise.reject(new Error(`未授权的 IPC 通道: ${channel}`));
  },
  // 搜索建议
  getSearchSuggestions: (keyword: string) => ipcRenderer.invoke('get-search-suggestions', keyword),

  // 落雪音乐 HTTP 请求（绕过 CORS）
  lxMusicHttpRequest: (request: { url: string; options: any; requestId: string }) =>
    ipcRenderer.invoke('lx-music-http-request', request),

  lxMusicHttpCancel: (requestId: string) => ipcRenderer.invoke('lx-music-http-cancel', requestId),

  // 本地音乐扫描相关
  scanLocalMusic: (folderPath: string) => ipcRenderer.invoke('scan-local-music', folderPath),
  scanLocalMusicWithStats: (folderPath: string) =>
    ipcRenderer.invoke('scan-local-music-with-stats', folderPath),
  parseLocalMusicMetadata: (filePaths: string[]) =>
    ipcRenderer.invoke('parse-local-music-metadata', filePaths),

  // Download manager
  downloadAdd: (task: any) => ipcRenderer.invoke('download:add', task),
  downloadAddBatch: (tasks: any) => ipcRenderer.invoke('download:add-batch', tasks),
  downloadPause: (taskId: string) => ipcRenderer.invoke('download:pause', taskId),
  downloadResume: (taskId: string) => ipcRenderer.invoke('download:resume', taskId),
  downloadCancel: (taskId: string) => ipcRenderer.invoke('download:cancel', taskId),
  downloadCancelAll: () => ipcRenderer.invoke('download:cancel-all'),
  downloadGetQueue: () => ipcRenderer.invoke('download:get-queue'),
  downloadSetConcurrency: (n: number) => ipcRenderer.send('download:set-concurrency', n),
  downloadGetCompleted: () => ipcRenderer.invoke('download:get-completed'),
  downloadDeleteCompleted: (filePath: string) =>
    ipcRenderer.invoke('download:delete-completed', filePath),
  downloadClearCompleted: () => ipcRenderer.invoke('download:clear-completed'),
  getEmbeddedLyrics: (filePath: string) =>
    ipcRenderer.invoke('download:get-embedded-lyrics', filePath),
  downloadProvideUrl: (taskId: string, url: string) =>
    ipcRenderer.invoke('download:provide-url', { taskId, url }),
  onDownloadProgress: (cb: (data: any) => void) => {
    ipcRenderer.on('download:progress', (_event: any, data: any) => cb(data));
  },
  onDownloadStateChange: (cb: (data: any) => void) => {
    ipcRenderer.on('download:state-change', (_event: any, data: any) => cb(data));
  },
  onDownloadBatchComplete: (cb: (data: any) => void) => {
    ipcRenderer.on('download:batch-complete', (_event: any, data: any) => cb(data));
  },
  onDownloadRequestUrl: (cb: (data: any) => void) => {
    ipcRenderer.on('download:request-url', (_event: any, data: any) => cb(data));
  },
  removeDownloadListeners: () => {
    ipcRenderer.removeAllListeners('download:progress');
    ipcRenderer.removeAllListeners('download:state-change');
    ipcRenderer.removeAllListeners('download:batch-complete');
    ipcRenderer.removeAllListeners('download:request-url');
  },

  // WebDAV 同步（请求走主进程，绕过 CORS）
  webdavGetConfig: () => ipcRenderer.invoke('webdav:get-config') as Promise<WebdavConfig>,
  webdavSaveConfig: (config: WebdavConfig) =>
    ipcRenderer.invoke('webdav:save-config', config) as Promise<void>,
  webdavTest: () => ipcRenderer.invoke('webdav:test') as Promise<WebdavResult<void>>,
  webdavUpload: (content: string) =>
    ipcRenderer.invoke('webdav:upload', content) as Promise<WebdavResult<void>>,
  webdavDownload: () =>
    ipcRenderer.invoke('webdav:download') as Promise<WebdavResult<string | null>>
};

// Explicit IPC channel allowlists: renderer code cannot invoke arbitrary main-process handlers.
const SEND_CHANNELS = new Set([
  'change-language',
  'update-play-state',
  'update-current-song',
  'restart',
  'open-lyric',
  'lyric-ready',
  'send-lyric',
  'top-lyric',
  'close-lyric',
  'set-lyric-lock-state',
  'mouseenter-lyric',
  'mouseleave-lyric',
  'lyric-drag-start',
  'lyric-drag-end',
  'lyric-drag-move',
  'set-ignore-mouse',
  'control-back',
  'set-store-value',
  'update-gpu-acceleration',
  'download:set-concurrency',
  'open-directory',
  'clear-audio-cache',
  'update-remote-control-config',
  'disable-shortcuts',
  'enable-shortcuts',
  'update-shortcuts',
  'set-content-zoom',
  'reset-content-zoom',
  'resize-window',
  'resize-mini-window',
  'minimize-window',
  'maximize-window',
  'toggle-fullscreen',
  'close-window',
  'quit-app',
  'mini-tray',
  'mini-window',
  'restore-window',
  'mpris-position-update',
  'tray-lyric-update',
  'open-login',
  'clear-downloads-history'
]);

const INVOKE_CHANNELS = new Set([
  'cache-lyric',
  'get-cached-lyric',
  'resolve-cached-music-url',
  'get-disk-cache-config',
  'set-disk-cache-config',
  'switch-disk-cache-directory',
  'get-disk-cache-stats',
  'clear-disk-cache',
  'clear-lyric-cache',
  'clear-lyrics-cache',
  'download:add',
  'download:add-batch',
  'download:pause',
  'download:resume',
  'download:cancel',
  'download:cancel-all',
  'download:get-queue',
  'download:get-completed',
  'download:delete-completed',
  'download:clear-completed',
  'download:get-embedded-lyrics',
  'download:provide-url',
  'check-file-exists',
  'get-supported-audio-formats',
  'select-directory',
  'get-downloads-path',
  'save-lyric-file',
  'import-custom-api-plugin',
  'import-lx-music-script',
  'import-music-source-plugin',
  'fetch-music-source-plugin',
  'get-system-fonts',
  'get-search-suggestions',
  'get-remote-control-config',
  'get-local-ip-addresses',
  'lx-music-http-request',
  'lx-music-http-cancel',
  'unblock-music',
  'app-update:get-state',
  'app-update:check',
  'app-update:download',
  'app-update:quit-and-install',
  'app-update:open-release-page',
  'shortcuts:get-config',
  'shortcuts:validate',
  'shortcuts:save',
  'webdav:get-config',
  'webdav:save-config',
  'webdav:test',
  'webdav:upload',
  'webdav:download',
  'get-content-zoom',
  'get-system-scale-factor',
  'is-fullscreen',
  'is-window-maximized',
  'scan-local-music',
  'scan-local-music-with-stats',
  'parse-local-music-metadata',
  'get-lyrics'
]);

const SYNC_CHANNELS = new Set(['get-arch', 'get-platform', 'get-store-value']);

const EVENT_CHANNELS = new Set([
  'window-maximized-state',
  'window-fullscreen-state',
  'mini-mode',
  'global-shortcut',
  'update-app-shortcuts',
  'mpris-seek',
  'mpris-set-position',
  'mpris-play',
  'mpris-pause',
  'language-changed',
  'lyric-window-closed',
  'lyric-window-ready',
  'download:progress',
  'download:state-change',
  'download:batch-complete',
  'download:request-url',
  'app-update:state',
  'lyric-control-back',
  'lyric-mouse-presence',
  'lyric-window-close',
  'receive-lyric',
  'navigate',
  'send-cookies',
  'shortcuts-updated',
  'gpu-acceleration-updated',
  'gpu-acceleration-update-error'
]);

const assertAllowedChannel = (channel: string, allowed: Set<string>, operation: string): void => {
  if (!allowed.has(channel)) {
    throw new Error(`未授权的 IPC ${operation} 通道: ${channel}`);
  }
};

const safeSend = (channel: string, ...args: any[]) => {
  assertAllowedChannel(channel, SEND_CHANNELS, 'send');
  ipcRenderer.send(channel, ...args);
};

const safeInvoke = (channel: string, ...args: any[]) => {
  if (!INVOKE_CHANNELS.has(channel)) {
    return Promise.reject(new Error(`未授权的 IPC invoke 通道: ${channel}`));
  }
  return ipcRenderer.invoke(channel, ...args);
};

const safeSendSync = (channel: string, ...args: any[]) => {
  assertAllowedChannel(channel, SYNC_CHANNELS, 'sendSync');
  return ipcRenderer.sendSync(channel, ...args);
};

const safeOn = (channel: string, listener: (...args: any[]) => void) => {
  assertAllowedChannel(channel, EVENT_CHANNELS, 'on');
  const wrappedListener = (_event: IpcRendererEvent, ...args: any[]) => listener(...args);
  ipcRenderer.on(channel, wrappedListener);
  return () => ipcRenderer.removeListener(channel, wrappedListener);
};

const safeElectronIpcRenderer = {
  send: safeSend,
  invoke: safeInvoke,
  sendSync: safeSendSync,
  on: (channel: string, listener: (event: IpcRendererEvent, ...args: any[]) => void) => {
    assertAllowedChannel(channel, EVENT_CHANNELS, 'on');
    ipcRenderer.on(channel, listener);
  },
  once: (channel: string, listener: (event: IpcRendererEvent, ...args: any[]) => void) => {
    assertAllowedChannel(channel, EVENT_CHANNELS, 'once');
    ipcRenderer.once(channel, listener);
  },
  removeListener: (channel: string, listener: (event: IpcRendererEvent, ...args: any[]) => void) => {
    assertAllowedChannel(channel, EVENT_CHANNELS, 'removeListener');
    ipcRenderer.removeListener(channel, listener);
  },
  removeAllListeners: (channel: string) => {
    assertAllowedChannel(channel, EVENT_CHANNELS, 'removeAllListeners');
    ipcRenderer.removeAllListeners(channel);
  }
};

// Legacy bridge preserves its callback signature while applying the same allowlists.
const ipc = {
  send: safeSend,
  invoke: safeInvoke,
  on: safeOn,
  removeAllListeners: (channel: string) => {
    assertAllowedChannel(channel, EVENT_CHANNELS, 'removeAllListeners');
    ipcRenderer.removeAllListeners(channel);
  }
};

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', { ipcRenderer: safeElectronIpcRenderer });
    contextBridge.exposeInMainWorld('api', api);
    contextBridge.exposeInMainWorld('ipcRenderer', ipc);
  } catch (error) {
    console.error(error);
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = { ipcRenderer: safeElectronIpcRenderer };
  // @ts-ignore (define in dts)
  window.api = api;
  // @ts-ignore (define in dts)
  window.ipcRenderer = ipc;
}
