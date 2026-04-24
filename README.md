# node-red-dashboard-2-ui-editor

A WYSIWYG UI editor for [FlowFuse Node-RED Dashboard 2](https://github.com/FlowFuse/node-red-dashboard).
Runs as a Node-RED **editor plugin** and adds a sidebar tab titled **"UI
Editor"** that renders a live, schematic preview of the Dashboard 2 layout
(pages → groups → widgets) and a palette of widget types you can drag into it.

Dropping a widget creates the matching Dashboard 2 node(s) (`ui-base`,
`ui-page`, `ui-group`, `ui-button`, `ui-gauge`, …) on the active flow, so the
Node-RED canvas stays in sync with what you arrange visually.

## Features

- Sidebar tab embedded in the Node-RED editor, no separate window
- Palette of all core Dashboard 2 widget types, grouped by category with a
  filter box
- Live preview of every page/group/widget in the current flow, using a
  column grid that matches Dashboard 2's `ui-group.width`
- Drag-and-drop from palette onto a group (or onto an empty page to auto-seed
  a default `ui-base` / `ui-page` / `ui-group`)
- Per-widget actions: edit (opens the Node-RED config dialog), reveal on
  canvas, delete
- Re-renders automatically on flow changes, deploys and workspace switches

## Install

```bash
cd ~/.node-red
npm install node-red-dashboard-2-ui-editor
```

Then restart Node-RED. Open the editor → sidebar → **UI Editor** tab.

### Requirements

- Node-RED **≥ 3.0**
- [`@flowfuse/node-red-dashboard`](https://github.com/FlowFuse/node-red-dashboard)
  installed in the same Node-RED instance (this plugin creates its node types,
  so it needs them registered).

## How it works

The plugin is a pure editor-side Node-RED plugin; it never talks to the
runtime. On load it registers a sidebar tab and then, whenever the editor's
node graph changes, it walks `RED.nodes` to find:

- the first `ui-base` config node (creates one if none)
- `ui-page` config nodes referencing that base
- `ui-group` config nodes referencing each page
- flow nodes whose `type` is a Dashboard 2 widget and whose `group` points at
  a `ui-group`

These are rendered into the preview. Drag-drop uses the standard HTML5 DnD
API; on drop the plugin constructs a node object that mirrors the defaults
declared in `@flowfuse/node-red-dashboard`'s
[`nodes/widgets/*.html`](https://github.com/FlowFuse/node-red-dashboard/tree/main/nodes/widgets)
and calls `RED.nodes.add(...)`, then `RED.view.redraw()` to refresh the flow
canvas.

Widget metadata (type, default label, default `width`/`height`, etc.) lives in
`resources/widget-catalog.js` and mirrors the `defaults: { ... }` blocks of
the corresponding `.html` node definitions in the Dashboard 2 source tree.
Adding a new widget type is a matter of appending an entry there.

## Project layout

```
package.json                      # Node-RED plugin metadata
lib/
  ui-editor.js                    # backend plugin registration (no runtime work)
  ui-editor.html                  # injects editor-side CSS + scripts
resources/
  ui-editor.css                   # sidebar styles, scoped under .d2ed-root
  widget-catalog.js               # catalog of known ui-* widget types + defaults
  ui-editor.js                    # sidebar rendering, palette, drag-drop, node creation
```

Static files under `resources/` are served by Node-RED at
`/resources/node-red-dashboard-2-ui-editor/<file>`.

## Limitations

- **Schematic preview**, not a pixel-perfect Vuetify render. Widgets appear as
  labelled tiles that occupy the correct number of grid columns; actual
  runtime rendering still happens under `/dashboard`.

## License

MIT