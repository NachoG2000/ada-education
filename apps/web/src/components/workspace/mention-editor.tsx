import { forwardRef, useEffect, useImperativeHandle, useId, useRef, useState } from "react"
import { EditorContent, ReactRenderer, useEditor, type Editor, type JSONContent } from "@tiptap/react"
import Document from "@tiptap/extension-document"
import Paragraph from "@tiptap/extension-paragraph"
import Text from "@tiptap/extension-text"
import HardBreak from "@tiptap/extension-hard-break"
import Mention from "@tiptap/extension-mention"
import { UndoRedo } from "@tiptap/extensions"
import { exitSuggestion, type SuggestionProps } from "@tiptap/suggestion"
import { PluginKey } from "@tiptap/pm/state"
import type { Member, MessageBlock } from "@ada/protocol"
import { WorkspaceAvatar } from "./workspace-avatar"

const mentionPluginKey = new PluginKey("adaMention")

type Candidate = Member & { joinsOnSend?: boolean }
type MentionAttrs = { id: string; label: string }
type ListProps = SuggestionProps<Candidate, MentionAttrs>
type ListHandle = { onKeyDown: (event: KeyboardEvent) => boolean }

const MentionList = forwardRef<ListHandle, ListProps>(function MentionList(props, ref) {
  const [index, setIndex] = useState(0)
  const selected = Math.min(index, Math.max(0, props.items.length - 1))
  const listRef = useRef<HTMLDivElement>(null)
  const listId = useId()
  const choose = (item: Candidate) => props.command({ id: item.id, label: item.name })
  useEffect(() => {
    const element = props.editor.view.dom
    element.setAttribute("aria-controls", listId)
    element.setAttribute("aria-expanded", "true")
    if (props.items.length) element.setAttribute("aria-activedescendant", `${listId}-${selected}`)
    else element.removeAttribute("aria-activedescendant")
    listRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: "nearest" })
    return () => {
      element.removeAttribute("aria-controls")
      element.removeAttribute("aria-activedescendant")
      element.setAttribute("aria-expanded", "false")
    }
  }, [selected, props.items, props.editor, listId])
  useImperativeHandle(ref, () => ({
    onKeyDown(event) {
      if (event.isComposing) return false
      if (event.key === "Escape") { exitSuggestion(props.editor.view, mentionPluginKey); return true }
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        setIndex((selected + (event.key === "ArrowDown" ? 1 : -1) + props.items.length) % Math.max(1, props.items.length))
        return true
      }
      if ((event.key === "Enter" || event.key === "Tab" && !event.shiftKey) && props.items[selected]) {
        choose(props.items[selected]); return true
      }
      return false
    },
  }))
  return <div className="mention-menu">
    <div className="mention-menu-heading">Mention a person or agent</div>
    <div ref={listRef} id={listId} role="listbox" aria-label="Mention suggestions" className="mention-menu-options">
      {props.items.map((item, position) => <button key={item.id} id={`${listId}-${position}`} type="button" role="option" tabIndex={-1}
        aria-selected={selected === position} className="mention-option" onMouseEnter={() => setIndex(position)}
        onMouseDown={(event) => event.preventDefault()} onClick={() => choose(item)}>
        <WorkspaceAvatar member={item} size={28} />
        <span className="w-full min-w-0 self-stretch text-left"><span className="block truncate font-medium">{item.name}</span>
          <span className="block text-xs text-muted-foreground">{item.joinsOnSend ? "Agent · adds to channel on send" : item.kind === "agent" ? "Agent · in this conversation" : "Channel member"}</span></span>
      </button>)}
      {!props.items.length && <p className="p-3 text-sm text-muted-foreground" role="status">No matching members.</p>}
    </div>
    <div className="mention-menu-hint">↑ ↓ to navigate · Tab to complete · Esc to close</div>
  </div>
})

function paragraphsToDocument(paragraphs: MessageBlock[][]): JSONContent {
  return { type: "doc", content: paragraphs.length ? paragraphs.map((blocks) => ({ type: "paragraph", content: blocks.flatMap((block): JSONContent[] => {
    if (block.kind === "mention") return [{ type: "mention", attrs: { id: block.memberId, label: block.text.replace(/^@/, "") } }]
    return block.text.split("\n").flatMap((text, index): JSONContent[] => [...(index ? [{ type: "hardBreak" }] : []), ...(text ? [{ type: "text", text }] : [])])
  }) })) : [{ type: "paragraph" }] }
}

function documentToParagraphs(doc: JSONContent): MessageBlock[][] {
  return (doc.content ?? []).map((paragraph) => (paragraph.content ?? []).map((node): MessageBlock => node.type === "mention"
    ? { kind: "mention", memberId: String(node.attrs?.id), text: `@${String(node.attrs?.label ?? node.attrs?.id)}` }
    : { kind: "text", text: node.type === "hardBreak" ? "\n" : node.text ?? "" }))
}

export function MentionEditor({ initialValue, candidates, disabled, label, placeholder, onChange, onSubmit, editorRef }: {
  initialValue: MessageBlock[][]; candidates: Candidate[]; disabled: boolean; label: string; placeholder: string
  onChange: (paragraphs: MessageBlock[][]) => void; onSubmit: () => void; editorRef: React.RefObject<Editor | null>
}) {
  const current = useRef({ candidates, onChange, onSubmit })
  useEffect(() => { current.current = { candidates, onChange, onSubmit } }, [candidates, onChange, onSubmit])
  // Tiptap runs these callbacks for editor events, never during React render.
  const editor = useEditor({
    // oxlint-disable-next-line react/refs -- Mention executes suggestion callbacks on editor events.
    extensions: [Document, Paragraph, Text, HardBreak, UndoRedo, Mention.configure({
      HTMLAttributes: { class: "mention-chip" },
      deleteTriggerWithBackspace: true,
      suggestion: {
        pluginKey: mentionPluginKey,
        allowSpaces: true,
        placement: "top-start",
        items: ({ query }) => current.current.candidates.filter((item) => item.name.toLocaleLowerCase().includes(query.toLocaleLowerCase())).slice(0, 20),
        render: () => {
          let renderer: ReactRenderer<ListHandle, ListProps> | undefined
          let unmount: (() => void) | undefined
          return {
            onStart(props) {
              renderer = new ReactRenderer(MentionList, { props, editor: props.editor })
              unmount = props.mount(renderer.element)
            },
            onUpdate(props) { renderer?.updateProps(props) },
            onKeyDown({ event }) { return renderer?.ref?.onKeyDown(event) ?? false },
            onExit() { unmount?.(); renderer?.destroy() },
          }
        },
      },
    })],
    content: paragraphsToDocument(initialValue),
    editable: !disabled,
    editorProps: {
      attributes: { class: "mention-editor", "data-slot": "input-group-control", role: "textbox", "aria-multiline": "true", "aria-label": label, "aria-autocomplete": "list", "data-placeholder": placeholder },
      handleKeyDown(view, event) {
        if (event.isComposing || view.composing || event.keyCode === 229) return false
        if (event.metaKey || event.ctrlKey) {
          const pair = event.key.toLowerCase() === "b" ? ["**", "**"] : event.key.toLowerCase() === "i" ? ["*", "*"] : event.key.toLowerCase() === "k" ? ["[", "](url)"] : null
          if (pair) {
            event.preventDefault()
            const { from, to } = view.state.selection
            view.dispatch(view.state.tr.insertText(pair[1], to).insertText(pair[0], from))
            return true
          }
        }
        if (mentionPluginKey.getState(view.state)?.active) return false
        if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); current.current.onSubmit(); return true }
        return false
      },
    },
    onUpdate: ({ editor: instance }) => current.current.onChange(documentToParagraphs(instance.getJSON())),
  })
  useEffect(() => { editorRef.current = editor; return () => { editorRef.current = null } }, [editor, editorRef])
  useEffect(() => {
    editor?.setEditable(!disabled)
    editor?.setOptions({ editorProps: { ...editor.options.editorProps, attributes: { ...editor.options.editorProps.attributes, "aria-label": label, "aria-disabled": String(disabled), "data-placeholder": placeholder } } })
  }, [editor, disabled, label, placeholder])
  return <EditorContent editor={editor} className="w-full min-w-0 self-stretch text-left" />
}
