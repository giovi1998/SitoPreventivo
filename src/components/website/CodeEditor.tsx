import React, { useEffect, useRef } from 'react';

export type CodeLanguage = 'html' | 'css' | 'javascript';

interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  language: CodeLanguage;
}

/**
 * Editor codice con syntax highlighting (CodeMirror 6), lazy-loaded:
 * ~300KB caricati SOLO quando si apre il tab Code del WebsiteEditor.
 */
export default function CodeEditor({ value, onChange, language }: CodeEditorProps): React.ReactElement {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<{ destroy: () => void } | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [{ EditorView, basicSetup }, { html }, { css }, { javascript }] = await Promise.all([
        import('codemirror'),
        import('@codemirror/lang-html'),
        import('@codemirror/lang-css'),
        import('@codemirror/lang-javascript'),
      ]);
      if (cancelled || !containerRef.current) return;
      const lang = language === 'html' ? html() : language === 'css' ? css() : javascript();
      const view = new EditorView({
        parent: containerRef.current,
        doc: value,
        extensions: [
          basicSetup,
          lang,
          EditorView.updateListener.of((update) => {
            if (update.docChanged) onChange(update.state.doc.toString());
          }),
        ],
      });
      viewRef.current = view;
    })();
    return () => {
      cancelled = true;
      viewRef.current?.destroy();
      viewRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language]);

  // Sincronizza il doc esterno (rigenera/refine/load) senza perdere il caret.
  useEffect(() => {
    const view = viewRef.current as { state?: { doc: { toString: () => string } }; dispatch?: (t: { changes: { from: number; to: number; insert: string } }) => void } | null;
    if (!view?.state || !view.dispatch) return;
    const current = view.state.doc.toString();
    if (current !== value) {
      view.dispatch({ changes: { from: 0, to: current.length, insert: value } });
    }
  }, [value]);

  return <div ref={containerRef} className="code-editor-cm" />;
}
