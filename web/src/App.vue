<template>
  <!-- 不用 keep-alive：否则 Edit/Enhance 的 onMounted 只在首次进入触发，
       用户选第二张图再进入会看到旧图。中间结果已缓存在全局 store，无需 keep-alive 复用。 -->
  <router-view />

  <!-- 全局摄像头取景层：useCameraCapture.open() 打开，拍摄/取消后自动卸载并释放摄像头 -->
  <CameraOverlay v-if="camera.isOpen" />
</template>

<script setup lang="ts">
import CameraOverlay from '@/components/CameraOverlay.vue'
import { useCameraCapture } from '@/composables/useCameraCapture'

const camera = useCameraCapture()
</script>
