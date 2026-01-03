import * as React from "react"
import {
  MDXEditor,
  type MDXEditorMethods,
  headingsPlugin,
  listsPlugin,
  quotePlugin,
  thematicBreakPlugin,
  markdownShortcutPlugin,
  linkPlugin,
  linkDialogPlugin,
  tablePlugin,
  codeBlockPlugin,
  codeMirrorPlugin,
  toolbarPlugin,
  UndoRedo,
  BoldItalicUnderlineToggles,
  CodeToggle,
  BlockTypeSelect,
  CreateLink,
  InsertTable,
  InsertThematicBreak,
  ListsToggle,
  diffSourcePlugin,
  imagePlugin,
} from "@mdxeditor/editor"
import "@mdxeditor/editor/style.css"
import { Image as ImageIcon } from "lucide-react"

import { MediaLibraryModal } from "@/components/admin/MediaLibraryModal"

type Props = {
  value: string
  onChange: (next: string) => void
  currentPostId?: string
}

export function MarkdownEditor({ value, onChange, currentPostId }: Props) {
  const editorRef = React.useRef<MDXEditorMethods>(null)
  const [mediaOpen, setMediaOpen] = React.useState(false)

  function insertImage(path: string, alt: string = "image") {
    const safeAlt = alt.replace(/\n/g, " ").trim() || "image"
    // include title too; helps some parsers and avoids "N/A" metadata issues
    const md = `\n\n![${safeAlt}](${path} "${safeAlt}")\n\n`
    editorRef.current?.insertMarkdown(md)
  }

  return (
    <div className="rounded-md border">
      <MDXEditor
        ref={editorRef}
        markdown={value ?? ""}
        onChange={onChange}
        contentEditableClassName="prose max-w-none px-4 py-3"
        plugins={[
          headingsPlugin(),
          listsPlugin(),
          quotePlugin(),
          thematicBreakPlugin(),
          linkPlugin(),
          linkDialogPlugin(),
          tablePlugin(),
          codeBlockPlugin({ defaultCodeBlockLanguage: "txt" }),
          codeMirrorPlugin(),
          imagePlugin({imageUploadHandler: async () => "",}),
          markdownShortcutPlugin(),
          diffSourcePlugin({ viewMode: "rich-text" }),
          toolbarPlugin({
            toolbarContents: () => (
              <>
                <UndoRedo />
                <BlockTypeSelect />
                <BoldItalicUnderlineToggles />
                <CodeToggle />
                <ListsToggle />
                <CreateLink />
                <InsertTable />
                <InsertThematicBreak />

                <button
                  type="button"
                  onClick={() => setMediaOpen(true)}
                  title="Insert image"
                  aria-label="Insert image"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-transparent hover:border-neutral-200 hover:bg-neutral-50"
                >
                  <ImageIcon size={16} />
                </button>
              </>
            ),
          }),
        ]}
      />

      <MediaLibraryModal
        open={mediaOpen}
        onClose={() => setMediaOpen(false)}
        currentPostId={currentPostId}
        onPick={({ path, type }) => {
          setMediaOpen(false)
          if (type === "image" || type === "gif") {
            insertImage(path, "image")
          } else {
            editorRef.current?.insertMarkdown(`\n\n[media](${path})\n\n`)
          }
        }}
      />
    </div>
  )
}
