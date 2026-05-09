'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Bold, Eraser, List, ListOrdered } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getRichTextPlainText, normalizeRichTextValue, type ResumeRichTextPreset } from './resume-rich-text';

interface ResumeRichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  preset?: ResumeRichTextPreset;
  className?: string;
}

export function ResumeRichTextEditor({
  value,
  onChange,
  placeholder = '请输入内容',
  preset = 'paragraph',
  className,
}: ResumeRichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const [focused, setFocused] = useState(false);

  const normalizedValue = useMemo(() => normalizeRichTextValue(value, preset), [preset, value]);
  const isEmpty = !getRichTextPlainText(normalizedValue);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) {
      return;
    }

    if (editor.innerHTML !== normalizedValue) {
      editor.innerHTML = normalizedValue;
    }
  }, [normalizedValue]);

  const emitValue = () => {
    const editor = editorRef.current;
    if (!editor) {
      return;
    }

    const nextValue = normalizeRichTextValue(editor.innerHTML, preset);
    if (editor.innerHTML !== nextValue) {
      editor.innerHTML = nextValue;
    }
    onChange(nextValue);
  };

  const runCommand = (command: 'bold' | 'insertUnorderedList' | 'insertOrderedList' | 'removeFormat') => {
    const editor = editorRef.current;
    if (!editor) {
      return;
    }

    editor.focus();
    document.execCommand('styleWithCSS', false, 'false');
    document.execCommand('defaultParagraphSeparator', false, 'p');
    document.execCommand(command, false);
    requestAnimationFrame(emitValue);
  };

  return (
    <div
      className={cn(
        'rounded-md border bg-[#F7F8FA] transition',
        focused ? 'border-[#4183FF] ring-2 ring-[#4183FF]/15' : 'border-[#E5E6EB]',
        className,
      )}
    >
      <div className="flex items-center gap-1 border-b border-[#E5E6EB] px-2 py-1.5">
        <EditorCommandButton label="加粗" onClick={() => runCommand('bold')}>
          <Bold className="h-3.5 w-3.5" />
        </EditorCommandButton>
        <EditorCommandButton label="项目符号" onClick={() => runCommand('insertUnorderedList')}>
          <List className="h-3.5 w-3.5" />
        </EditorCommandButton>
        <EditorCommandButton label="数字排序" onClick={() => runCommand('insertOrderedList')}>
          <ListOrdered className="h-3.5 w-3.5" />
        </EditorCommandButton>
        <EditorCommandButton label="清除格式" onClick={() => runCommand('removeFormat')}>
          <Eraser className="h-3.5 w-3.5" />
        </EditorCommandButton>
      </div>

      <div className="relative">
        {isEmpty ? <div className="pointer-events-none absolute left-3 right-3 top-3 text-sm text-slate-400">{placeholder}</div> : null}
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          onInput={emitValue}
          onBlur={() => {
            emitValue();
            setFocused(false);
          }}
          onFocus={() => setFocused(true)}
          onPaste={(event) => {
            event.preventDefault();
            const text = event.clipboardData.getData('text/plain');
            document.execCommand('insertText', false, text);
          }}
          className={cn(
            'min-h-[120px] px-3 py-3 text-sm text-slate-900 outline-none',
            '[&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:marker:text-slate-500',
            '[&_p]:my-0 [&_p+p]:mt-2',
            '[&_strong]:font-semibold',
            '[&_ul]:list-disc [&_ul]:pl-5 [&_ul]:marker:text-slate-500',
            '[&_li]:mt-1',
          )}
          role="textbox"
          aria-multiline="true"
        />
      </div>
    </div>
  );
}

function EditorCommandButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-500 transition hover:bg-white hover:text-[#4183FF]"
    >
      {children}
    </button>
  );
}
