/**
 * 落雪音乐 HTTP 请求处理（主进程）
 * 绕过渲染进程的 CORS 限制，同时阻止插件请求访问本机、局域网和云元数据地址。
 */

import { ipcMain } from 'electron';
import fetch, { type RequestInit } from 'node-fetch';

import { safeHttpAgent, safeHttpsAgent, validatePublicHttpUrl } from './safeNetwork';

interface LxHttpRequest {
  url: string;
  options: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
    data?: unknown;
    params?: Record<string, unknown>;
    form?: Record<string, string>;
    formData?: Record<string, string>;
    timeout?: number;
  };
  requestId: string;
}

interface LxHttpResponse {
  statusCode: number;
  headers: Record<string, string | string[]>;
  body: any;
}

const abortControllers = new Map<string, AbortController>();
const ALLOWED_METHODS = new Set(['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']);
const BLOCKED_HEADERS = /^(host|connection|content-length|transfer-encoding|upgrade|proxy-connection|proxy-authorization|proxy-authenticate|keep-alive|te|trailer)$/i;
const MAX_REQUEST_BODY_BYTES = 1024 * 1024;
const MAX_RESPONSE_BYTES = 10 * 1024 * 1024;

const appendQueryParams = (url: string, params?: Record<string, unknown>): string => {
  if (!params || typeof params !== 'object') return url;

  try {
    const target = new URL(url);
    for (const [key, value] of Object.entries(params)) {
      if (value === undefined || value === null) continue;
      if (Array.isArray(value)) {
        value.forEach((item) => target.searchParams.append(key, String(item)));
      } else if (typeof value === 'object') {
        target.searchParams.set(key, JSON.stringify(value));
      } else {
        target.searchParams.set(key, String(value));
      }
    }
    return target.toString();
  } catch {
    return url;
  }
};

function validateRequestHeaders(rawHeaders?: Record<string, string>): Record<string, string> {
  if (!rawHeaders || typeof rawHeaders !== 'object' || Array.isArray(rawHeaders)) return {};
  const entries = Object.entries(rawHeaders);
  if (entries.length > 64) throw new Error('请求头数量超出限制');

  const headers: Record<string, string> = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
  };

  for (const [name, value] of entries) {
    if (
      !/^[!#$%&'*+.^_`|~\\w-]+$/.test(name) ||
      name.length > 128 ||
      BLOCKED_HEADERS.test(name) ||
      typeof value !== 'string' ||
      value.length > 8192 ||
      /[\\r\\n\\0]/.test(value)
    ) {
      throw new Error('请求头包含不允许的字段');
    }
    headers[name] = value;
  }

  return headers;
}

/**
 * 初始化 HTTP 请求处理
 */
export const initLxMusicHttp = () => {
  ipcMain.handle(
    'lx-music-http-request',
    async (_, request: LxHttpRequest): Promise<LxHttpResponse> => {
      if (
        !request ||
        typeof request !== 'object' ||
        typeof request.requestId !== 'string' ||
        request.requestId.length === 0 ||
        request.requestId.length > 128 ||
        typeof request.url !== 'string'
      ) {
        throw new Error('无效的 HTTP 请求参数');
      }

      const requestId = request.requestId;
      if (abortControllers.has(requestId)) {
        throw new Error('请求 ID 已在使用中');
      }

      const options: LxHttpRequest['options'] =
        request.options && typeof request.options === 'object' ? request.options : {};
      const method = String(options.method || 'GET').toUpperCase();
      if (!ALLOWED_METHODS.has(method)) {
        throw new Error('不支持的 HTTP 请求方法');
      }

      const url = validatePublicHttpUrl(appendQueryParams(request.url, options.params));
      const headers = validateRequestHeaders(options.headers);
      const controller = new AbortController();
      abortControllers.set(requestId, controller);

      let timeoutId: ReturnType<typeof setTimeout> | null = null;

      try {
        const host = new URL(url).hostname;
        console.log(`[LxMusicHttp] 请求: ${method} ${host}`);

        const fetchOptions: RequestInit = {
          method,
          headers,
          signal: controller.signal,
          size: MAX_RESPONSE_BYTES,
          redirect: 'follow',
          agent: (parsedUrl) =>
            parsedUrl.protocol === 'http:' ? safeHttpAgent : safeHttpsAgent
        };

        if (options.body !== undefined) {
          fetchOptions.body = options.body;
        } else if (options.data !== undefined && method !== 'GET' && method !== 'HEAD') {
          if (typeof options.data === 'string') {
            fetchOptions.body = options.data;
          } else {
            fetchOptions.body = JSON.stringify(options.data);
            fetchOptions.headers = {
              ...headers,
              'Content-Type': 'application/json'
            };
          }
        } else if (options.form) {
          const formData = new URLSearchParams(options.form);
          fetchOptions.body = formData.toString();
          fetchOptions.headers = {
            ...headers,
            'Content-Type': 'application/x-www-form-urlencoded'
          };
        } else if (options.formData) {
          const entries = Object.entries(options.formData);
          if (entries.length > 64) throw new Error('表单字段数量超出限制');
          const FormData = (await import('form-data')).default;
          const formData = new FormData();
          let totalBytes = 0;
          for (const [key, value] of entries) {
            if (typeof value !== 'string') throw new Error('表单字段内容无效');
            totalBytes += Buffer.byteLength(value, 'utf8');
            if (totalBytes > MAX_REQUEST_BODY_BYTES) {
              throw new Error('HTTP 请求体不能超过 1 MB');
            }
            formData.append(key, value);
          }
          fetchOptions.body = formData as any;
        }

        if (
          typeof fetchOptions.body === 'string' &&
          Buffer.byteLength(fetchOptions.body, 'utf8') > MAX_REQUEST_BODY_BYTES
        ) {
          throw new Error('HTTP 请求体不能超过 1 MB');
        }

        const requestedTimeout = Number(options.timeout);
        const timeout =
          Number.isFinite(requestedTimeout) && requestedTimeout > 0
            ? Math.min(60000, Math.max(1000, requestedTimeout))
            : 30000;
        timeoutId = setTimeout(() => controller.abort(), timeout);

        const response = await fetch(url, fetchOptions);
        const rawBody = await response.text();

        let parsedBody: any = rawBody;
        const contentType = response.headers.get('content-type') || '';
        if (
          contentType.includes('application/json') ||
          rawBody.startsWith('{') ||
          rawBody.startsWith('[')
        ) {
          try {
            parsedBody = JSON.parse(rawBody);
          } catch {
            // JSON 解析失败时保留原始文本。
          }
        }

        const responseHeaders: Record<string, string | string[]> = {};
        response.headers.forEach((value, key) => {
          responseHeaders[key] = value;
        });

        return {
          statusCode: response.status,
          headers: responseHeaders,
          body: parsedBody
        };
      } catch (error: any) {
        console.error(`[LxMusicHttp] 请求失败: ${new URL(url).hostname}`, error.message);
        throw error;
      } finally {
        if (timeoutId) clearTimeout(timeoutId);
        abortControllers.delete(requestId);
      }
    }
  );

  ipcMain.handle('lx-music-http-cancel', (_, requestId: string) => {
    if (typeof requestId !== 'string' || requestId.length > 128) return;
    const controller = abortControllers.get(requestId);
    if (controller) {
      controller.abort();
      abortControllers.delete(requestId);
    }
  });

  console.log('[LxMusicHttp] HTTP 请求处理已初始化');
};

export const cleanupLxMusicHttp = () => {
  for (const controller of abortControllers.values()) {
    controller.abort();
  }
  abortControllers.clear();
};
