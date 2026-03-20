/**
 * NovelForge - 根组件
 *
 * 路由结构：
 * - / : 项目选择页
 * - /workspace : 工作区（含侧边栏布局）
 */
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useProjectStore } from './stores/projectStore'
import ProjectSelectPage from './pages/ProjectSelectPage'
import AppLayout from './components/layout/AppLayout'

function App(): JSX.Element {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<ProjectSelectPage />} />
        <Route path="/workspace/*" element={<ProtectedWorkspace />} />
      </Routes>
    </HashRouter>
  )
}

/** 工作区路由守卫：必须先打开项目 */
function ProtectedWorkspace(): JSX.Element {
  const currentProject = useProjectStore((s) => s.currentProject)
  if (!currentProject) {
    return <Navigate to="/" replace />
  }
  return <AppLayout />
}

export default App
