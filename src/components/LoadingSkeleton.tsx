/**
 * NovelForge - 加载骨架屏
 *
 * 模块加载时显示的占位动画，替代白屏。
 * 用法: <LoadingSkeleton rows={5} />
 */

interface LoadingSkeletonProps {
  rows?: number
  showHeader?: boolean
}

export default function LoadingSkeleton({ rows = 4, showHeader = true }: LoadingSkeletonProps): JSX.Element {
  return (
    <div style={{ padding: 20, animation: 'fadeIn 300ms ease' }}>
      {showHeader && (
        <div style={{
          width: '40%', height: 22, borderRadius: 6,
          background: 'var(--bg-secondary)', marginBottom: 16,
          animation: 'skeleton-pulse 1.5s ease-in-out infinite',
        }} />
      )}
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: 'var(--bg-secondary)',
            animation: 'skeleton-pulse 1.5s ease-in-out infinite',
            animationDelay: `${i * 0.1}s`,
          }} />
          <div style={{ flex: 1 }}>
            <div style={{
              width: `${70 + Math.random() * 20}%`, height: 12, borderRadius: 4,
              background: 'var(--bg-secondary)', marginBottom: 6,
              animation: 'skeleton-pulse 1.5s ease-in-out infinite',
              animationDelay: `${i * 0.1}s`,
            }} />
            <div style={{
              width: `${40 + Math.random() * 30}%`, height: 10, borderRadius: 4,
              background: 'var(--bg-secondary)',
              animation: 'skeleton-pulse 1.5s ease-in-out infinite',
              animationDelay: `${i * 0.1 + 0.05}s`,
            }} />
          </div>
        </div>
      ))}
    </div>
  )
}
