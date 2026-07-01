<template>
  <!-- 不用 keep-alive：否则 Edit/Enhance 的 onMounted 只在首次进入触发，
       用户选第二张图再进入会看到旧图。中间结果已缓存在全局 store，无需 keep-alive 复用。 -->
  <div :class="{ 'app-with-tabbar': showTabbar }">
    <router-view />
  </div>

  <van-tabbar v-if="showTabbar" route safe-area-inset-bottom>
    <van-tabbar-item replace to="/" icon="scan">扫描</van-tabbar-item>
    <van-tabbar-item replace to="/tools" icon="apps-o">工具</van-tabbar-item>
  </van-tabbar>

  <!-- 全局摄像头取景层：useCameraCapture.open() 打开，拍摄/取消后自动卸载并释放摄像头 -->
  <CameraOverlay v-if="showCameraOverlay" />
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { showConfirmDialog } from 'vant'
import { App as CapacitorApp } from '@capacitor/app'
import { Capacitor, type PluginListenerHandle } from '@capacitor/core'
import CameraOverlay from '@/components/CameraOverlay.vue'
import { useCameraCapture } from '@/composables/useCameraCapture'

const camera = useCameraCapture()
const route = useRoute()
const router = useRouter()
const showTabbar = computed(() => route.path === '/' || route.path === '/scan' || route.path === '/tools')
const showCameraOverlay = computed(() => camera.isOpen.value && camera.hasRequest.value)
const rootPaths = new Set(['/', '/scan', '/tools'])
let backButtonListener: PluginListenerHandle | null = null
let exitConfirming = false

camera.reset()

function isRootRoute(): boolean {
  return rootPaths.has(route.path)
}

function fallbackBack(): void {
  if (route.path.startsWith('/tools/')) {
    router.replace('/tools')
  } else if (route.path === '/enhance') {
    router.replace('/edit')
  } else {
    router.replace('/')
  }
}

async function confirmExitApp(): Promise<void> {
  if (exitConfirming) return
  exitConfirming = true
  try {
    await showConfirmDialog({
      title: '退出扫描宝？',
      message: '再次确认后将关闭应用。',
      confirmButtonText: '退出',
      cancelButtonText: '取消',
    })
    await CapacitorApp.exitApp()
  } catch {
    /* 用户取消退出 */
  } finally {
    exitConfirming = false
  }
}

onMounted(async () => {
  if (!Capacitor.isNativePlatform()) return

  backButtonListener = await CapacitorApp.addListener('backButton', ({ canGoBack }) => {
    if (showCameraOverlay.value) {
      camera.close(null)
      return
    }

    if (isRootRoute()) {
      void confirmExitApp()
      return
    }

    if (canGoBack) {
      router.back()
    } else {
      fallbackBack()
    }
  })
})

onBeforeUnmount(() => {
  void backButtonListener?.remove()
  backButtonListener = null
})
</script>

<style>
.app-with-tabbar {
  min-height: 100%;
}

.app-with-tabbar .home,
.app-with-tabbar .tools {
  padding-bottom: calc(78px + env(safe-area-inset-bottom));
}
</style>
