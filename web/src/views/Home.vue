<template>
  <div class="site">
    <section class="hero" :style="{ '--hero-image': `url(${heroImage})` }">
      <nav class="hero__nav" aria-label="主导航">
        <a class="hero__brand" href="#" aria-label="扫描宝首页">
          <span class="hero__logo"><van-icon name="description" /></span>
          <span>
            <strong>扫描宝</strong>
            <small>Scan Treasure</small>
          </span>
        </a>
        <div class="hero__links">
          <a href="#features">功能</a>
          <a href="#privacy">隐私</a>
          <a href="#faq">问答</a>
        </div>
      </nav>

      <div class="hero__content">
        <p class="hero__eyebrow"><van-icon name="lock" /> 开源 H5 文档 / 证件扫描工具</p>
        <h1>扫描宝 Scan Treasure</h1>
        <p class="hero__lead">
          手机拍照或相册选图，自动识别文档边缘、校正透视、增强画面，并导出 PDF。
          全部图像处理在浏览器本地完成，照片不会上传到服务器。
        </p>
        <div class="hero__actions" aria-label="开始使用扫描宝">
          <van-button type="primary" round class="hero__btn" @click="openDocSheet">
            <van-icon name="photo-o" />
            开始文档扫描
          </van-button>
          <van-button plain round class="hero__btn hero__btn--plain" @click="goIdCard">
            <van-icon name="credit-pay" />
            身份证拼版
          </van-button>
        </div>
        <dl class="hero__facts" aria-label="产品特点">
          <div>
            <dt>100%</dt>
            <dd>本地处理</dd>
          </div>
          <div>
            <dt>0</dt>
            <dd>登录 / 广告 / 内购</dd>
          </div>
          <div>
            <dt>MIT</dt>
            <dd>开源协议</dd>
          </div>
        </dl>
      </div>
    </section>

    <main>
      <section class="scan-band" aria-labelledby="scan-title">
        <div class="site__inner scan-band__inner">
          <div>
            <p class="section-kicker"><van-icon name="apps-o" /> 在线扫描入口</p>
            <h2 id="scan-title">直接在浏览器里生成清晰扫描件</h2>
          </div>
          <div class="scan-band__actions">
            <button class="scan-action" type="button" @click="openDocSheet">
              <span><van-icon name="description" /></span>
              <strong>文档扫描</strong>
              <small>合同、书页、表格、票据</small>
            </button>
            <button class="scan-action" type="button" @click="goIdCard">
              <span><van-icon name="credit-pay" /></span>
              <strong>证件扫描</strong>
              <small>身份证正反面合成 A4</small>
            </button>
          </div>
          <p v-if="loading" class="scan-status">正在读取图片...</p>
          <p v-if="error" class="scan-status scan-status--error">{{ error }}</p>
        </div>
      </section>

      <section id="features" class="section section--white" aria-labelledby="features-title">
        <div class="site__inner">
          <p class="section-kicker"><van-icon name="passed" /> 核心功能</p>
          <h2 id="features-title">为移动端优化的免费扫描工具</h2>
          <div class="feature-grid">
            <article class="feature">
              <span><van-icon name="scan" /></span>
              <h3>自动识别文档边缘</h3>
              <p>识别纸张、合同、书页和证件的四个角，自动框选后仍可手动微调。</p>
            </article>
            <article class="feature">
              <span><van-icon name="exchange" /></span>
              <h3>透视校正与图像增强</h3>
              <p>把斜拍照片拉平成正视图，并提供彩色、增亮、灰度、黑白等效果。</p>
            </article>
            <article class="feature">
              <span><van-icon name="description" /></span>
              <h3>图片转 PDF</h3>
              <p>扫描完成后可导出 PDF 或图片，适合保存电子档、打印或发送材料。</p>
            </article>
            <article class="feature">
              <span><van-icon name="credit-pay" /></span>
              <h3>身份证扫描拼版</h3>
              <p>选择正反面照片，自动校正后合成一张适合归档的 A4 扫描件。</p>
            </article>
          </div>
        </div>
      </section>

      <section id="privacy" class="section section--tint" aria-labelledby="privacy-title">
        <div class="site__inner privacy-layout">
          <div>
            <p class="section-kicker"><van-icon name="lock" /> 隐私友好</p>
            <h2 id="privacy-title">没有服务器，也就没有上传风险</h2>
            <p class="section-copy">
              扫描宝采用纯前端架构，边缘检测、透视校正、图像增强和 PDF 生成都在你的设备上完成。
              项目不提供账号系统，不存储用户文件，不把证件、合同、票据上传到云端。
            </p>
          </div>
          <ul class="privacy-list">
            <li><van-icon name="checked" /> 无强制登录</li>
            <li><van-icon name="checked" /> 无图片上传接口</li>
            <li><van-icon name="checked" /> 可静态托管和自行部署</li>
            <li><van-icon name="checked" /> 适合个人文档数字化</li>
          </ul>
        </div>
      </section>

      <section class="section section--white" aria-labelledby="workflow-title">
        <div class="site__inner">
          <p class="section-kicker"><van-icon name="guide-o" /> 使用流程</p>
          <h2 id="workflow-title">四步完成文档扫描</h2>
          <ol class="steps">
            <li>
              <span>1</span>
              <strong>拍照或选图</strong>
              <p>用手机拍下纸质材料，或从相册导入已有照片。</p>
            </li>
            <li>
              <span>2</span>
              <strong>调整边缘</strong>
              <p>自动框选失败时，可拖动四个角点手动校准。</p>
            </li>
            <li>
              <span>3</span>
              <strong>增强画面</strong>
              <p>选择彩色、增亮、灰度或黑白模式，让文字更清晰。</p>
            </li>
            <li>
              <span>4</span>
              <strong>导出文件</strong>
              <p>将扫描结果保存为图片，或生成便于归档的 PDF。</p>
            </li>
          </ol>
        </div>
      </section>

      <section id="faq" class="section section--tint" aria-labelledby="faq-title">
        <div class="site__inner">
          <p class="section-kicker"><van-icon name="question-o" /> 常见问题</p>
          <h2 id="faq-title">关于扫描宝的几个答案</h2>
          <div class="faq-list">
            <article>
              <h3>扫描宝会上传我的证件或合同吗？</h3>
              <p>不会。项目定位是纯本地处理，图片读取、校正、增强、PDF 导出都在浏览器内完成。</p>
            </article>
            <article>
              <h3>它适合做什么？</h3>
              <p>适合把自己的合同、笔记、票据、书页和证件照片整理成清晰电子件。</p>
            </article>
            <article>
              <h3>它是免费的吗？</h3>
              <p>是。扫描宝是 MIT 协议开源项目，可免费使用，也可以自行部署和二次开发。</p>
            </article>
          </div>
        </div>
      </section>
    </main>

    <footer class="site-footer">
      <div class="site__inner site-footer__inner">
        <span>扫描宝 · Scan Treasure</span>
        <span>仅用于合法的文档数字化，请勿用于伪造、变造证件或其他违法用途。</span>
      </div>
    </footer>

    <input
      ref="fileInputRef"
      type="file"
      accept="image/*"
      class="site__file-input"
      @change="onFileChange"
    />

    <van-action-sheet
      v-model:show="docSheet"
      :actions="docActions"
      cancel-text="取消"
      close-on-click-action
      @select="onDocSelect"
    />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useImagePicker } from '@/composables/useImagePicker'
import { useScanStore } from '@/store/scan'
import { loadImage } from '@/utils/image'
import { useCameraCapture } from '@/composables/useCameraCapture'
import type { ActionSheetAction } from 'vant'

const router = useRouter()
const store = useScanStore()
const fileInputRef = ref<HTMLInputElement | null>(null)
const { image, loading, error, loadFile } = useImagePicker()
const camera = useCameraCapture()

const publicBase = import.meta.env.BASE_URL.endsWith('/')
  ? import.meta.env.BASE_URL
  : `${import.meta.env.BASE_URL}/`
const heroImage = `${publicBase}official-hero.png`

const docSheet = ref(false)
const docActions: ActionSheetAction[] = [
  { name: '拍照扫描' },
  { name: '从相册选择' },
]

function triggerPick(): void {
  fileInputRef.value?.click()
}

function openDocSheet(): void {
  docSheet.value = true
}

function onDocSelect(item: ActionSheetAction): void {
  if (item.name === '拍照扫描') {
    void fromCamera()
  } else {
    triggerPick()
  }
}

function goIdCard(): void {
  router.push('/idcard')
}

async function fromCamera(): Promise<void> {
  const dataUrl = await camera.open()
  if (!dataUrl) return
  try {
    const img = await loadImage(dataUrl)
    store.reset()
    store.setImage({
      dataUrl,
      url: dataUrl,
      width: img.naturalWidth,
      height: img.naturalHeight,
    })
    router.push('/edit')
  } catch {
    /* 忽略 */
  }
}

async function onFileChange(e: Event): Promise<void> {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  await loadFile(file)

  if (image.value) {
    store.reset()
    store.setImage(image.value)
    router.push('/edit')
  }
  input.value = ''
}
</script>

<style scoped>
.site {
  min-height: 100vh;
  background: #f4f7fb;
  color: #17212f;
}

.site a {
  color: inherit;
  text-decoration: none;
}

.site__inner {
  width: min(70rem, calc(100% - 2rem));
  margin: 0 auto;
}

.hero {
  position: relative;
  isolation: isolate;
  min-height: 78svh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background-color: #eef4f6;
  background-image: var(--hero-image);
  background-size: cover;
  background-position: center;
}

.hero::before {
  content: '';
  position: absolute;
  inset: 0;
  z-index: -1;
  background: linear-gradient(
    90deg,
    rgba(247, 250, 252, 0.95) 0%,
    rgba(247, 250, 252, 0.82) 42%,
    rgba(247, 250, 252, 0.12) 100%
  );
}

.hero__nav {
  width: min(76rem, calc(100% - 2rem));
  margin: 0 auto;
  padding: 1rem 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.hero__brand {
  display: inline-flex;
  align-items: center;
  gap: 0.75rem;
}

.hero__brand strong,
.hero__brand small {
  display: block;
}

.hero__brand strong {
  font-size: 1rem;
}

.hero__brand small {
  color: #516074;
  font-size: 0.78rem;
}

.hero__logo {
  width: 2.75rem;
  height: 2.75rem;
  display: grid;
  place-items: center;
  border-radius: 0.5rem;
  background: #2563eb;
  color: #fff;
  font-size: 1.45rem;
  box-shadow: 0 0.65rem 1.7rem rgba(37, 99, 235, 0.25);
}

.hero__links {
  display: flex;
  align-items: center;
  gap: 1.25rem;
  color: #405064;
  font-size: 0.92rem;
  font-weight: 600;
}

.hero__links a:focus-visible,
.hero__links a:hover {
  color: #0f766e;
}

.hero__content {
  width: min(76rem, calc(100% - 2rem));
  margin: auto auto 3rem;
  padding: 2rem 0;
}

.hero__eyebrow,
.section-kicker {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  color: #0f766e;
  font-size: 0.92rem;
  font-weight: 700;
}

.hero h1 {
  max-width: 36rem;
  margin-top: 1rem;
  font-size: 4rem;
  line-height: 1.05;
  font-weight: 800;
}

.hero__lead {
  max-width: 36rem;
  margin-top: 1.25rem;
  color: #344254;
  font-size: 1.12rem;
  line-height: 1.75;
}

.hero__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.85rem;
  margin-top: 1.7rem;
}

.hero__btn {
  min-width: 10.75rem;
}

.hero__btn :deep(.van-button__content) {
  gap: 0.45rem;
}

.hero__btn--plain {
  border-color: rgba(23, 33, 47, 0.18);
  background: rgba(255, 255, 255, 0.72);
  color: #17212f;
}

.hero__facts {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 8.5rem));
  gap: 0.85rem;
  margin-top: 2rem;
}

.hero__facts div {
  padding: 0.85rem;
  border: 0.0625rem solid rgba(23, 33, 47, 0.08);
  border-radius: 0.5rem;
  background: rgba(255, 255, 255, 0.68);
}

.hero__facts dt {
  font-size: 1.45rem;
  font-weight: 800;
  color: #2563eb;
}

.hero__facts dd {
  margin-top: 0.2rem;
  color: #516074;
  font-size: 0.84rem;
}

.scan-band {
  border-top: 0.0625rem solid #dce5ee;
  border-bottom: 0.0625rem solid #dce5ee;
  background: #ffffff;
}

.scan-band__inner {
  padding: 2rem 0;
  display: grid;
  grid-template-columns: minmax(0, 0.9fr) minmax(24rem, 1.1fr);
  align-items: center;
  gap: 2rem;
}

.scan-band h2,
.section h2 {
  margin-top: 0.7rem;
  color: #17212f;
  font-size: 2rem;
  line-height: 1.2;
}

.scan-band__actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.9rem;
}

.scan-action {
  min-height: 7.5rem;
  display: grid;
  align-content: center;
  justify-items: start;
  gap: 0.4rem;
  border: 0.0625rem solid #d9e2ec;
  border-radius: 0.5rem;
  padding: 1rem;
  background: #fbfcfe;
  color: #17212f;
  text-align: left;
  cursor: pointer;
  transition:
    transform 0.15s ease,
    border-color 0.15s ease,
    box-shadow 0.15s ease;
}

.scan-action:hover,
.scan-action:focus-visible {
  border-color: #2f6fed;
  box-shadow: 0 0.85rem 2rem rgba(37, 99, 235, 0.12);
  transform: translateY(-0.1rem);
  outline: none;
}

.scan-action span,
.feature span {
  width: 2.35rem;
  height: 2.35rem;
  display: grid;
  place-items: center;
  border-radius: 0.5rem;
  background: #e8f7f4;
  color: #0f766e;
  font-size: 1.25rem;
}

.scan-action strong {
  margin-top: 0.25rem;
  font-size: 1rem;
}

.scan-action small {
  color: #637083;
  font-size: 0.84rem;
}

.scan-status {
  grid-column: 1 / -1;
  color: #637083;
  font-size: 0.9rem;
}

.scan-status--error {
  color: #c2410c;
}

.section {
  padding: 4.75rem 0;
}

.section--white {
  background: #ffffff;
}

.section--tint {
  background: #eef6f3;
}

.section-copy {
  max-width: 43rem;
  margin-top: 1.1rem;
  color: #405064;
  font-size: 1.02rem;
  line-height: 1.8;
}

.feature-grid {
  margin-top: 2rem;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 1rem;
}

.feature {
  min-height: 13rem;
  padding: 1.1rem;
  border: 0.0625rem solid #e1e7ef;
  border-radius: 0.5rem;
  background: #ffffff;
}

.feature h3 {
  margin-top: 1rem;
  font-size: 1.05rem;
}

.feature p {
  margin-top: 0.65rem;
  color: #516074;
  font-size: 0.92rem;
  line-height: 1.7;
}

.privacy-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(18rem, 0.72fr);
  gap: 2rem;
  align-items: center;
}

.privacy-list {
  display: grid;
  gap: 0.75rem;
  list-style: none;
}

.privacy-list li {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.9rem 1rem;
  border: 0.0625rem solid #cfe3dc;
  border-radius: 0.5rem;
  background: rgba(255, 255, 255, 0.72);
  color: #263548;
  font-weight: 600;
}

.privacy-list .van-icon {
  color: #0f766e;
}

.steps {
  margin-top: 2rem;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 1rem;
  list-style: none;
}

.steps li {
  min-height: 11rem;
  padding: 1rem;
  border: 0.0625rem solid #e1e7ef;
  border-radius: 0.5rem;
  background: #fbfcfe;
}

.steps span {
  width: 2.1rem;
  height: 2.1rem;
  display: grid;
  place-items: center;
  border-radius: 50%;
  background: #2563eb;
  color: #fff;
  font-weight: 800;
}

.steps strong {
  display: block;
  margin-top: 1rem;
}

.steps p {
  margin-top: 0.55rem;
  color: #516074;
  font-size: 0.9rem;
  line-height: 1.65;
}

.faq-list {
  margin-top: 2rem;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 1rem;
}

.faq-list article {
  padding: 1.1rem;
  border: 0.0625rem solid #cfe3dc;
  border-radius: 0.5rem;
  background: rgba(255, 255, 255, 0.78);
}

.faq-list h3 {
  font-size: 1rem;
}

.faq-list p {
  margin-top: 0.65rem;
  color: #405064;
  font-size: 0.92rem;
  line-height: 1.7;
}

.site-footer {
  background: #17212f;
  color: rgba(255, 255, 255, 0.78);
}

.site-footer__inner {
  padding: 1.4rem 0;
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  font-size: 0.86rem;
}

.site__file-input {
  display: none;
}

@media (max-width: 62rem) {
  .hero {
    min-height: 82svh;
    background-position: 58% center;
  }

  .hero::before {
    background: rgba(247, 250, 252, 0.78);
  }

  .hero__links {
    display: none;
  }

  .hero h1 {
    max-width: 30rem;
    font-size: 2.75rem;
  }

  .hero__lead {
    max-width: 31rem;
    font-size: 1rem;
  }

  .hero__facts,
  .scan-band__inner,
  .privacy-layout,
  .steps,
  .faq-list {
    grid-template-columns: 1fr;
  }

  .feature-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .scan-band__inner {
    gap: 1.2rem;
  }
}

@media (max-width: 38rem) {
  .site__inner,
  .hero__nav,
  .hero__content {
    width: min(100% - 1.25rem, 70rem);
  }

  .hero {
    min-height: 84svh;
    background-position: 63% center;
  }

  .hero__content {
    margin-bottom: 1.5rem;
    padding: 1rem 0;
  }

  .hero h1 {
    font-size: 2.35rem;
  }

  .hero__actions,
  .hero__btn,
  .hero__facts,
  .scan-band__actions,
  .feature-grid {
    width: 100%;
    grid-template-columns: 1fr;
  }

  .hero__facts {
    gap: 0.55rem;
  }

  .section {
    padding: 3.25rem 0;
  }

  .scan-band h2,
  .section h2 {
    font-size: 1.55rem;
  }

  .site-footer__inner {
    flex-direction: column;
  }
}
</style>
