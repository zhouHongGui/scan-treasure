import { createRouter, createWebHashHistory } from 'vue-router'
import Home from '@/views/Home.vue'
import Tools from '@/views/Tools.vue'

const routes = [
  { path: '/', name: 'home', component: Home },
  { path: '/scan', redirect: '/' },
  { path: '/tools', name: 'tools', component: Tools },
  {
    path: '/tools/pdf-merge',
    name: 'pdfMerge',
    component: () => import('@/views/pdf/PdfMerge.vue'),
  },
  {
    path: '/tools/pdf-split',
    name: 'pdfSplit',
    component: () => import('@/views/pdf/PdfSplit.vue'),
  },
  {
    path: '/tools/pdf-pages',
    name: 'pdfPages',
    component: () => import('@/views/pdf/PdfPages.vue'),
  },
  {
    path: '/tools/image-to-pdf',
    name: 'imageToPdf',
    component: () => import('@/views/pdf/ImageToPdf.vue'),
  },
  {
    path: '/tools/pdf-to-image',
    name: 'pdfToImage',
    component: () => import('@/views/pdf/PdfToImage.vue'),
  },
  {
    path: '/tools/pdf-compress',
    name: 'pdfCompress',
    component: () => import('@/views/pdf/PdfCompress.vue'),
  },
  {
    path: '/tools/pdf-watermark',
    name: 'pdfWatermark',
    component: () => import('@/views/pdf/PdfWatermark.vue'),
  },
  {
    path: '/tools/pdf-page-number',
    name: 'pdfPageNumber',
    component: () => import('@/views/pdf/PdfPageNumber.vue'),
  },
  {
    path: '/edit',
    name: 'edit',
    component: () => import('@/views/Edit.vue'),
  },
  {
    path: '/enhance',
    name: 'enhance',
    component: () => import('@/views/Enhance.vue'),
  },
  {
    path: '/idcard',
    name: 'idcard',
    component: () => import('@/views/IdCard.vue'),
  },
]

// hash 路由：Web 静态托管无需 SPA 回退配置，Capacitor 包内刷新也不会 404
const router = createRouter({
  history: createWebHashHistory(),
  routes,
})

export default router
