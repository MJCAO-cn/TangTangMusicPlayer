import { net, protocol } from 'electron';

import { parsePluginMediaUrl, PLUGIN_MEDIA_SCHEME } from '../../shared/musicSourcePlugin';
import { assertPublicHostname, validatePublicHttpUrl } from './safeNetwork';

/**
 * 本地音源插件媒体代理协议。
 *
 * 插件直链只允许访问公开 HTTP(S) 主机；每次请求及重定向前重新检查 DNS，
 * 防止插件媒体 URL 被用于访问本机、局域网或云元数据服务。
 */
export const initPluginMediaProxy = (): void => {
  protocol.handle(PLUGIN_MEDIA_SCHEME, async (request) => {
    const target = parsePluginMediaUrl(request.url);
    if (!target) {
      return new Response(null, { status: 400 });
    }

    const headers: Record<string, string> = { ...target.headers };
    const range = request.headers.get('range');
    if (range) headers['Range'] = range;

    let currentUrl = target.url;
    try {
      currentUrl = validatePublicHttpUrl(target.url);
      let upstream: Response | null = null;

      for (let redirectCount = 0; redirectCount <= 5; redirectCount += 1) {
        const parsedUrl = new URL(currentUrl);
        await assertPublicHostname(parsedUrl.hostname);

        upstream = await net.fetch(currentUrl, {
          method: 'GET',
          headers,
          redirect: 'manual'
        });

        if (![301, 302, 303, 307, 308].includes(upstream.status)) {
          break;
        }

        const location = upstream.headers.get('location');
        await upstream.body?.cancel();

        if (!location || redirectCount === 5) {
          return new Response(null, { status: 502 });
        }

        currentUrl = validatePublicHttpUrl(new URL(location, currentUrl).toString());
      }

      if (!upstream) {
        return new Response(null, { status: 502 });
      }

      const responseHeaders: Record<string, string> = {
        'X-Content-Type-Options': 'nosniff'
      };
      for (const name of ['content-type', 'content-length', 'content-range', 'accept-ranges']) {
        const value = upstream.headers.get(name);
        if (value) responseHeaders[name] = value;
      }

      return new Response(upstream.body, {
        status: upstream.status,
        headers: responseHeaders
      });
    } catch (error) {
      const host = (() => {
        try {
          return new URL(currentUrl || target.url).hostname;
        } catch {
          return 'invalid-host';
        }
      })();
      console.error('[PluginMediaProxy] 代理请求失败:', host, error);
      return new Response(null, { status: 502 });
    }
  });
};
