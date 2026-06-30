import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import './styles/main.css'

// Vant 全量引入（MVP 阶段为简化，后期可改按需）
import Vant from 'vant'
import 'vant/lib/index.css'

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.use(Vant)
app.mount('#app')
