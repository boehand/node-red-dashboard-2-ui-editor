/*
 * Node-RED Dashboard 2 — WYSIWYG UI Editor (editor-side)
 *
 * Runs inside the Node-RED editor. Adds a sidebar tab that renders the current
 * Dashboard 2 layout (ui-base → ui-page → ui-group → widgets) and lets the
 * user drag widget types from a palette onto pages/groups. Dropping a palette
 * item creates the matching Node-RED node(s) on the active flow via
 * RED.nodes.add, keeping the canvas in sync with what's shown in the preview.
 *
 * The preview mirrors the Dashboard 2 grid: each group has a column width
 * (default 6) and widgets flow left-to-right / top-to-bottom in insertion
 * order, occupying either their configured width or the remaining row space
 * when width=0 ("auto-fit").
 */
(function () {
    'use strict'

    const PLUGIN_ID = 'dashboard-2-ui-editor'
    const SIDEBAR_ID = 'dashboard-2-ui-editor-sidebar'

    RED.plugins.registerPlugin(PLUGIN_ID, {
        type: 'editor-plugin',
        onadd: function () {
            const { WIDGETS, CATEGORIES } = window.D2UIEditorCatalog

            // -------- root container --------
            const root = document.createElement('div')
            root.id = SIDEBAR_ID
            root.className = 'd2ed-root'
            root.innerHTML = `
                <div class="d2ed-toolbar">
                    <div class="d2ed-title">
                        <i class="fa fa-th-large"></i>
                        <span>Dashboard 2 — UI Editor</span>
                    </div>
                    <div class="d2ed-base-selector" hidden>
                        <label class="d2ed-base-label">Dashboard:</label>
                        <select class="d2ed-base-select"></select>
                    </div>
                    <div class="d2ed-toolbar-right">
                        <label class="d2ed-toggle" title="Hide the auto-generated 'Used Widgets (UI-Editor)' category in Node-RED's left palette">
                            <input type="checkbox" data-action="toggle-hide-subflows">
                            <span class="d2ed-toggle-track"><span class="d2ed-toggle-thumb"></span></span>
                            <span class="d2ed-toggle-label">Hide subflows</span>
                        </label>
                        <label class="d2ed-toggle" title="Maximise the UI editor over the whole window">
                            <input type="checkbox" data-action="toggle-fullscreen">
                            <span class="d2ed-toggle-track"><span class="d2ed-toggle-thumb"></span></span>
                            <span class="d2ed-toggle-label">Full screen</span>
                        </label>
                        <button class="d2ed-btn" data-action="add-page" title="Add page">
                            <i class="fa fa-plus"></i> Page
                        </button>
                        <button class="d2ed-btn" data-action="add-group" title="Add group to current page">
                            <i class="fa fa-plus-square-o"></i> Group
                        </button>
                        <button class="d2ed-btn" data-action="refresh" title="Re-sync from flow">
                            <i class="fa fa-refresh"></i>
                        </button>
                    </div>
                </div>
                <div class="d2ed-body">
                    <aside class="d2ed-palette" aria-label="Widget palette">
                        <div class="d2ed-palette-header">Widgets</div>
                        <div class="d2ed-palette-search">
                            <input type="text" placeholder="Filter…" class="d2ed-palette-filter" />
                        </div>
                        <div class="d2ed-palette-list"></div>
                        <div class="d2ed-palette-hint">
                            <i class="fa fa-info-circle"></i>
                            Drag a widget onto a group in the preview. The
                            matching node is created on the active flow.
                        </div>
                    </aside>
                    <main class="d2ed-preview-wrap">
                        <div class="d2ed-page-bar">
                            <div class="d2ed-page-tabs"></div>
                            <div class="d2ed-layout-selector" hidden>
                                <label class="d2ed-layout-label">Layout:</label>
                                <select class="d2ed-layout-select" title="Page layout (ui-page.layout)">
                                    <option value="grid">Grid</option>
                                    <option value="flex">Flex</option>
                                    <option value="notebook">Notebook</option>
                                    <option value="tabs">Tabs</option>
                                </select>
                            </div>
                        </div>
                        <div class="d2ed-preview"></div>
                        <div class="d2ed-empty-state" hidden>
                            <i class="fa fa-th-large"></i>
                            <h3>No Dashboard 2 layout yet</h3>
                            <p>Drop a widget here to create a dashboard with one page and one group automatically, or click <b>Page</b> / <b>Group</b> above.</p>
                        </div>
                    </main>
                </div>
            `

            // -------- sidebar tab registration --------
            RED.sidebar.addTab({
                id: SIDEBAR_ID,
                label: 'UI Editor',
                name: 'Dashboard 2 UI Editor',
                iconClass: 'fa fa-th-large',
                content: root,
                enableOnEdit: true
            })

            // -------- editor state --------
            const state = {
                activePageId: null,
                activeBaseId: null
            }

            // -------- helpers: read dashboard model from RED.nodes --------
            function findAllBases () {
                const bases = []
                RED.nodes.eachConfig(n => { if (n.type === 'ui-base') bases.push(n) })
                return bases
            }

            function findBase () {
                const bases = findAllBases()
                if (!bases.length) return null
                if (state.activeBaseId) {
                    const found = bases.find(b => b.id === state.activeBaseId)
                    if (found) return found
                }
                state.activeBaseId = bases[0].id
                return bases[0]
            }

            function findPages (baseId) {
                const pages = []
                RED.nodes.eachConfig(n => {
                    if (n.type === 'ui-page' && (!baseId || n.ui === baseId)) pages.push(n)
                })
                return pages.sort((a, b) => (a.order || 0) - (b.order || 0) || a.name.localeCompare(b.name))
            }

            function findGroups (pageId) {
                const groups = []
                RED.nodes.eachConfig(n => {
                    if (n.type === 'ui-group' && n.page === pageId) groups.push(n)
                })
                return groups.sort((a, b) => (a.order || 0) - (b.order || 0) || a.name.localeCompare(b.name))
            }

            function findWidgets (groupId) {
                const widgets = []
                const known = new Set(WIDGETS.map(w => w.type))
                RED.nodes.eachNode(n => {
                    if (known.has(n.type) && n.group === groupId) widgets.push(n)
                })
                return widgets.sort((a, b) => (a.order || 0) - (b.order || 0))
            }

            function getCatalogEntry (type) {
                return WIDGETS.find(w => w.type === type)
            }

            // -------- helpers: create nodes --------
            function ensureBase () {
                let base = findBase()
                if (base) return base
                base = {
                    id: RED.nodes.id(),
                    type: 'ui-base',
                    name: 'Dashboard',
                    path: '/dashboard',
                    appIcon: '',
                    includeClientData: true,
                    acceptsClientConfig: ['ui-notification', 'ui-control'],
                    showPathInSidebar: false,
                    headerContent: 'page',
                    navigationStyle: 'default',
                    titleBarStyle: 'default',
                    showReconnectNotification: true,
                    notificationDisplayTime: 1,
                    showDisconnectNotification: true,
                    allowInstall: false
                }
                base._def = RED.nodes.getType('ui-base')
                if (!base._def) {
                    RED.notify('Dashboard base node type ui-base is not registered.', 'error')
                    return base
                }
                RED.nodes.add(base)
                state.activeBaseId = base.id
                return base
            }

            function ensureTheme () {
                let theme = null
                RED.nodes.eachConfig(n => { if (!theme && n.type === 'ui-theme') theme = n })
                if (theme) return theme
                theme = {
                    id: RED.nodes.id(),
                    type: 'ui-theme',
                    name: 'Default Theme',
                    colors: { surface: '#ffffff', primary: '#0094CE', bgPage: '#eeeeee', groupBg: '#ffffff', groupOutline: '#cccccc' },
                    sizes: { pagePadding: '12px', groupGap: '12px', groupBorderRadius: '4px', widgetGap: '12px' }
                }
                theme._def = RED.nodes.getType('ui-theme')
                if (!theme._def) {
                    RED.notify('Dashboard theme node type ui-theme is not registered.', 'error')
                    return theme
                }
                RED.nodes.add(theme)
                return theme
            }

            function createPage (base, theme, name) {
                const page = {
                    id: RED.nodes.id(),
                    type: 'ui-page',
                    name: name || 'Page 1',
                    ui: base.id,
                    path: '/page' + (findPages(base.id).length + 1),
                    icon: 'home',
                    layout: 'grid',
                    theme: theme.id,
                    breakpoints: [
                        { name: 'Default', px: 0, cols: 3 },
                        { name: 'Tablet', px: 576, cols: 6 },
                        { name: 'Small Desktop', px: 768, cols: 9 },
                        { name: 'Desktop', px: 1024, cols: 12 }
                    ],
                    order: -1,
                    className: '',
                    visible: 'true',
                    disabled: 'false'
                }
                page._def = RED.nodes.getType('ui-page')
                if (!page._def) {
                    RED.notify('Dashboard page node type ui-page is not registered.', 'error')
                    return page
                }
                RED.nodes.add(page)
                return page
            }

            function createGroup (page, name) {
                const group = {
                    id: RED.nodes.id(),
                    type: 'ui-group',
                    name: name || ('Group ' + (findGroups(page.id).length + 1)),
                    page: page.id,
                    width: 6,
                    height: 1,
                    order: findGroups(page.id).length,
                    showTitle: true,
                    className: '',
                    visible: true,
                    disabled: false,
                    groupType: 'default'
                }
                group._def = RED.nodes.getType('ui-group')
                if (!group._def) {
                    RED.notify('Dashboard group node type ui-group is not registered.', 'error')
                    return group
                }
                RED.nodes.add(group)
                return group
            }

            // Returns true only when the node type is actually registered in the
            // Node-RED editor (i.e. Dashboard 2 is installed and loaded).
            // Mirrors the lookup chain in resolveWidgetType so the palette
            // never advertises a widget the user cannot actually create.
            function isWidgetTypeAvailable (type) {
                if (typeof type !== 'string') return false
                const normalized = type.replace(/-/g, '_')
                if (RED.nodes && typeof RED.nodes.getType === 'function') {
                    if (RED.nodes.getType(type)) return true
                    if (normalized !== type && RED.nodes.getType(normalized)) return true
                }
                if (RED.nodes && RED.nodes.definitions) {
                    if (RED.nodes.definitions[type]) return true
                    if (normalized !== type && RED.nodes.definitions[normalized]) return true
                }
                if (RED.nodes && RED.nodes.registry && typeof RED.nodes.registry.getType === 'function') {
                    if (RED.nodes.registry.getType(type)) return true
                    if (normalized !== type && RED.nodes.registry.getType(normalized)) return true
                }
                if (RED.nodes && RED.nodes.registry && RED.nodes.registry.types) {
                    if (RED.nodes.registry.types[type]) return true
                    if (normalized !== type && RED.nodes.registry.types[normalized]) return true
                }
                return false
            }

            function resolveWidgetType (type) {
                if (typeof type !== 'string') return type
                const normalized = type.replace(/-/g, '_')
                if (RED.nodes && typeof RED.nodes.getType === 'function') {
                    if (RED.nodes.getType(type)) return type
                    if (normalized !== type && RED.nodes.getType(normalized)) return normalized
                }
                if (RED.nodes && RED.nodes.definitions) {
                    if (RED.nodes.definitions[type]) return type
                    if (normalized !== type && RED.nodes.definitions[normalized]) return normalized
                }
                if (RED.nodes && RED.nodes.registry && typeof RED.nodes.registry.getType === 'function') {
                    if (RED.nodes.registry.getType(type)) return type
                    if (normalized !== type && RED.nodes.registry.getType(normalized)) return normalized
                }
                if (RED.nodes && RED.nodes.registry && RED.nodes.registry.types) {
                    if (RED.nodes.registry.types[type]) return type
                    if (normalized !== type && RED.nodes.registry.types[normalized]) return normalized
                }
                return type
            }

            function createWidget (group, catalog, placementOrder) {
                if (!group || !group.id) {
                    RED.notify('Unable to determine target group for widget drop.', 'error')
                    return null
                }
                const resolvedGroup = RED.nodes.node(group.id) || group
                const widgetType = resolveWidgetType(catalog.type)
                if (widgetType !== String(catalog.type)) {
                    console.debug('Resolved widget node type:', catalog.type, '=>', widgetType)
                }
                // Widgets always live on the dedicated "Used Widgets" tab,
                // wrapped in a per-widget plumbing group. Their dashboard
                // membership stays with the original ui-group (`group` field)
                // so the Dashboard 2 layout is unaffected.
                const ctx = ensureSharedWebsocketPlumbing()
                const node = Object.assign({
                    id: RED.nodes.id(),
                    type: widgetType,
                    z: ctx.tab.id,
                    name: '',
                    group: resolvedGroup.id,
                    x: 440,
                    y: 0,
                    wires: catalog.category === 'input' || catalog.category === 'logic' ? [[]] : []
                }, JSON.parse(JSON.stringify(catalog.defaults || {})))
                node._def = RED.nodes.getType(widgetType)
                if (!node._def) {
                    RED.notify(`Widget node type ${widgetType} is not registered.`, 'error')
                    return null
                }
                if (typeof placementOrder === 'number') node.order = placementOrder

                // Build the surrounding group + plumbing first; this also
                // assigns the widget's z/g/x/y/wires so it lines up with the
                // pre-wired neighbours.
                const built = buildWidgetGroup(node, catalog, ctx)

                try {
                    RED.nodes.add(node)
                } catch (err) {
                    console.error('Failed to add dashboard widget node:', err, node)
                    RED.notify(`Could not add widget ${catalog.label}: ${err.message}`, 'error')
                    return null
                }
                built.nodes.forEach(n => {
                    try { RED.nodes.add(n) } catch (e) { console.error('Failed to add plumbing node:', e, n) }
                })
                try { RED.nodes.add(built.group) } catch (e) { console.error('Failed to add widget group:', e, built.group) }

                createWidgetSubflow(node, catalog)
                return node
            }

            // -------- per-widget subflow lifecycle --------
            // Each widget dropped from the palette gets two companion artefacts:
            //   1. A "widget group" on a dedicated flow tab named
            //      "Used Widgets (UI-Editor)" containing the actual Dashboard 2
            //      widget node plus the websocket plumbing that lets the widget
            //      receive updates and emit events through a pair of well-known
            //      websocket channels.
            //   2. A subflow stored in the "Used Widgets (UI-Editor)" palette
            //      category. The subflow contains the inverse plumbing — it
            //      pushes incoming messages out through ws/uieditor/ui-in and
            //      receives ws/uieditor/ui-out events filtered by widget id.
            // The user drags the subflow onto their own flow to interact with
            // the widget without touching the Used Widgets tab. When the widget
            // is removed (here or from the canvas) both artefacts are cleaned
            // up so the palette/tab only ever list widgets that still exist.
            const SUBFLOW_CATEGORY = 'Used Widgets (UI-Editor)'
            const USED_WIDGETS_TAB_LABEL = 'Used Widgets (UI-Editor)'
            const WS_UI_IN_PATH = '/ws/uieditor/ui-in'
            const WS_UI_OUT_PATH = '/ws/uieditor/ui-out'
            const WS_UI_IN_CLIENT_URL = 'ws://localhost:1880/ws/uieditor/ui-in'
            const WS_UI_OUT_CLIENT_URL = 'ws://localhost:1880/ws/uieditor/ui-out'

            function subflowApiAvailable () {
                return RED.nodes && typeof RED.nodes.addSubflow === 'function'
            }

            // -------- shared websocket plumbing --------
            function findUsedWidgetsTab () {
                let tab = null
                if (typeof RED.nodes.eachWorkspace === 'function') {
                    RED.nodes.eachWorkspace(w => {
                        if (!tab && w && w.type === 'tab' && w.label === USED_WIDGETS_TAB_LABEL) tab = w
                    })
                }
                if (!tab && typeof RED.nodes.eachConfig === 'function') {
                    RED.nodes.eachConfig(n => {
                        if (!tab && n && n.type === 'tab' && n.label === USED_WIDGETS_TAB_LABEL) tab = n
                    })
                }
                return tab
            }

            function ensureUsedWidgetsTab () {
                let tab = findUsedWidgetsTab()
                if (tab) return tab
                tab = {
                    _cfg: true,
                    id: RED.nodes.id(),
                    type: 'tab',
                    label: USED_WIDGETS_TAB_LABEL,
                    disabled: false,
                    info: '',
                    env: []
                }
                if (RED.workspaces && typeof RED.workspaces.add === 'function') {
                    RED.workspaces.add(tab)
                } else if (typeof RED.nodes.add === 'function') {
                    RED.nodes.add(tab)
                }
                return tab
            }

            function findConfigByPath (type, path) {
                let found = null
                if (typeof RED.nodes.eachConfig === 'function') {
                    RED.nodes.eachConfig(n => {
                        if (!found && n && n.type === type && n.path === path && !n.z) found = n
                    })
                }
                return found
            }

            function ensureWebsocketListener (path) {
                let listener = findConfigByPath('websocket-listener', path)
                if (listener) return listener
                listener = {
                    _cfg: true,
                    id: RED.nodes.id(),
                    type: 'websocket-listener',
                    path: path,
                    wholemsg: 'true'
                }
                listener._def = RED.nodes.getType('websocket-listener')
                RED.nodes.add(listener)
                return listener
            }

            function ensureSharedUiOutClient () {
                let client = findConfigByPath('websocket-client', WS_UI_OUT_CLIENT_URL)
                if (client) return client
                client = {
                    _cfg: true,
                    id: RED.nodes.id(),
                    type: 'websocket-client',
                    path: WS_UI_OUT_CLIENT_URL,
                    tls: '',
                    wholemsg: 'true',
                    hb: '0',
                    subprotocol: '',
                    headers: []
                }
                client._def = RED.nodes.getType('websocket-client')
                RED.nodes.add(client)
                return client
            }

            function ensureSharedWebsocketPlumbing () {
                return {
                    tab: ensureUsedWidgetsTab(),
                    uiInListener: ensureWebsocketListener(WS_UI_IN_PATH),
                    uiOutListener: ensureWebsocketListener(WS_UI_OUT_PATH),
                    uiOutClient: ensureSharedUiOutClient()
                }
            }

            // -------- widget group on the "Used Widgets" tab --------
            function widgetGroupBaseY (tabId) {
                let maxY = 40
                RED.nodes.eachNode(n => {
                    if (n.z === tabId && typeof n.y === 'number' && n.y > maxY) maxY = n.y
                })
                return maxY + 80
            }

            function buildWidgetGroup (widget, catalog, ctx) {
                const isInputLike = catalog && (catalog.category === 'input' || catalog.category === 'logic')
                const baseY = widgetGroupBaseY(ctx.tab.id)
                const groupName = catalog && catalog.label ? catalog.label : widget.type

                const wsIn = {
                    id: RED.nodes.id(),
                    type: 'websocket in',
                    z: ctx.tab.id,
                    name: WS_UI_IN_PATH,
                    server: ctx.uiInListener.id,
                    client: '',
                    x: 120,
                    y: baseY,
                    wires: [[]]
                }
                const filterSwitch = {
                    id: RED.nodes.id(),
                    type: 'switch',
                    z: ctx.tab.id,
                    name: 'filter widgetid',
                    property: 'uieditor.widgetid',
                    propertyType: 'msg',
                    rules: [{ t: 'eq', v: widget.id, vt: 'str' }],
                    checkall: 'true',
                    repair: false,
                    outputs: 1,
                    x: 290,
                    y: baseY,
                    wires: [[widget.id]]
                }
                wsIn.wires = [[filterSwitch.id]]

                const groupNodeIds = [widget.id, wsIn.id, filterSwitch.id]
                const extraNodes = [wsIn, filterSwitch]
                let cleanFn = null
                let wsOut = null

                if (isInputLike) {
                    cleanFn = {
                        id: RED.nodes.id(),
                        type: 'function',
                        z: ctx.tab.id,
                        name: 'clean up msg & set widgetid',
                        func: 'const newMsg = {\n    topic: msg.topic,\n    payload: msg.payload,\n    ui_update: msg.ui_update,\n    uieditor: { widgetid: ' + JSON.stringify(widget.id) + ' }\n};\nreturn newMsg;\n',
                        outputs: 1,
                        timeout: 0,
                        noerr: 0,
                        initialize: '',
                        finalize: '',
                        libs: [],
                        x: 660,
                        y: baseY,
                        wires: [[]]
                    }
                    wsOut = {
                        id: RED.nodes.id(),
                        type: 'websocket out',
                        z: ctx.tab.id,
                        name: '',
                        server: '',
                        client: ctx.uiOutClient.id,
                        x: 1000,
                        y: baseY,
                        wires: []
                    }
                    cleanFn.wires = [[wsOut.id]]
                    extraNodes.push(cleanFn, wsOut)
                    groupNodeIds.push(cleanFn.id, wsOut.id)
                }

                const group = {
                    id: RED.nodes.id(),
                    type: 'group',
                    z: ctx.tab.id,
                    name: groupName,
                    style: { label: true },
                    nodes: groupNodeIds,
                    x: 14,
                    y: baseY - 41,
                    w: isInputLike ? 1172 : 492,
                    h: 82
                }

                widget.z = ctx.tab.id
                widget.g = group.id
                widget.x = 440
                widget.y = baseY
                widget.wires = isInputLike ? [[cleanFn.id]] : []

                extraNodes.forEach(n => { n.g = group.id })

                return { group, nodes: extraNodes }
            }

            function buildSubflowFor (widget, catalog) {
                const labelBase = catalog && catalog.label ? catalog.label : widget.type
                const widgetLabel = widget.name || widget.label || widget.title || ''
                const displayName = widgetLabel ? labelBase + ': ' + widgetLabel : labelBase
                const isInputLike = catalog && (catalog.category === 'input' || catalog.category === 'logic')

                const subflowId = RED.nodes.id()
                const uiOutListener = ensureWebsocketListener(WS_UI_OUT_PATH)

                const uiInClient = {
                    _cfg: true,
                    id: RED.nodes.id(),
                    type: 'websocket-client',
                    z: subflowId,
                    path: WS_UI_IN_CLIENT_URL,
                    tls: '',
                    wholemsg: 'true',
                    hb: '0',
                    subprotocol: '',
                    headers: []
                }

                const wsOut = {
                    id: RED.nodes.id(),
                    type: 'websocket out',
                    z: subflowId,
                    name: 'ws/uieditor/ui-in',
                    server: '',
                    client: uiInClient.id,
                    x: 360,
                    y: 100,
                    wires: []
                }

                const setWidgetId = {
                    id: RED.nodes.id(),
                    type: 'change',
                    z: subflowId,
                    name: 'set widgetid',
                    rules: [{
                        t: 'set',
                        p: 'uieditor',
                        pt: 'msg',
                        to: '{"widgetid": $env("widgetid")}',
                        tot: 'jsonata'
                    }],
                    action: '',
                    property: '',
                    from: '',
                    to: '',
                    reg: false,
                    x: 170,
                    y: 100,
                    wires: [[wsOut.id]]
                }

                const internalNodes = [setWidgetId, wsOut, uiInClient]
                let filterSwitch = null

                if (isInputLike) {
                    const wsIn = {
                        id: RED.nodes.id(),
                        type: 'websocket in',
                        z: subflowId,
                        name: 'ws/uieditor/ui-out',
                        server: uiOutListener.id,
                        client: '',
                        x: 580,
                        y: 100,
                        wires: [[]]
                    }
                    filterSwitch = {
                        id: RED.nodes.id(),
                        type: 'switch',
                        z: subflowId,
                        name: 'filter widgetid',
                        property: 'uieditor.widgetid',
                        propertyType: 'msg',
                        rules: [{ t: 'eq', v: 'widgetid', vt: 'env' }],
                        checkall: 'true',
                        repair: false,
                        outputs: 1,
                        x: 770,
                        y: 100,
                        wires: [[]]
                    }
                    wsIn.wires = [[filterSwitch.id]]
                    internalNodes.push(wsIn, filterSwitch)
                }

                const iconAttr = catalog && catalog.icon ? catalog.icon : 'fa-square'
                const iconWithPrefix = iconAttr.indexOf('/') >= 0 ? iconAttr : ('font-awesome/' + iconAttr)

                return {
                    id: subflowId,
                    type: 'subflow',
                    name: displayName,
                    info: 'Auto-generated by the Dashboard 2 UI Editor for widget `' +
                          widget.id + '` (' + widget.type + ').\n\n' +
                          'Drag this subflow onto a flow to wire it to the widget. ' +
                          'It will be removed automatically when the widget is deleted.',
                    category: SUBFLOW_CATEGORY,
                    in: [{ x: 40, y: 100, wires: [{ id: setWidgetId.id }] }],
                    out: isInputLike ? [{ x: 900, y: 100, wires: [{ id: filterSwitch.id, port: 0 }] }] : [],
                    env: [{
                        name: 'widgetid',
                        type: 'str',
                        value: widget.id,
                        ui: { type: 'hide' }
                    }],
                    color: '#A0E6EC',
                    icon: iconWithPrefix,
                    meta: {
                        d2edWidgetId: widget.id,
                        d2edWidgetType: widget.type
                    },
                    nodes: internalNodes
                }
            }

            function createWidgetSubflow (widget, catalog) {
                if (!subflowApiAvailable()) return null
                if (findWidgetSubflow(widget.id)) return null
                const subflow = buildSubflowFor(widget, catalog)
                try {
                    RED.nodes.addSubflow(subflow)
                } catch (err) {
                    console.error('Failed to add widget subflow:', err, subflow)
                    return null
                }
                if (Array.isArray(subflow.nodes)) {
                    subflow.nodes.forEach(n => {
                        try { RED.nodes.add(n) } catch (e) { /* ignore */ }
                    })
                }
                return subflow
            }

            function findWidgetSubflow (widgetId) {
                if (!RED.nodes || typeof RED.nodes.eachSubflow !== 'function') return null
                let found = null
                RED.nodes.eachSubflow(sf => {
                    if (!found && sf && sf.meta && sf.meta.d2edWidgetId === widgetId) found = sf
                })
                return found
            }

            function findWidgetGroup (widgetId) {
                let found = null
                RED.nodes.eachNode(n => {
                    if (!found && n && n.type === 'group' && Array.isArray(n.nodes) && n.nodes.indexOf(widgetId) >= 0) {
                        found = n
                    }
                })
                return found
            }

            // Re-entry guard so the cascade — which itself fires further
            // nodes:remove events — never recurses into the same widget.
            const _removingWidgets = new Set()

            function removeWidgetArtifacts (widgetId) {
                if (!widgetId || _removingWidgets.has(widgetId)) return false
                _removingWidgets.add(widgetId)
                try {
                    let removedAny = false

                    const group = findWidgetGroup(widgetId)
                    if (group) {
                        const memberIds = Array.isArray(group.nodes) ? group.nodes.slice() : []
                        memberIds.forEach(id => {
                            if (id === widgetId) return
                            try { RED.nodes.remove(id) } catch (e) { /* node already gone */ }
                        })
                        try { RED.nodes.remove(group.id); removedAny = true } catch (e) { /* ignore */ }
                    }

                    const sf = findWidgetSubflow(widgetId)
                    if (sf) {
                        const internalSnapshot = Array.isArray(sf.nodes) ? sf.nodes.slice() : []
                        try {
                            if (typeof RED.nodes.removeSubflow === 'function') {
                                RED.nodes.removeSubflow(sf.id)
                            } else if (typeof RED.nodes.remove === 'function') {
                                RED.nodes.remove(sf.id)
                            }
                            removedAny = true
                        } catch (err) {
                            console.error('Failed to remove widget subflow:', err, sf)
                        }
                        // Sweep any internal nodes left behind by removeSubflow:
                        // only touch nodes that demonstrably belong to THIS subflow
                        // and are still present in the registry.
                        internalSnapshot.forEach(n => {
                            if (!n || !n.id) return
                            if (n.z !== sf.id) return
                            if (typeof RED.nodes.node === 'function' && !RED.nodes.node(n.id)) return
                            try { RED.nodes.remove(n.id) } catch (e) { /* ignore */ }
                        })
                    }

                    return removedAny
                } finally {
                    _removingWidgets.delete(widgetId)
                }
            }

            // Backwards-compatible alias for callers / tests that referenced the
            // old name. Removes the subflow plus the on-canvas plumbing group.
            function removeWidgetSubflow (widgetId) {
                return removeWidgetArtifacts(widgetId)
            }

            function isWidgetNodeType (type) {
                return !!(window.D2UIWidgetComponents && window.D2UIWidgetComponents.has(type))
            }

            function commit (historyEntries) {
                if (historyEntries && historyEntries.length) {
                    RED.history.push({ t: 'add', nodes: historyEntries.map(n => n.id), dirty: RED.nodes.dirty() })
                }
                RED.nodes.dirty(true)
                RED.view.redraw()
                render()
            }

            // -------- palette rendering --------
            const paletteList = root.querySelector('.d2ed-palette-list')
            const paletteFilter = root.querySelector('.d2ed-palette-filter')

            function renderPalette () {
                paletteList.innerHTML = ''
                const filter = (paletteFilter.value || '').toLowerCase()

                // If no Dashboard 2 widget type is registered at all, show an
                // installation hint instead of an empty palette.
                const anyAvailable = WIDGETS.some(w => isWidgetTypeAvailable(w.type))
                if (!anyAvailable) {
                    const notice = document.createElement('div')
                    notice.className = 'd2ed-palette-notice'
                    notice.innerHTML = `
                        <i class="fa fa-exclamation-circle"></i>
                        <p>Dashboard 2 is not installed.<br>
                        Install <code>@flowfuse/node-red-dashboard</code> first.</p>
                    `
                    paletteList.appendChild(notice)
                    return
                }

                CATEGORIES.forEach(cat => {
                    const widgets = WIDGETS.filter(w => w.category === cat.id &&
                        isWidgetTypeAvailable(w.type) &&
                        (!filter || w.label.toLowerCase().includes(filter) || w.type.includes(filter)))
                    if (!widgets.length) return
                    const section = document.createElement('div')
                    section.className = 'd2ed-palette-section'
                    section.innerHTML = `<div class="d2ed-palette-category">${cat.label}</div>`
                    const grid = document.createElement('div')
                    grid.className = 'd2ed-palette-grid'
                    widgets.forEach(w => {
                        const tile = document.createElement('div')
                        tile.className = 'd2ed-palette-tile'
                        tile.draggable = true
                        tile.dataset.widgetType = w.type
                        tile.title = w.type
                        tile.innerHTML = `<i class="fa ${w.icon}"></i><span>${w.label}</span>`
                                tile.addEventListener('dragstart', ev => {
                            ev.dataTransfer.setData('application/x-d2-widget', w.type)
                            ev.dataTransfer.setData('text/plain', w.type)
                            ev.dataTransfer.effectAllowed = 'copy'
                            document.body.classList.add('d2ed-dragging')
                        })
                        tile.addEventListener('dragend', () => {
                            document.body.classList.remove('d2ed-dragging')
                        })
                        grid.appendChild(tile)
                    })
                    section.appendChild(grid)
                    paletteList.appendChild(section)
                })
            }

            paletteFilter.addEventListener('input', renderPalette)

            // -------- base selector --------
            const baseSelectorEl = root.querySelector('.d2ed-base-selector')
            const baseSelectEl = root.querySelector('.d2ed-base-select')

            function renderBaseSelector () {
                const bases = findAllBases()
                baseSelectorEl.hidden = bases.length <= 1

                if (!bases.length) return

                if (!state.activeBaseId || !bases.find(b => b.id === state.activeBaseId)) {
                    state.activeBaseId = bases[0].id
                }

                baseSelectEl.innerHTML = ''
                bases.forEach(b => {
                    const opt = document.createElement('option')
                    opt.value = b.id
                    opt.textContent = b.name || 'Dashboard'
                    opt.selected = b.id === state.activeBaseId
                    baseSelectEl.appendChild(opt)
                })
            }

            baseSelectEl.addEventListener('change', function () {
                state.activeBaseId = this.value
                state.activePageId = null
                render()
            })

            // -------- preview rendering --------
            const tabsEl = root.querySelector('.d2ed-page-tabs')
            const previewEl = root.querySelector('.d2ed-preview')
            const emptyEl = root.querySelector('.d2ed-empty-state')

            function render () {
                unmountAllWidgetPreviews()
                renderPalette()
                renderBaseSelector()
                const base = findBase()
                const pages = base ? findPages(base.id) : []

                if (!base || !pages.length) {
                    tabsEl.innerHTML = ''
                    previewEl.innerHTML = ''
                    emptyEl.hidden = false
                    attachRootDropZone()
                    return
                }
                emptyEl.hidden = true

                if (!state.activePageId || !pages.find(p => p.id === state.activePageId)) {
                    state.activePageId = pages[0].id
                }

                // tabs
                tabsEl.innerHTML = ''
                pages.forEach(p => {
                    const tab = document.createElement('button')
                    tab.className = 'd2ed-page-tab' + (p.id === state.activePageId ? ' is-active' : '')
                    tab.innerHTML = `<i class="fa fa-${p.icon || 'home'}"></i><span>${escapeHtml(p.name)}</span>`
                    tab.addEventListener('click', () => { state.activePageId = p.id; render() })
                    tab.addEventListener('dblclick', () => editNode(p.id))
                    tabsEl.appendChild(tab)
                })

                // active page content
                previewEl.innerHTML = ''
                const page = pages.find(p => p.id === state.activePageId) || pages[0]
                const groups = findGroups(page.id)

                // Reflect the current layout in the toolbar dropdown so the
                // user can switch the ui-page.layout property visually.
                const layout = page.layout || 'grid'
                layoutSelectorEl.hidden = false
                layoutSelectEl.value = ['grid', 'flex', 'notebook', 'tabs'].indexOf(layout) >= 0 ? layout : 'grid'

                const pageGrid = document.createElement('div')
                pageGrid.className = 'd2ed-page d2ed-page--' + (layoutSelectEl.value)

                // Total column count comes from the page's largest breakpoint;
                // groups span their `width` cols inside that grid (matching the
                // Dashboard 2 deployed view, where groups sit side-by-side).
                const breakpoints = Array.isArray(page.breakpoints) ? page.breakpoints : []
                const totalCols = breakpoints.length
                    ? Math.max.apply(null, breakpoints.map(b => Number(b.cols) || 0))
                    : 12
                pageGrid.style.setProperty('--page-cols', String(totalCols || 12))

                if (!groups.length) {
                    const hint = document.createElement('div')
                    hint.className = 'd2ed-page-empty'
                    hint.textContent = 'No groups on this page yet — drop a widget here or click "Group".'
                    makeDropZone(hint, { page })
                    pageGrid.appendChild(hint)
                } else {
                    groups.forEach(g => pageGrid.appendChild(renderGroup(g, totalCols)))
                }
                previewEl.appendChild(pageGrid)
            }

            function renderGroup (group, pageCols) {
                const widgets = findWidgets(group.id)
                const groupCols = group.width || 6
                const el = document.createElement('section')
                el.className = 'd2ed-group'
                el.style.setProperty('--group-cols', String(groupCols))
                // Spans on the parent grid let groups sit side-by-side and
                // wrap once the row's column budget is exhausted, matching
                // Dashboard 2's deployed grid layout.
                if (pageCols) {
                    el.style.gridColumn = 'span ' + Math.min(groupCols, pageCols)
                }
                el.dataset.groupId = group.id

                const head = document.createElement('header')
                head.className = 'd2ed-group-head'
                head.innerHTML = `
                    <span class="d2ed-group-title">${escapeHtml(group.name)}</span>
                    <span class="d2ed-group-meta">${group.width || 6} cols · ${widgets.length} widget${widgets.length === 1 ? '' : 's'}</span>
                `
                head.addEventListener('dblclick', () => editNode(group.id))
                el.appendChild(head)

                const body = document.createElement('div')
                body.className = 'd2ed-group-body'
                body.style.setProperty('--group-cols', String(group.width || 6))

                widgets.forEach(w => body.appendChild(renderWidget(w, group)))

                const drop = document.createElement('div')
                drop.className = 'd2ed-drop-hint'
                drop.textContent = widgets.length ? '+ drop widget' : '+ drop your first widget here'
                body.appendChild(drop)

                makeDropZone(body, { group })
                setupGroupReorderDnD(body, group)
                el.appendChild(body)
                return el
            }

            // -------- widget preview renderers --------
            // Every node type has its own Vue component definition in
            // resources/widget-components.js. We mount each per-widget Vue app
            // into the preview container so the markup mirrors the structure
            // of the corresponding `ui/src/widgets/*.vue` template.
            //
            // Vue is loaded as a script tag; if it isn't available (e.g.
            // because the editor failed to fetch the bundled file) we fall
            // back to a hard error rather than rendering a placeholder — the
            // user explicitly asked for the per-node template/JS path with no
            // generic fallback.
            const mountedApps = []

            function mountWidgetPreview (container, node, group) {
                if (typeof Vue === 'undefined' || !Vue.createApp) {
                    container.textContent = 'Vue runtime not available'
                    return
                }
                const def = window.D2UIWidgetComponents.resolve(node.type)
                const app = Vue.createApp({
                    components: { 'widget-component': def },
                    data: () => ({ node, group }),
                    template: '<widget-component :node="node" :group="group"/>'
                })
                // Suppress noisy production warnings — preview is non-interactive.
                app.config.warnHandler = () => {}
                app.config.errorHandler = (err) => {
                    console.error('[d2-ui-editor] widget preview error:', node.type, err)
                    container.textContent = node.type
                }
                app.mount(container)
                mountedApps.push(app)
            }

            function unmountAllWidgetPreviews () {
                while (mountedApps.length) {
                    const app = mountedApps.pop()
                    try { app.unmount() } catch (e) { /* best-effort */ }
                }
            }

            function renderWidget (node, group) {
                const groupCols = group.width || 6
                const span = !node.width || node.width === 0 ? groupCols : Math.min(groupCols, node.width)
                const el = document.createElement('div')
                el.className = 'd2ed-widget'
                el.style.gridColumn = 'span ' + span
                const rowSpan = Math.max(1, node.height || 1)
                el.style.gridRow = 'span ' + rowSpan
                el.dataset.nodeId = node.id
                el.draggable = true
                const preview = document.createElement('div')
                preview.className = 'd2ed-widget-preview'
                el.appendChild(preview)
                const actions = document.createElement('div')
                actions.className = 'd2ed-widget-actions'
                actions.innerHTML = `
                    <button title="Edit" data-action="edit"><i class="fa fa-pencil"></i></button>
                    <button title="Reveal on canvas" data-action="reveal"><i class="fa fa-crosshairs"></i></button>
                    <button title="Delete" data-action="delete"><i class="fa fa-trash"></i></button>
                `
                el.appendChild(actions)
                mountWidgetPreview(preview, node, group)
                el.addEventListener('dragstart', ev => {
                    ev.dataTransfer.setData('application/x-d2-reorder', node.id)
                    ev.dataTransfer.effectAllowed = 'move'
                    // defer adding the class so the drag ghost captures the normal look
                    setTimeout(() => el.classList.add('d2ed-widget--dragging'), 0)
                })
                el.addEventListener('dragend', () => {
                    el.classList.remove('d2ed-widget--dragging')
                })
                el.querySelector('[data-action="edit"]').addEventListener('click', e => { e.stopPropagation(); editNode(node.id) })
                el.querySelector('[data-action="reveal"]').addEventListener('click', e => { e.stopPropagation(); revealNode(node.id) })
                el.querySelector('[data-action="delete"]').addEventListener('click', e => { e.stopPropagation(); deleteNode(node.id) })
                el.addEventListener('dblclick', () => editNode(node.id))
                return el
            }

            // -------- widget reorder drag-and-drop --------
            function setupGroupReorderDnD (body, group) {
                let dropTargetEl = null
                let dropBefore = true

                function clearIndicators () {
                    if (dropTargetEl) {
                        dropTargetEl.classList.remove('d2ed-widget--drop-before', 'd2ed-widget--drop-after')
                        dropTargetEl = null
                    }
                }

                body.addEventListener('dragover', ev => {
                    if (!ev.dataTransfer.types.includes('application/x-d2-reorder')) return
                    ev.preventDefault()
                    ev.dataTransfer.dropEffect = 'move'

                    const widgetEl = ev.target.closest('.d2ed-widget')
                    if (widgetEl) {
                        if (dropTargetEl !== widgetEl) {
                            clearIndicators()
                            dropTargetEl = widgetEl
                        }
                        const rect = widgetEl.getBoundingClientRect()
                        const before = ev.clientY < rect.top + rect.height / 2
                        if (before !== dropBefore || !widgetEl.classList.contains('d2ed-widget--drop-before') && !widgetEl.classList.contains('d2ed-widget--drop-after')) {
                            dropBefore = before
                            widgetEl.classList.toggle('d2ed-widget--drop-before', before)
                            widgetEl.classList.toggle('d2ed-widget--drop-after', !before)
                        }
                    } else {
                        clearIndicators()
                    }
                })

                body.addEventListener('dragleave', ev => {
                    if (!body.contains(ev.relatedTarget)) {
                        clearIndicators()
                    }
                })

                body.addEventListener('drop', ev => {
                    const draggedId = ev.dataTransfer.getData('application/x-d2-reorder')
                    if (!draggedId) return
                    ev.preventDefault()
                    const tid = dropTargetEl ? dropTargetEl.dataset.nodeId : null
                    const before = dropBefore
                    clearIndicators()
                    if (!tid || draggedId === tid) return
                    reorderWidgets(draggedId, tid, before, group)
                })
            }

            function reorderWidgets (draggedId, targetId, before, group) {
                const dragged = RED.nodes.node(draggedId)
                if (!dragged || dragged.group !== group.id) return
                const widgets = findWidgets(group.id)
                const others = widgets.filter(w => w.id !== draggedId)
                const targetIdx = others.findIndex(w => w.id === targetId)
                if (targetIdx === -1) return
                const insertAt = before ? targetIdx : targetIdx + 1
                others.splice(insertAt, 0, dragged)
                others.forEach((w, i) => { w.order = i })
                commit()
            }

            // -------- drag-drop (palette → group) --------
            function makeDropZone (el, target) {
                el.addEventListener('dragenter', ev => {
                    ev.preventDefault()
                    ev.stopPropagation()
                })
                el.addEventListener('dragover', ev => {
                    const types = ev.dataTransfer && ev.dataTransfer.types ? Array.from(ev.dataTransfer.types) : []
                    if (!types.includes('application/x-d2-widget')) return
                    ev.preventDefault()
                    ev.stopPropagation()
                    ev.dataTransfer.dropEffect = 'copy'
                    el.classList.add('d2ed-drop-active')
                })
                el.addEventListener('dragleave', () => el.classList.remove('d2ed-drop-active'))
                el.addEventListener('drop', ev => {
                    ev.preventDefault()
                    ev.stopPropagation()
                    el.classList.remove('d2ed-drop-active')
                    const type = ev.dataTransfer.getData('application/x-d2-widget') || ev.dataTransfer.getData('text/plain')
                    if (!type) return
                    handleDrop(type, target)
                })
            }

            function attachRootDropZone () {
                makeDropZone(previewEl, {})
                makeDropZone(emptyEl, {})
            }

            function handleDrop (type, target) {
                const cat = getCatalogEntry(type)
                if (!cat) return
                const base = ensureBase()
                const theme = ensureTheme()

                let page = null
                if (target.page) page = RED.nodes.node(target.page.id) || target.page
                else if (target.group) {
                    const resolvedGroup = RED.nodes.node(target.group.id) || target.group
                    page = resolvedGroup && resolvedGroup.page ? RED.nodes.node(resolvedGroup.page) : null
                }
                else {
                    const existing = findPages(base.id)
                    page = existing[0] || createPage(base, theme, 'Home')
                    if (!existing.length) state.activePageId = page.id
                }
                if (!page) page = createPage(base, theme, 'Home')
                if (!state.activePageId) state.activePageId = page.id

                let group = target.group && (RED.nodes.node(target.group.id) || target.group)
                if (!group) {
                    const existing = findGroups(page.id)
                    group = existing[0] || createGroup(page, 'Default')
                }

                if (!group || !group.id) {
                    RED.notify('Failed to determine a group for the dropped widget.', 'error')
                    return
                }

                const order = findWidgets(group.id).length
                const node = createWidget(group, cat, order)
                if (!node) return
                commit()
                RED.notify(`Added ${cat.label} to group "${group.name}"`, 'success')
            }

            // -------- node actions --------
            function editNode (id) {
                const node = RED.nodes.node(id)
                if (!node) return
                try {
                    if (node.z) {
                        RED.editor.edit(node)
                    } else {
                        RED.editor.editConfig('', node.type, node.id)
                    }
                } catch (err) {
                    RED.notify('Cannot open editor for ' + node.type, 'error')
                }
            }

            function revealNode (id) {
                const node = RED.nodes.node(id)
                if (!node) return
                if (node.z) RED.workspaces.show(node.z)
                RED.view.reveal(id)
            }

            function deleteNode (id) {
                const node = RED.nodes.node(id)
                if (!node) return
                if (isWidgetNodeType(node.type)) removeWidgetSubflow(id)
                RED.nodes.remove(id)
                RED.nodes.dirty(true)
                RED.view.redraw()
                render()
                RED.notify(`Removed ${node.type}`, 'success')
            }

            // -------- toolbar actions --------
            root.querySelector('[data-action="add-page"]').addEventListener('click', () => {
                const base = ensureBase()
                const theme = ensureTheme()
                const page = createPage(base, theme, 'Page ' + (findPages(base.id).length))
                state.activePageId = page.id
                commit()
            })
            root.querySelector('[data-action="add-group"]').addEventListener('click', () => {
                const base = ensureBase()
                const theme = ensureTheme()
                let pages = findPages(base.id)
                let page = pages.find(p => p.id === state.activePageId) || pages[0] || createPage(base, theme, 'Home')
                state.activePageId = page.id
                createGroup(page)
                commit()
            })
            root.querySelector('[data-action="refresh"]').addEventListener('click', () => render())

            // -------- toolbar toggles --------
            // Stylesheet element used to inject one-off rules (e.g. hide our
            // subflow palette section in the Node-RED canvas).
            const toggleStyleEl = document.createElement('style')
            toggleStyleEl.id = 'd2ed-toggle-styles'
            document.head.appendChild(toggleStyleEl)

            const hideSubflowsToggle = root.querySelector('[data-action="toggle-hide-subflows"]')
            const fullscreenToggle = root.querySelector('[data-action="toggle-fullscreen"]')

            // The Node-RED palette renders each subflow category as a header
            // followed by its node tiles. Categories carry their label as a
            // data-attribute on the toggle header (`data-cat`) and on the
            // palette node entries (`palette-header-Used Widgets (UI-Editor)`
            // / `red-ui-palette-header-collapse-Used Widgets (UI-Editor)`).
            // We hide every element whose category attribute references our
            // generated category — works regardless of the user's collapse
            // state.
            function applyHideSubflowsState () {
                if (hideSubflowsToggle.checked) {
                    toggleStyleEl.textContent =
                        // Category header + node tiles in the main palette.
                        '#palette-container .palette-category[data-category="subflow:' + SUBFLOW_CATEGORY + '"],' +
                        '#palette-container [id^="palette_node_subflow:' + SUBFLOW_CATEGORY + '"],' +
                        // Subflow type entries listed under "subflow" category
                        // when Node-RED uses the legacy DOM layout.
                        '#palette-container [data-palette-type^="subflow:"][data-palette-label*="' + SUBFLOW_CATEGORY + '"]' +
                        ' { display: none !important; }'
                } else {
                    toggleStyleEl.textContent = ''
                }
            }
            hideSubflowsToggle.addEventListener('change', applyHideSubflowsState)

            // Fullscreen mode: pin the editor root over the entire viewport
            // so neither the Node-RED palette nor the flow canvas is visible.
            // Also hides Node-RED's own header so the editor truly fills the
            // window. A class on <body> drives both pieces from CSS.
            function applyFullscreenState () {
                if (fullscreenToggle.checked) {
                    document.body.classList.add('d2ed-fullscreen')
                } else {
                    document.body.classList.remove('d2ed-fullscreen')
                }
            }
            fullscreenToggle.addEventListener('change', applyFullscreenState)

            // -------- page layout selector --------
            const layoutSelectorEl = root.querySelector('.d2ed-layout-selector')
            const layoutSelectEl = root.querySelector('.d2ed-layout-select')
            layoutSelectEl.addEventListener('change', () => {
                const base = findBase()
                if (!base) return
                const pages = findPages(base.id)
                const page = pages.find(p => p.id === state.activePageId) || pages[0]
                if (!page) return
                page.layout = layoutSelectEl.value
                if (page._def) RED.nodes.dirty(true)
                render()
            })

            // -------- flow → preview sync --------
            RED.events.on('nodes:add', render)
            RED.events.on('nodes:remove', render)
            RED.events.on('nodes:change', render)
            RED.events.on('flows:change', render)
            RED.events.on('workspace:change', render)
            RED.events.on('deploy', render)

            // Catch widget deletions that happen outside the editor sidebar
            // (e.g. via the Node-RED canvas) and remove the companion subflow
            // from the palette so it never lingers without its widget.
            RED.events.on('nodes:remove', function (n) {
                if (!n || !n.id || !n.type) return
                if (_removingWidgets.has(n.id)) return
                if (!isWidgetNodeType(n.type)) return
                removeWidgetSubflow(n.id)
            })

            // initial paint
            render()

            // -------- util --------
            function escapeHtml (s) {
                return String(s == null ? '' : s)
                    .replace(/&/g, '&amp;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;')
                    .replace(/"/g, '&quot;')
            }
        }
    })
})()
