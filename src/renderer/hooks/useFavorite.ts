import { computed } from 'vue';

import { playMusic } from '@/hooks/MusicHook';
import { usePlayerStore } from '@/store/modules/player';
import type { SongResult } from '@/types/music';

import { useDownload } from './useDownload';

/**
 * 当前歌曲的收藏状态管理 composable
 */
export function useFavorite() {
  const playerStore = usePlayerStore();
  const { downloadMusic } = useDownload();

  /** 当前歌曲是否已收藏 */
  const isFavorite = computed(() => {
    if (!playMusic?.value?.id) return false;
    return playerStore.favoriteList.includes(playMusic.value.id);
  });

  /** 切换收藏状态 */
  const toggleFavorite = async (e?: Event) => {
    e?.stopPropagation();
    if (!playMusic?.value?.id) return;

    const favoriteId = playMusic.value.id;
    if (isFavorite.value) {
      playerStore.removeFromFavorite(favoriteId);
    } else {
      playerStore.addToFavorite(favoriteId);
      // 下载 composable 会提示不支持的 ID；收藏状态不会因此回滚。
      await downloadMusic(playMusic.value as SongResult);
    }
  };

  return {
    isFavorite,
    toggleFavorite
  };
}
