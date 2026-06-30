<template>
  <div class="tools">
    <header class="tools__header">
      <div>
        <p class="tools__eyebrow">
          <van-icon name="lock" />
          本地处理 · 不上传服务器
        </p>
        <h1>PDF 工具箱</h1>
        <p class="tools__lead">合并、拆分、整理和转换 PDF，全部在当前设备完成。</p>
      </div>
    </header>

    <main class="tools__main">
      <section class="tools__grid" aria-label="PDF 工具">
        <router-link
          v-for="tool in tools"
          :key="tool.path"
          class="tool-card"
          :to="tool.path"
        >
          <span class="tool-card__icon">
            <van-icon :name="tool.icon" />
          </span>
          <strong>{{ tool.title }}</strong>
          <small>{{ tool.desc }}</small>
          <em>{{ tool.tag }}</em>
        </router-link>
      </section>
    </main>
  </div>
</template>

<script setup lang="ts">
interface ToolItem {
  title: string
  desc: string
  icon: string
  path: string
  tag: string
}

const tools: ToolItem[] = [
  {
    title: 'PDF 合并',
    desc: '将多个 PDF 合成一个文件',
    icon: 'description',
    path: '/tools/pdf-merge',
    tag: 'PDF',
  },
  {
    title: 'PDF 拆分',
    desc: '按页面范围提取新的 PDF',
    icon: 'cluster-o',
    path: '/tools/pdf-split',
    tag: 'PDF',
  },
  {
    title: '页面管理',
    desc: '排序、删除、旋转 PDF 页面',
    icon: 'records-o',
    path: '/tools/pdf-pages',
    tag: '整理',
  },
  {
    title: '图片转 PDF',
    desc: '把多张图片合成为 PDF',
    icon: 'photo-o',
    path: '/tools/image-to-pdf',
    tag: '转换',
  },
  {
    title: 'PDF 转图片',
    desc: '将 PDF 页面导出为图片',
    icon: 'photo',
    path: '/tools/pdf-to-image',
    tag: '转换',
  },
  {
    title: 'PDF 压缩',
    desc: '减小扫描件 PDF 体积',
    icon: 'shrink',
    path: '/tools/pdf-compress',
    tag: '压缩',
  },
  {
    title: '添加水印',
    desc: '给 PDF 添加文字水印',
    icon: 'font-o',
    path: '/tools/pdf-watermark',
    tag: '编辑',
  },
  {
    title: '添加页码',
    desc: '为 PDF 自动添加页码',
    icon: 'orders-o',
    path: '/tools/pdf-page-number',
    tag: '编辑',
  },
]
</script>

<style scoped>
.tools {
  min-height: 100vh;
  padding: 22px 16px;
  padding-top: calc(22px + env(safe-area-inset-top));
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.7), transparent 34%),
    radial-gradient(42% 22% at 100% 0%, rgba(24, 195, 168, 0.14), transparent 70%),
    radial-gradient(46% 24% at 0% 10%, rgba(47, 111, 237, 0.13), transparent 68%),
    var(--ss-bg);
}

.tools__header {
  margin-bottom: 18px;
}

.tools__eyebrow {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 5px 12px;
  border-radius: var(--ss-radius-pill);
  background: var(--ss-primary-soft);
  color: var(--ss-primary);
  font-size: 12px;
  font-weight: 600;
}

.tools h1 {
  margin-top: 14px;
  color: var(--ss-text);
  font-size: 26px;
  line-height: 1.2;
  letter-spacing: 0;
}

.tools__lead {
  margin-top: 8px;
  color: var(--ss-text-light);
  font-size: 14px;
  line-height: 1.6;
}

.tools__grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.tool-card {
  position: relative;
  min-height: 136px;
  padding: 16px 13px;
  border: 1px solid var(--ss-border);
  border-radius: 12px;
  background: var(--ss-surface);
  box-shadow: 0 6px 18px rgba(24, 34, 71, 0.07);
  color: var(--ss-text);
  overflow: hidden;
  transition:
    transform 0.15s ease,
    border-color 0.15s ease,
    box-shadow 0.15s ease;
}

.tool-card::after {
  content: '';
  position: absolute;
  right: -18px;
  bottom: -22px;
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: rgba(47, 111, 237, 0.06);
}

.tool-card:active {
  transform: scale(0.98);
  border-color: rgba(47, 111, 237, 0.24);
  box-shadow: var(--ss-shadow-sm);
}

.tool-card__icon {
  width: 40px;
  height: 40px;
  display: grid;
  place-items: center;
  border-radius: 11px;
  background: var(--ss-primary-soft);
  color: var(--ss-primary);
  font-size: 21px;
}

.tool-card strong,
.tool-card small {
  display: block;
}

.tool-card strong {
  margin-top: 13px;
  font-size: 15px;
  line-height: 1.25;
}

.tool-card small {
  margin-top: 6px;
  color: var(--ss-text-light);
  font-size: 12px;
  line-height: 1.42;
}

.tool-card em {
  position: absolute;
  top: 12px;
  right: 12px;
  padding: 2px 8px;
  border-radius: var(--ss-radius-pill);
  background: #f5f7fb;
  color: #60708a;
  font-size: 11px;
  font-style: normal;
}
</style>
