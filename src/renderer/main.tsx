/**
 * NovelForge - React 入口
 *
 * 动态加载用户设置（主题 + 背景图）并应用到 Ant Design ConfigProvider。
 * 使用 zustand store (useUISettingsStore) 实现 SettingsPage ↔ Root 实时同步。
 */
import React, { useEffect } from 'react'
import ReactDOM from 'react-dom/client'
import { ConfigProvider, theme } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import App from '../App'
import { useUISettingsStore } from '../stores/uiSettingsStore'
import '../styles/global.css'

/** Ant Design 深色主题 token */
const darkTokens = {
  colorPrimary: '#7c3aed',
  colorBgContainer: '#1a1a2e',
  colorBgElevated: '#16213e',
  colorBgLayout: '#0f0f23',
  borderRadius: 8,
  fontFamily: "'Inter', 'Noto Sans SC', -apple-system, sans-serif",
}

/** Ant Design 浅色主题 token */
const lightTokens = {
  colorPrimary: '#6d28d9',
  colorBgContainer: '#ffffff',
  colorBgElevated: '#f5f5f5',
  colorBgLayout: '#f0f0f0',
  borderRadius: 8,
  fontFamily: "'Inter', 'Noto Sans SC', -apple-system, sans-serif",
}

/** 根组件：动态主题 + ConfigProvider */
function Root(): JSX.Element {
  const currentTheme = useUISettingsStore((s) => s.theme)
  const bgImage = useUISettingsStore((s) => s.backgroundImage)
  const bgOpacity = useUISettingsStore((s) => s.backgroundOpacity)
  const loadSettings = useUISettingsStore((s) => s.loadSettings)

  // 初始化：加载设置并应用到 DOM
  useEffect(() => {
    loadSettings().then(() => {
      const t = useUISettingsStore.getState().theme
      document.documentElement.setAttribute('data-theme', t)
    })
  }, [loadSettings])

  // 响应式：主题变化时更新 DOM attribute
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', currentTheme)
  }, [currentTheme])

  const isDark = currentTheme === 'dark'

  return (
    <ConfigProvider
      locale={zhCN}
      theme={{
        algorithm: isDark ? theme.darkAlgorithm : theme.defaultAlgorithm,
        token: isDark ? darkTokens : lightTokens,
        components: {
          Menu: {
            itemBg: 'transparent',
            subMenuItemBg: 'transparent',
          },
        },
      }}
    >
      {/* 背景图层：在 React 树内渲染，避免 z-index 问题 */}
      {bgImage && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 0,
            backgroundImage: `url(${bgImage})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
            opacity: bgOpacity / 100,
            pointerEvents: 'none',
          }}
        />
      )}
      <div style={{ position: 'relative', zIndex: 1, height: '100%' }}>
        <App />
      </div>
    </ConfigProvider>
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
)
