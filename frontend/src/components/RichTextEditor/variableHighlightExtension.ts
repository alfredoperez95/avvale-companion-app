import { Extension } from '@tiptap/core';
import type { Node } from '@tiptap/pm/model';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

const VARIABLE_REGEX = /\{\{[^}]+\}\}/g;
const pluginKey = new PluginKey('variableHighlight');

function getDecorations(doc: Node): DecorationSet {
  const decos: Decoration[] = [];
  doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return;
    let m: RegExpExecArray | null;
    VARIABLE_REGEX.lastIndex = 0;
    while ((m = VARIABLE_REGEX.exec(node.text)) !== null) {
      decos.push(
        Decoration.inline(pos + m.index, pos + m.index + m[0].length, {
          class: 'variableHighlight',
        })
      );
    }
  });
  return DecorationSet.create(doc, decos);
}

export const VariableHighlightExtension = Extension.create({
  name: 'variableHighlight',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: pluginKey,
        state: {
          init(_, { doc }) {
            return getDecorations(doc);
          },
          apply(tr, oldState) {
            if (tr.docChanged) return getDecorations(tr.doc);
            return oldState.map(tr.mapping, tr.doc);
          },
        },
        props: {
          decorations(state) {
            return pluginKey.getState(state) ?? DecorationSet.empty;
          },
        },
      }),
    ];
  },
});
