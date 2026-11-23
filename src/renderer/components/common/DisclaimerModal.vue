<template>
  <Teleport to="body">
    <Transition name="disclaimer-modal">
      <div
        v-if="showDisclaimer"
        class="fixed inset-0 z-[999999] flex items-center justify-center bg-black/60 backdrop-blur-md"
      >
        <section class="mx-4 w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl dark:bg-gray-900">
          <div class="h-2 bg-gradient-to-r from-rose-400 via-pink-500 to-violet-500" />
          <h2 class="mt-10 px-6 text-center text-2xl font-bold text-gray-900 dark:text-white">
            {{ t('comp.disclaimer.title') }}
          </h2>
          <div class="px-6 py-6">
            <div class="space-y-4 text-sm leading-relaxed text-gray-600 dark:text-gray-300">
              <div class="rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-900/20">
                <div class="flex items-start gap-3">
                  <i class="ri-alert-line mt-0.5 flex-shrink-0 text-xl text-amber-500" />
                  <p class="text-amber-700 dark:text-amber-300">{{ t('comp.disclaimer.warning') }}</p>
                </div>
              </div>
              <div class="space-y-3">
                <div class="flex items-start gap-3">
                  <span class="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/30">
                    <i class="ri-book-2-line text-sm text-blue-500" />
                  </span>
                  <p>{{ t('comp.disclaimer.item1') }}</p>
                </div>
                <div class="flex items-start gap-3">
                  <span class="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
                    <i class="ri-time-line text-sm text-green-500" />
                  </span>
                  <p>{{ t('comp.disclaimer.item2') }}</p>
                </div>
                <div class="flex items-start gap-3">
                  <span class="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-violet-100 dark:bg-violet-900/30">
                    <i class="ri-shield-check-line text-sm text-violet-500" />
                  </span>
                  <p>{{ t('comp.disclaimer.item3') }}</p>
                </div>
              </div>
            </div>
          </div>
          <div class="space-y-3 px-6 pb-8">
            <button
              class="w-full rounded-2xl bg-gradient-to-r from-rose-500 to-violet-600 py-4 text-base font-medium text-white shadow-lg shadow-rose-500/20 transition-all hover:brightness-105 active:scale-[0.98]"
              @click="handleAgree"
            >
              <span class="flex items-center justify-center gap-2">
                <i class="ri-check-line text-lg" />
                {{ t('comp.disclaimer.agree') }}
              </span>
            </button>
            <button
              class="w-full py-3 text-sm font-medium text-gray-500 transition-colors hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
              @click="handleDisagree"
            >
              {{ t('comp.disclaimer.disagree') }}
            </button>
          </div>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import { isElectron, isLyricWindow } from '@/utils';

const { t } = useI18n();
const DISCLAIMER_AGREED_KEY = 'disclaimer_agreed_timestamp';
const showDisclaimer = ref(false);

const handleAgree = () => {
  localStorage.setItem(DISCLAIMER_AGREED_KEY, Date.now().toString());
  showDisclaimer.value = false;
};

const handleDisagree = () => {
  if (isElectron) {
    window.api?.quitApp?.();
  } else {
    window.close();
  }
};

onMounted(() => {
  if (!isLyricWindow.value) {
    showDisclaimer.value = !localStorage.getItem(DISCLAIMER_AGREED_KEY);
  }
});
</script>

<style scoped>
.disclaimer-modal-enter-active,
.disclaimer-modal-leave-active {
  transition: opacity 0.25s ease;
}

.disclaimer-modal-enter-from,
.disclaimer-modal-leave-to {
  opacity: 0;
}
</style>
