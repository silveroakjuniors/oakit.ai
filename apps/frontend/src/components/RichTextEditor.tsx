'use client';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import TextAlign from '@tiptap/extension-text-align';
import { useEffect } from 'react';

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: string;
}

const COLORS = [
  '#000000', '#374151', '#6B7280', '#DC2626', '#D97706',
  '#059669', '#2563EB', '#7C3AED', '#DB2777',
];

export default function RichTextEditor({ value, onChange, placeholder, minHeight = '180px' }: RichTextEditorProps) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      Underline,
      TextStyle,
      Color,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
    ],
    content: value || '',
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none focus:outline-none px-3 py-2.5 text-sm text-neutral-800',
        style: `min-height: ${minHeight}`,
      },
    },
  });

  // Sync external value changes (e.g. when Oakie fills in content)
  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    // Only update if content actually changed to avoid cursor jump
    if (value !== current && value !== undefined) {
      editor.commands.setContent(value || '', { emitUpdate: false });
    }
  }, [value]);

  if (!editor) return null;

  const btn = (active: boolean, onClick: () => void, title: string, children: React.ReactNode) => (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`p-1.5 rounded-lg text-xs font-medium transition-colors ${
        active
          ? 'bg-primary-100 text-primary-700'
          : 'text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700'
      }`}
    >
      {children}
    </button>
  );

  return (
    <div className="border border-neutral-200 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-primary-400/30">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 border-b border-neutral-100 bg-neutral-50">
        {/* Bold */}
        {btn(editor.isActive('bold'), () => editor.chain().focus().toggleBold().run(), 'Bold', <span className="font-bold">B</span>)}
        {/* Italic */}
        {btn(editor.isActive('italic'), () => editor.chain().focus().toggleItalic().run(), 'Italic', <span className="italic">I</span>)}
        {/* Underline */}
        {btn(editor.isActive('underline'), () => editor.chain().focus().toggleUnderline().run(), 'Underline', <span className="underline">U</span>)}

        <div className="w-px h-4 bg-neutral-200 mx-1" />

        {/* Heading */}
        {btn(editor.isActive('heading', { level: 2 }), () => editor.chain().focus().toggleHeading({ level: 2 }).run(), 'Heading', <span className="font-bold text-[11px]">H2</span>)}
        {btn(editor.isActive('heading', { level: 3 }), () => editor.chain().focus().toggleHeading({ level: 3 }).run(), 'Heading 3', <span className="font-bold text-[11px]">H3</span>)}

        <div className="w-px h-4 bg-neutral-200 mx-1" />

        {/* Lists */}
        {btn(editor.isActive('bulletList'), () => editor.chain().focus().toggleBulletList().run(), 'Bullet List',
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
        )}
        {btn(editor.isActive('orderedList'), () => editor.chain().focus().toggleOrderedList().run(), 'Numbered List',
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 6h13M7 12h13M7 18h13M3 6h.01M3 12h.01M3 18h.01" /></svg>
        )}

        <div className="w-px h-4 bg-neutral-200 mx-1" />

        {/* Alignment */}
        {btn(editor.isActive({ textAlign: 'left' }), () => editor.chain().focus().setTextAlign('left').run(), 'Align Left',
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h10M4 18h14" /></svg>
        )}
        {btn(editor.isActive({ textAlign: 'center' }), () => editor.chain().focus().setTextAlign('center').run(), 'Align Center',
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M7 12h10M5 18h14" /></svg>
        )}
        {btn(editor.isActive({ textAlign: 'right' }), () => editor.chain().focus().setTextAlign('right').run(), 'Align Right',
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M10 12h10M6 18h14" /></svg>
        )}

        <div className="w-px h-4 bg-neutral-200 mx-1" />

        {/* Color picker */}
        <div className="flex items-center gap-0.5">
          {COLORS.map(color => (
            <button
              key={color}
              type="button"
              title={`Color: ${color}`}
              onClick={() => editor.chain().focus().setColor(color).run()}
              className="w-4 h-4 rounded-full border border-white shadow-sm hover:scale-110 transition-transform"
              style={{ backgroundColor: color }}
            />
          ))}
          {/* Custom color */}
          <label title="Custom color" className="cursor-pointer">
            <input
              type="color"
              className="w-0 h-0 opacity-0 absolute"
              onChange={e => editor.chain().focus().setColor(e.target.value).run()}
            />
            <span className="w-4 h-4 rounded-full border border-neutral-300 bg-gradient-to-br from-red-400 via-green-400 to-blue-400 block hover:scale-110 transition-transform" />
          </label>
        </div>

        <div className="w-px h-4 bg-neutral-200 mx-1" />

        {/* Clear formatting */}
        {btn(false, () => editor.chain().focus().clearNodes().unsetAllMarks().run(), 'Clear Formatting',
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        )}
      </div>

      {/* Editor area */}
      <div className="bg-white relative">
        {!value && (
          <p className="absolute top-2.5 left-3 text-sm text-neutral-400 pointer-events-none select-none">
            {placeholder || 'Start typing…'}
          </p>
        )}
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
