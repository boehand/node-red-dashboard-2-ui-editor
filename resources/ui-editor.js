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
                        <div class="d2ed-page-tabs"></div>
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
            function activeFlowId () {
                const ws = RED.workspaces.active()
                if (ws) return ws
                let id = null
                RED.nodes.eachWorkspace(w => { if (!id) id = w.id })
                return id
            }

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
                RED.nodes.add(group)
                return group
            }

            function createWidget (group, catalog, placementOrder) {
                const flowId = activeFlowId()
                if (!flowId) {
                    RED.notify('No active flow to drop the widget into.', 'warning')
                    return null
                }
                const offsets = widgetSpawnOffset(flowId)
                const node = Object.assign({
                    id: RED.nodes.id(),
                    type: catalog.type,
                    z: flowId,
                    name: '',
                    group: group.id,
                    x: offsets.x,
                    y: offsets.y,
                    wires: catalog.category === 'input' || catalog.category === 'logic' ? [[]] : []
                }, JSON.parse(JSON.stringify(catalog.defaults || {})))
                if (typeof placementOrder === 'number') node.order = placementOrder
                RED.nodes.add(node)
                return node
            }

            function widgetSpawnOffset (flowId) {
                let maxX = 120, maxY = 60
                RED.nodes.eachNode(n => {
                    if (n.z === flowId && typeof n.x === 'number' && typeof n.y === 'number') {
                        if (n.y > maxY) maxY = n.y
                        if (n.x > maxX) maxX = n.x
                    }
                })
                return { x: 220, y: maxY + 60 }
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
                CATEGORIES.forEach(cat => {
                    const widgets = WIDGETS.filter(w => w.category === cat.id &&
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

                const pageGrid = document.createElement('div')
                pageGrid.className = 'd2ed-page'

                if (!groups.length) {
                    const hint = document.createElement('div')
                    hint.className = 'd2ed-page-empty'
                    hint.textContent = 'No groups on this page yet — drop a widget here or click "Group".'
                    makeDropZone(hint, { page })
                    pageGrid.appendChild(hint)
                } else {
                    groups.forEach(g => pageGrid.appendChild(renderGroup(g)))
                }
                previewEl.appendChild(pageGrid)
            }

            function renderGroup (group) {
                const widgets = findWidgets(group.id)
                const el = document.createElement('section')
                el.className = 'd2ed-group'
                el.style.setProperty('--group-cols', String(group.width || 6))
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

            function renderWidget (node, group) {
                const cat = getCatalogEntry(node.type) || { icon: 'fa-cube', label: node.type }
                const groupCols = group.width || 6
                const span = !node.width || node.width === 0 ? groupCols : Math.min(groupCols, node.width)
                const el = document.createElement('div')
                el.className = 'd2ed-widget'
                el.style.gridColumn = 'span ' + span
                const rowSpan = Math.max(1, node.height || 1)
                el.style.gridRow = 'span ' + rowSpan
                el.dataset.nodeId = node.id
                el.draggable = true
                el.innerHTML = `
                    <div class="d2ed-widget-face">
                        <div class="d2ed-widget-icon"><i class="fa ${cat.icon}"></i></div>
                        <div class="d2ed-widget-text">
                            <div class="d2ed-widget-label">${escapeHtml(node.label || node.name || cat.label)}</div>
                            <div class="d2ed-widget-type">${cat.label}</div>
                        </div>
                    </div>
                    <div class="d2ed-widget-actions">
                        <button title="Edit" data-action="edit"><i class="fa fa-pencil"></i></button>
                        <button title="Reveal on canvas" data-action="reveal"><i class="fa fa-crosshairs"></i></button>
                        <button title="Delete" data-action="delete"><i class="fa fa-trash"></i></button>
                    </div>
                `
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
                el.addEventListener('dragover', ev => {
                    if (!ev.dataTransfer.types.includes('application/x-d2-widget')) return
                    ev.preventDefault()
                    ev.dataTransfer.dropEffect = 'copy'
                    el.classList.add('d2ed-drop-active')
                })
                el.addEventListener('dragleave', () => el.classList.remove('d2ed-drop-active'))
                el.addEventListener('drop', ev => {
                    el.classList.remove('d2ed-drop-active')
                    const type = ev.dataTransfer.getData('application/x-d2-widget')
                    if (!type) return
                    ev.preventDefault()
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
                if (target.page) page = target.page
                else if (target.group) page = RED.nodes.node(target.group.page)
                else {
                    const existing = findPages(base.id)
                    page = existing[0] || createPage(base, theme, 'Home')
                    if (!existing.length) state.activePageId = page.id
                }
                if (!page) page = createPage(base, theme, 'Home')
                if (!state.activePageId) state.activePageId = page.id

                let group = target.group
                if (!group) {
                    const existing = findGroups(page.id)
                    group = existing[0] || createGroup(page, 'Default')
                }

                const order = findWidgets(group.id).length
                createWidget(group, cat, order)
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

            // -------- flow → preview sync --------
            RED.events.on('nodes:add', render)
            RED.events.on('nodes:remove', render)
            RED.events.on('nodes:change', render)
            RED.events.on('flows:change', render)
            RED.events.on('workspace:change', render)
            RED.events.on('deploy', render)

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
