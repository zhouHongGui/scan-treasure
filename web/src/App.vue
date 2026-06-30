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
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import CameraOverlay from '@/components/CameraOverlay.vue'
import { useCameraCapture } from '@/composables/useCameraCapture'

const camera = useCameraCapture()
const route = useRoute()
const showTabbar = computed(() => route.path === '/' || route.path === '/scan' || route.path === '/tools')
const showCameraOverlay = computed(() => camera.isOpen.value && camera.hasRequest.value)

camera.reset()
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
