import { createRouter, createWebHashHistory } from 'vue-router'
import Home from '@/views/Home.vue'

const routes = [
  { path: '/', name: 'home', component: Home },
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
