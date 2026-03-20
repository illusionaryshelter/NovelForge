/**
 * NovelForge - TipTap 富文本编辑器
 *
 * 功能：
 * - 富文本编辑（加粗、斜体、下划线、高亮、标题、列表等）
 * - 自动保存（debounce）
 * - 最小化工具栏
 */
import { useEffect, useCallback, useRef } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import Highlight from '@tiptap/extension-highlight'
import Underline from '@tiptap/extension-underline'
import TextAlign from '@tiptap/extension-text-align'
import { Button, Tooltip, Divider } from 'antd'
import {
  BoldOutlined,
  ItalicOutlined,
  UnderlineOutlined,
  StrikethroughOutlined,
  HighlightOutlined,
  OrderedListOutlined,
  UnorderedListOutlined,
  AlignLeftOutlined,
  AlignCenterOutlined,
  AlignRightOutlined,
  UndoOutlined,
  RedoOutlined,
} from '@ant-design/icons'

interface NovelEditorProps {
  content: string  // TipTap JSON string or empty
  onSave: (content: string) => void
  placeholder?: string
}

export default function NovelEditor({ content, onSave, placeholder = '开始写作...' }: NovelEditorProps): JSX.Element {
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Placeholder.configure({ placeholder }),
      Highlight,
      Underline,
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
    ],
    content: content ? (() => {
      try { return JSON.parse(content) }
      catch { return content } // 纯文本 fallback
    })() : '',
    onUpdate: ({ editor }) => {
      // Debounce 自动保存（1.5 秒后保存）
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      saveTimerRef.current = setTimeout(() => {
        const json = JSON.stringify(editor.getJSON())
        onSave(json)
      }, 1500)
    },
  })

  // 内容变更时重新设置编辑器内容
  useEffect(() => {
    if (!editor) return
    const currentJson = JSON.stringify(editor.getJSON())
    if (content !== currentJson && content !== undefined) {
      try {
        const parsed = content ? JSON.parse(content) : ''
        editor.commands.setContent(parsed)
      } catch {
        editor.commands.setContent(content || '')
      }
    }
  }, [content]) // eslint-disable-line react-hooks/exhaustive-deps

  // 清理定时器
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
  }, [])

  if (!editor) return <div />

  /** 工具栏按钮 */
  const ToolBtn = ({ icon, active, onClick, title }: {
    icon: React.ReactNode; active?: boolean; onClick: () => void; title: string
  }) => (
    <Tooltip title={title} placement="bottom">
      <Button
        type={active ? 'primary' : 'text'}
        size="small"
        icon={icon}
        onClick={onClick}
        style={{
          minWidth: 28, height: 28,
          background: active ? 'var(--accent-primary)' : 'transparent',
        }}
      />
    </Tooltip>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* 工具栏 */}
      <div style={{
        display: 'flex', gap: 2, alignItems: 'center', padding: '4px 8px',
        borderBottom: '1px solid var(--border-subtle)', flexShrink: 0, flexWrap: 'wrap',
      }}>
        <ToolBtn icon={<BoldOutlined />} active={editor.isActive('bold')}
          onClick={() => editor.chain().focus().toggleBold().run()} title="加粗" />
        <ToolBtn icon={<ItalicOutlined />} active={editor.isActive('italic')}
          onClick={() => editor.chain().focus().toggleItalic().run()} title="斜体" />
        <ToolBtn icon={<UnderlineOutlined />} active={editor.isActive('underline')}
          onClick={() => editor.chain().focus().toggleUnderline().run()} title="下划线" />
        <ToolBtn icon={<StrikethroughOutlined />} active={editor.isActive('strike')}
          onClick={() => editor.chain().focus().toggleStrike().run()} title="删除线" />
        <ToolBtn icon={<HighlightOutlined />} active={editor.isActive('highlight')}
          onClick={() => editor.chain().focus().toggleHighlight().run()} title="高亮" />

        <Divider type="vertical" style={{ margin: '0 4px' }} />

        <ToolBtn icon={<span style={{ fontSize: 12, fontWeight: 700 }}>H1</span>}
          active={editor.isActive('heading', { level: 1 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} title="标题1" />
        <ToolBtn icon={<span style={{ fontSize: 12, fontWeight: 700 }}>H2</span>}
          active={editor.isActive('heading', { level: 2 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} title="标题2" />
        <ToolBtn icon={<span style={{ fontSize: 12, fontWeight: 700 }}>H3</span>}
          active={editor.isActive('heading', { level: 3 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} title="标题3" />

        <Divider type="vertical" style={{ margin: '0 4px' }} />

        <ToolBtn icon={<UnorderedListOutlined />} active={editor.isActive('bulletList')}
          onClick={() => editor.chain().focus().toggleBulletList().run()} title="无序列表" />
        <ToolBtn icon={<OrderedListOutlined />} active={editor.isActive('orderedList')}
          onClick={() => editor.chain().focus().toggleOrderedList().run()} title="有序列表" />

        <Divider type="vertical" style={{ margin: '0 4px' }} />

        <ToolBtn icon={<AlignLeftOutlined />} active={editor.isActive({ textAlign: 'left' })}
          onClick={() => editor.chain().focus().setTextAlign('left').run()} title="左对齐" />
        <ToolBtn icon={<AlignCenterOutlined />} active={editor.isActive({ textAlign: 'center' })}
          onClick={() => editor.chain().focus().setTextAlign('center').run()} title="居中" />
        <ToolBtn icon={<AlignRightOutlined />} active={editor.isActive({ textAlign: 'right' })}
          onClick={() => editor.chain().focus().setTextAlign('right').run()} title="右对齐" />

        <Divider type="vertical" style={{ margin: '0 4px' }} />

        <ToolBtn icon={<UndoOutlined />} onClick={() => editor.chain().focus().undo().run()} title="撤销" />
        <ToolBtn icon={<RedoOutlined />} onClick={() => editor.chain().focus().redo().run()} title="重做" />

        {/* 字数统计 */}
        <span style={{
          marginLeft: 'auto', fontSize: 11, color: 'var(--text-muted)', padding: '0 8px',
        }}>
          {editor.storage.characterCount?.characters?.() ?? editor.getText().length} 字
        </span>
      </div>

      {/* 编辑区 */}
      <div style={{
        flex: 1, overflow: 'auto', padding: '16px 24px',
        fontSize: 15, lineHeight: 1.8,
      }}>
        <EditorContent editor={editor} style={{ height: '100%' }} />
      </div>
    </div>
  )
}
