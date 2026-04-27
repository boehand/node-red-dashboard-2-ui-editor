'use strict'

/**
 * Tests for resources/ui-editor.js (editor-side browser code).
 *
 * The IIFE in ui-editor.js is designed to run inside the Node-RED browser
 * editor. We boot it in a JSDOM environment, supplying a minimal RED mock and
 * the real widget catalog, so we can assert on both the DOM it produces and the
 * Node-RED model mutations it performs (node creation, reordering, etc.).
 */

const { JSDOM } = require('jsdom')
const should = require('should')
const fs = require('fs')
const path = require('path')

const CATALOG_SRC = fs.readFileSync(
    path.join(__dirname, '../resources/widget-catalog.js'), 'utf8'
)
const COMPONENTS_SRC = fs.readFileSync(
    path.join(__dirname, '../resources/widget-components.js'), 'utf8'
)
const EDITOR_SRC = fs.readFileSync(
    path.join(__dirname, '../resources/ui-editor.js'), 'utf8'
)

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a RED mock whose node store is the supplied array.
 * Config nodes (ui-base, ui-page, ui-group, ui-theme) must be tagged with
 * `_cfg: true` so that eachConfig/eachNode routing works correctly.
 */
function buildRED (win, nodeStore) {
    const nodes = nodeStore || []
    const subflows = []
    const listeners = {}
    let idSeq = 0

    const RED = {
        // Captured by the IIFE on load
        _plugin: null,
        // Captured when onadd calls RED.sidebar.addTab
        _tab: null,
        // Test-friendly accessors
        _subflows: subflows,
        _emit: function (name, payload) {
            (listeners[name] || []).forEach(fn => { try { fn(payload) } catch (e) {} })
        },

        plugins: {
            registerPlugin: function (id, def) {
                RED._plugin = { id, ...def }
            }
        },
        sidebar: {
            addTab: function (cfg) { RED._tab = cfg }
        },
        events: {
            on: function (name, fn) {
                if (!listeners[name]) listeners[name] = []
                listeners[name].push(fn)
            }
        },
        notify: function () {},
        nodes: {
            eachConfig: function (cb) { nodes.filter(n => n._cfg).forEach(cb) },
            eachNode: function (cb) { nodes.filter(n => !n._cfg).forEach(cb) },
            eachWorkspace: function () {},
            eachSubflow: function (cb) { subflows.forEach(cb) },
            id: function () { return 'id-' + (++idSeq) },
            add: function (n) { nodes.push(n) },
            addSubflow: function (sf) { subflows.push(sf) },
            remove: function (id) {
                const i = nodes.findIndex(n => n.id === id)
                if (i >= 0) nodes.splice(i, 1)
            },
            removeSubflow: function (id) {
                const i = subflows.findIndex(sf => sf.id === id)
                if (i >= 0) subflows.splice(i, 1)
            },
            node: function (id) { return nodes.find(n => n.id === id) || null },
            // Simulate Dashboard 2 node types being registered (returns a truthy stub).
            // Pass getTypeOverride to test behaviour when specific types are absent.
            getType: function (type) {
                if (RED._unavailableTypes && RED._unavailableTypes.has(type)) return null
                return type && type.startsWith('ui-') ? { type } : null
            },
            dirty: function () {}
        },
        view: { redraw: function () {}, reveal: function () {} },
        workspaces: { active: function () { return 'flow-1' }, show: function () {} },
        history: { push: function () {} },
        editor: { edit: function () {}, editConfig: function () {} }
    }

    win.RED = RED
    return RED
}

/**
 * Create a JSDOM instance, load catalog + editor, call onadd(), and return
 * references needed by tests.  nodeStore is shared: push nodes into it before
 * booting to simulate an existing flow.
 */
function boot (nodeStore) {
    const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
        runScripts: 'dangerously'
    })
    const { window } = dom

    // 1. Load catalog so window.D2UIEditorCatalog is set
    window.eval(CATALOG_SRC)
    // 1b. Load the per-widget Vue component registry — the editor uses
    //     window.D2UIWidgetComponents.has() to recognise widget node types
    //     when reacting to deletions.
    window.eval(COMPONENTS_SRC)

    // 2. Wire up RED mock
    const RED = buildRED(window, nodeStore || [])

    // 3. Load editor IIFE — this calls RED.plugins.registerPlugin immediately
    window.eval(EDITOR_SRC)

    // 4. Trigger sidebar setup + initial render
    RED._plugin.onadd()

    // The sidebar content div is the root of everything
    const root = RED._tab.content

    return { window, dom, RED, root, nodes: nodeStore || [] }
}

// Fixture factories ---------------------------------------------------------

function oneBase () {
    return [
        { _cfg: true, id: 'base1', type: 'ui-base', name: 'My Dashboard' }
    ]
}

function onePageOneGroup () {
    return [
        { _cfg: true, id: 'base1', type: 'ui-base', name: 'My Dashboard' },
        { _cfg: true, id: 'page1', type: 'ui-page', name: 'Home', ui: 'base1', order: 0, icon: 'home' },
        { _cfg: true, id: 'grp1', type: 'ui-group', name: 'Controls', page: 'page1', width: 6, order: 0 }
    ]
}

function withWidgets () {
    return [
        ...onePageOneGroup(),
        { id: 'w1', type: 'ui-button', group: 'grp1', name: '', label: 'Click', width: 3, height: 1, order: 0 },
        { id: 'w2', type: 'ui-gauge', group: 'grp1', name: '', title: 'Speed', width: 3, height: 3, order: 1 }
    ]
}

function withWidgetsForReorder () {
    return [
        ...onePageOneGroup(),
        { id: 'w1', type: 'ui-button', group: 'grp1', label: 'A', width: 3, height: 1, order: 0 },
        { id: 'w2', type: 'ui-button', group: 'grp1', label: 'B', width: 3, height: 1, order: 1 },
        { id: 'w3', type: 'ui-button', group: 'grp1', label: 'C', width: 3, height: 1, order: 2 }
    ]
}

function twoBases () {
    return [
        { _cfg: true, id: 'base1', type: 'ui-base', name: 'Dashboard A' },
        { _cfg: true, id: 'base2', type: 'ui-base', name: 'Dashboard B' },
        { _cfg: true, id: 'page1', type: 'ui-page', name: 'Home', ui: 'base1', order: 0, icon: 'home' },
        { _cfg: true, id: 'grp1', type: 'ui-group', name: 'G1', page: 'page1', width: 6, order: 0 }
    ]
}

// jsdom does not expose DataTransfer as a user-constructible class, so we
// supply a minimal plain-object mock that satisfies the setData/getData/types
// contract used by the editor's drag handlers.
function makeDT (initialData) {
    const store = Object.assign({}, initialData || {})
    return {
        get types () { return Object.keys(store) },
        setData (type, val) { store[type] = val },
        getData (type) { return store[type] !== undefined ? store[type] : '' }
    }
}

// jsdom does not expose DragEvent as a user-constructible class.
// We create a plain bubbling Event and attach dataTransfer + clientY so that
// the handlers in ui-editor.js (which only use those two properties) work.
function makeDragEvent (win, type, dataTransfer, clientY) {
    const ev = new win.Event(type, { bubbles: true, cancelable: true })
    Object.defineProperty(ev, 'dataTransfer', { value: dataTransfer })
    Object.defineProperty(ev, 'clientY', { value: clientY !== undefined ? clientY : 0 })
    return ev
}

// Helper to dispatch a drag-like event with a pre-populated DataTransfer mock
function dragEvent (win, type, target, nodeId, clientY) {
    const dt = makeDT({ 'application/x-d2-reorder': nodeId })
    target.dispatchEvent(makeDragEvent(win, type, dt, clientY))
    return dt
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('resources/ui-editor.js', function () {
    // -----------------------------------------------------------------------
    describe('plugin registration', function () {
        it('should register a plugin', function () {
            const { RED } = boot()
            should(RED._plugin).not.be.null()
        })

        it('plugin id should be "dashboard-2-ui-editor"', function () {
            const { RED } = boot()
            RED._plugin.id.should.equal('dashboard-2-ui-editor')
        })

        it('plugin type should be "editor-plugin"', function () {
            const { RED } = boot()
            RED._plugin.type.should.equal('editor-plugin')
        })
    })

    // -----------------------------------------------------------------------
    describe('sidebar tab', function () {
        it('should add exactly one sidebar tab on onadd', function () {
            const { RED } = boot()
            should(RED._tab).not.be.null()
        })

        it('tab id should match SIDEBAR_ID', function () {
            const { RED } = boot()
            RED._tab.id.should.equal('dashboard-2-ui-editor-sidebar')
        })

        it('tab label should be "UI Editor"', function () {
            const { RED } = boot()
            RED._tab.label.should.equal('UI Editor')
        })

        it('tab content should be a DOM element', function () {
            const { RED } = boot()
            should(RED._tab.content).not.be.null()
            RED._tab.content.tagName.should.equal('DIV')
        })
    })

    // -----------------------------------------------------------------------
    describe('palette render', function () {
        it('should render palette tiles for all widget types', function () {
            const { root, window } = boot()
            const { WIDGETS } = window.D2UIEditorCatalog
            root.querySelectorAll('.d2ed-palette-tile').length.should.equal(WIDGETS.length)
        })

        it('should render one section per category', function () {
            const { root, window } = boot()
            const { CATEGORIES } = window.D2UIEditorCatalog
            root.querySelectorAll('.d2ed-palette-category').length.should.equal(CATEGORIES.length)
        })

        it('each palette tile should carry the widget type as data attribute', function () {
            const { root, window } = boot()
            const { WIDGETS } = window.D2UIEditorCatalog
            const types = Array.from(root.querySelectorAll('.d2ed-palette-tile'))
                .map(el => el.dataset.widgetType)
            WIDGETS.forEach(w => types.should.containEql(w.type))
        })

        it('palette tiles should be draggable', function () {
            const { root } = boot()
            root.querySelectorAll('.d2ed-palette-tile').forEach(tile => {
                tile.draggable.should.be.true()
            })
        })

        it('should show only registered widget types (Dashboard 2 must be installed)', function () {
            // All ui-* types are mocked as registered — full catalog should appear
            const { root, window } = boot()
            const { WIDGETS } = window.D2UIEditorCatalog
            root.querySelectorAll('.d2ed-palette-tile').length.should.equal(WIDGETS.length)
        })

        it('should hide a widget type that is not registered in Node-RED', function () {
            const nodes = []
            const { window, dom } = boot(nodes)
            // Mark ui-gauge as unavailable after boot, then trigger a re-render
            const RED = window.RED
            RED._unavailableTypes = new Set(['ui-gauge'])
            // Trigger re-render via the refresh button
            const root = RED._tab.content
            root.querySelector('[data-action="refresh"]').click()
            const types = Array.from(root.querySelectorAll('.d2ed-palette-tile'))
                .map(el => el.dataset.widgetType)
            types.should.not.containEql('ui-gauge')
        })

        it('should show installation notice when no Dashboard 2 types are registered', function () {
            const nodes = []
            const { window } = boot(nodes)
            const RED = window.RED
            // Override getType to always return null (Dashboard 2 not installed)
            RED.nodes.getType = function () { return null }
            const root = RED._tab.content
            root.querySelector('[data-action="refresh"]').click()
            should(root.querySelector('.d2ed-palette-notice')).not.be.null()
            root.querySelectorAll('.d2ed-palette-tile').length.should.equal(0)
        })

        it('filter input should narrow visible tiles', function () {
            const { root } = boot()
            const input = root.querySelector('.d2ed-palette-filter')
            input.value = 'gauge'
            input.dispatchEvent(new input.ownerDocument.defaultView.Event('input'))
            const remaining = root.querySelectorAll('.d2ed-palette-tile')
            remaining.length.should.equal(1)
            remaining[0].dataset.widgetType.should.equal('ui-gauge')
        })
    })

    // -----------------------------------------------------------------------
    describe('empty-state render (no nodes)', function () {
        it('should display the empty-state panel', function () {
            const { root } = boot([])
            root.querySelector('.d2ed-empty-state').hidden.should.be.false()
        })

        it('preview area should be empty', function () {
            const { root } = boot([])
            root.querySelector('.d2ed-preview').innerHTML.should.equal('')
        })

        it('page-tab bar should be empty', function () {
            const { root } = boot([])
            root.querySelector('.d2ed-page-tabs').innerHTML.should.equal('')
        })
    })

    // -----------------------------------------------------------------------
    describe('render with one base and no pages', function () {
        it('should show empty-state when base has no pages', function () {
            const { root } = boot(oneBase())
            root.querySelector('.d2ed-empty-state').hidden.should.be.false()
        })
    })

    // -----------------------------------------------------------------------
    describe('render with one page and one group', function () {
        it('should hide empty-state', function () {
            const { root } = boot(withWidgets())
            root.querySelector('.d2ed-empty-state').hidden.should.be.true()
        })

        it('should render one page tab', function () {
            const { root } = boot(withWidgets())
            root.querySelectorAll('.d2ed-page-tab').length.should.equal(1)
        })

        it('active page tab label should match the page name', function () {
            const { root } = boot(withWidgets())
            root.querySelector('.d2ed-page-tab.is-active span').textContent.should.equal('Home')
        })

        it('should render one group card', function () {
            const { root } = boot(withWidgets())
            root.querySelectorAll('.d2ed-group').length.should.equal(1)
        })

        it('group title should match the group name', function () {
            const { root } = boot(withWidgets())
            root.querySelector('.d2ed-group-title').textContent.should.equal('Controls')
        })

        it('group meta should show widget count', function () {
            const { root } = boot(withWidgets())
            root.querySelector('.d2ed-group-meta').textContent.should.match(/2 widgets/)
        })

        it('group body should expose --group-cols CSS variable', function () {
            const { root } = boot(withWidgets())
            root.querySelector('.d2ed-group-body')
                .style.getPropertyValue('--group-cols').should.equal('6')
        })

        it('should render two widget tiles', function () {
            const { root } = boot(withWidgets())
            root.querySelectorAll('.d2ed-widget').length.should.equal(2)
        })

        it('each widget tile should carry the node id as data attribute', function () {
            const nodes = withWidgets()
            const { root } = boot(nodes)
            const tileIds = Array.from(root.querySelectorAll('.d2ed-widget'))
                .map(el => el.dataset.nodeId)
            tileIds.should.containEql('w1')
            tileIds.should.containEql('w2')
        })

        it('widget tiles should be draggable (reorder support)', function () {
            const { root } = boot(withWidgets())
            root.querySelectorAll('.d2ed-widget').forEach(tile => {
                tile.draggable.should.be.true()
            })
        })

        it('each widget tile should have edit, reveal and delete buttons', function () {
            const { root } = boot(withWidgets())
            root.querySelectorAll('.d2ed-widget').forEach(tile => {
                should(tile.querySelector('[data-action="edit"]')).not.be.null()
                should(tile.querySelector('[data-action="reveal"]')).not.be.null()
                should(tile.querySelector('[data-action="delete"]')).not.be.null()
            })
        })
    })

    // -----------------------------------------------------------------------
    describe('multiple ui-base (base selector)', function () {
        it('should hide the base selector when only one base exists', function () {
            const { root } = boot(oneBase())
            root.querySelector('.d2ed-base-selector').hidden.should.be.true()
        })

        it('should show the base selector when two bases exist', function () {
            const { root } = boot(twoBases())
            root.querySelector('.d2ed-base-selector').hidden.should.be.false()
        })

        it('should render one <option> per base', function () {
            const { root } = boot(twoBases())
            root.querySelectorAll('.d2ed-base-select option').length.should.equal(2)
        })

        it('option texts should match base names', function () {
            const { root } = boot(twoBases())
            const labels = Array.from(root.querySelectorAll('.d2ed-base-select option'))
                .map(o => o.textContent)
            labels.should.containEql('Dashboard A')
            labels.should.containEql('Dashboard B')
        })

        it('switching base should display pages of the selected base only', function () {
            const nodes = [
                ...twoBases(),
                { _cfg: true, id: 'page2', type: 'ui-page', name: 'Beta Page', ui: 'base2', order: 0, icon: 'home' },
                { _cfg: true, id: 'grp2', type: 'ui-group', name: 'G2', page: 'page2', width: 6, order: 0 }
            ]
            const { root } = boot(nodes)

            // Initially shows base1 → "Home" tab
            root.querySelector('.d2ed-page-tab span').textContent.should.equal('Home')

            // Switch to base2 via the select element
            const sel = root.querySelector('.d2ed-base-select')
            sel.value = 'base2'
            sel.dispatchEvent(new sel.ownerDocument.defaultView.Event('change'))

            root.querySelector('.d2ed-page-tab span').textContent.should.equal('Beta Page')
        })
    })

    // -----------------------------------------------------------------------
    describe('node creation via toolbar buttons', function () {
        it('"Add Page" button should create a ui-page config node', function () {
            const nodes = oneBase()
            const { root } = boot(nodes)
            root.querySelector('[data-action="add-page"]').click()
            const pages = nodes.filter(n => n.type === 'ui-page')
            pages.length.should.equal(1)
        })

        it('"Add Group" button should create a ui-group config node', function () {
            const nodes = onePageOneGroup()
            const { root } = boot(nodes)
            root.querySelector('[data-action="add-group"]').click()
            const groups = nodes.filter(n => n.type === 'ui-group')
            groups.length.should.equal(2)
        })

        it('"Add Page" on empty flow should also create a ui-base', function () {
            const nodes = []
            const { root } = boot(nodes)
            root.querySelector('[data-action="add-page"]').click()
            nodes.filter(n => n.type === 'ui-base').length.should.equal(1)
        })
    })

    // -----------------------------------------------------------------------
    describe('delete action', function () {
        it('clicking delete should remove the widget from the node store', function () {
            const nodes = withWidgets()
            const { root } = boot(nodes)
            root.querySelector('[data-action="delete"]').click()
            nodes.filter(n => n.id === 'w1').length.should.equal(0)
        })

        it('after deletion the group meta should reflect the new count', function () {
            const nodes = withWidgets()
            const { root } = boot(nodes)
            root.querySelector('[data-action="delete"]').click()
            const meta = root.querySelector('.d2ed-group-meta').textContent
            meta.should.containEql('1 widget')
            meta.should.not.containEql('1 widgets')
        })
    })

    // -----------------------------------------------------------------------
    describe('widget drag-to-reorder', function () {
        it('dragstart on a widget tile should set reorder data', function () {
            const nodes = withWidgetsForReorder()
            const { root, window } = boot(nodes)

            const tile = root.querySelector('.d2ed-widget')
            // Use a plain mock DataTransfer — the handler calls setData on it
            const dt = makeDT({})
            tile.dispatchEvent(makeDragEvent(window, 'dragstart', dt))

            dt.getData('application/x-d2-reorder').should.equal('w1')
        })

        it('dropping w3 before w1 should place w3 at order 0', function () {
            const nodes = withWidgetsForReorder()
            const { root, window } = boot(nodes)
            const tiles = root.querySelectorAll('.d2ed-widget')
            const tile1 = tiles[0] // w1
            const tile3 = tiles[2] // w3

            // dragstart on w3 — just primes the handler's setTimeout class; data tested separately
            dragEvent(window, 'dragstart', tile3, 'w3')
            // dragover tile1 with negative clientY → dropBefore = true
            dragEvent(window, 'dragover', tile1, 'w3', -1)
            // drop
            dragEvent(window, 'drop', tile1, 'w3', -1)

            const w1 = nodes.find(n => n.id === 'w1')
            const w2 = nodes.find(n => n.id === 'w2')
            const w3 = nodes.find(n => n.id === 'w3')
            w3.order.should.equal(0)
            w1.order.should.equal(1)
            w2.order.should.equal(2)
        })

        it('dropping w1 after w2 should place w1 at order 1', function () {
            const nodes = withWidgetsForReorder()
            const { root, window } = boot(nodes)
            const tiles = root.querySelectorAll('.d2ed-widget')
            const tile1 = tiles[0] // w1
            const tile2 = tiles[1] // w2

            // dragstart on w1
            dragEvent(window, 'dragstart', tile1, 'w1')
            // dragover tile2 with positive clientY → dropBefore = false (drop after)
            dragEvent(window, 'dragover', tile2, 'w1', 1)
            // drop
            dragEvent(window, 'drop', tile2, 'w1', 1)

            const w1 = nodes.find(n => n.id === 'w1')
            const w2 = nodes.find(n => n.id === 'w2')
            const w3 = nodes.find(n => n.id === 'w3')
            w2.order.should.equal(0)
            w1.order.should.equal(1)
            w3.order.should.equal(2)
        })

        it('dropping a widget onto itself should not change order', function () {
            const nodes = withWidgetsForReorder()
            const { root, window } = boot(nodes)
            const tile1 = root.querySelectorAll('.d2ed-widget')[0]

            const orderBefore = nodes.map(n => n.order)
            dragEvent(window, 'dragstart', tile1, 'w1')
            dragEvent(window, 'dragover', tile1, 'w1', -1)
            dragEvent(window, 'drop', tile1, 'w1', -1)

            nodes.map(n => n.order).should.deepEqual(orderBefore)
        })

        it('widget from a different group should not be reordered', function () {
            const nodes = [
                ...onePageOneGroup(),
                { _cfg: true, id: 'grp2', type: 'ui-group', name: 'G2', page: 'page1', width: 6, order: 1 },
                { id: 'w1', type: 'ui-button', group: 'grp1', label: 'A', width: 3, height: 1, order: 0 },
                { id: 'wx', type: 'ui-button', group: 'grp2', label: 'X', width: 3, height: 1, order: 0 }
            ]
            const { root, window } = boot(nodes)

            // Drag wx (grp2) and try to drop on w1 (grp1)
            const grp1Tile = root.querySelector('[data-node-id="w1"]')
            const grp2Tile = root.querySelector('[data-node-id="wx"]')

            dragEvent(window, 'dragstart', grp2Tile, 'wx')
            dragEvent(window, 'dragover', grp1Tile, 'wx', -1)
            dragEvent(window, 'drop', grp1Tile, 'wx', -1)

            // w1 order should remain 0
            nodes.find(n => n.id === 'w1').order.should.equal(0)
        })

        it('dragover indicator class is applied to the target tile', function () {
            const nodes = withWidgetsForReorder()
            const { root, window } = boot(nodes)
            const tiles = root.querySelectorAll('.d2ed-widget')

            dragEvent(window, 'dragstart', tiles[2], 'w3')
            dragEvent(window, 'dragover', tiles[0], 'w3', -1)

            const hasIndicator =
                tiles[0].classList.contains('d2ed-widget--drop-before') ||
                tiles[0].classList.contains('d2ed-widget--drop-after')
            hasIndicator.should.be.true()
        })
    })

    // -----------------------------------------------------------------------
    // Each widget dropped from the palette gets a companion subflow stored in
    // the "Used Widgets (UI-Editor)" palette category. The subflow itself is
    // not instantiated on any flow — these tests verify the pairing is created
    // on drop and torn down on widget deletion.
    // -----------------------------------------------------------------------
    describe('palette → group drop creates a paired subflow', function () {
        function dropPaletteWidget (window, target, widgetType) {
            const dt = makeDT({
                'application/x-d2-widget': widgetType,
                'text/plain': widgetType
            })
            target.dispatchEvent(makeDragEvent(window, 'dragenter', dt, 0))
            target.dispatchEvent(makeDragEvent(window, 'dragover', dt, 0))
            target.dispatchEvent(makeDragEvent(window, 'drop', dt, 0))
        }

        it('dropping a button on a group should create one subflow', function () {
            const nodes = onePageOneGroup()
            const { root, window, RED } = boot(nodes)
            const groupBody = root.querySelector('.d2ed-group-body')
            dropPaletteWidget(window, groupBody, 'ui-button')
            RED._subflows.length.should.equal(1)
        })

        it('the subflow should belong to the "Used Widgets (UI-Editor)" category', function () {
            const nodes = onePageOneGroup()
            const { root, window, RED } = boot(nodes)
            const groupBody = root.querySelector('.d2ed-group-body')
            dropPaletteWidget(window, groupBody, 'ui-gauge')
            RED._subflows[0].category.should.equal('Used Widgets (UI-Editor)')
        })

        it('the subflow should have type "subflow" and back-reference the widget id via meta', function () {
            const nodes = onePageOneGroup()
            const { root, window, RED } = boot(nodes)
            const groupBody = root.querySelector('.d2ed-group-body')
            dropPaletteWidget(window, groupBody, 'ui-switch')
            const sf = RED._subflows[0]
            sf.type.should.equal('subflow')
            const widget = nodes.find(n => n.type === 'ui-switch')
            should(widget).not.be.null()
            sf.meta.d2edWidgetId.should.equal(widget.id)
            sf.meta.d2edWidgetType.should.equal('ui-switch')
        })

        it('the subflow name should include the widget type label', function () {
            const nodes = onePageOneGroup()
            const { root, window, RED } = boot(nodes)
            const groupBody = root.querySelector('.d2ed-group-body')
            dropPaletteWidget(window, groupBody, 'ui-button')
            RED._subflows[0].name.should.match(/Button/)
        })

        it('input-category widgets should produce a subflow with one input and one output port', function () {
            const nodes = onePageOneGroup()
            const { root, window, RED } = boot(nodes)
            const groupBody = root.querySelector('.d2ed-group-body')
            dropPaletteWidget(window, groupBody, 'ui-button')
            const sf = RED._subflows[0]
            sf.in.length.should.equal(1)
            sf.out.length.should.equal(1)
        })

        it('output-category widgets should produce a subflow with one input port and no output', function () {
            const nodes = onePageOneGroup()
            const { root, window, RED } = boot(nodes)
            const groupBody = root.querySelector('.d2ed-group-body')
            dropPaletteWidget(window, groupBody, 'ui-gauge')
            const sf = RED._subflows[0]
            sf.in.length.should.equal(1)
            sf.out.length.should.equal(0)
        })

        it('two drops should create two subflows, one per widget', function () {
            const nodes = onePageOneGroup()
            const { root, window, RED } = boot(nodes)
            const groupBody = root.querySelector('.d2ed-group-body')
            dropPaletteWidget(window, groupBody, 'ui-button')
            // Re-resolve since render() rebuilt the DOM after the first drop
            const groupBody2 = root.querySelector('.d2ed-group-body')
            dropPaletteWidget(window, groupBody2, 'ui-slider')
            RED._subflows.length.should.equal(2)
            const widgetIds = nodes.filter(n => n.type === 'ui-button' || n.type === 'ui-slider').map(n => n.id)
            const refs = RED._subflows.map(sf => sf.meta.d2edWidgetId).sort()
            refs.should.deepEqual(widgetIds.sort())
        })
    })

    describe('widget deletion removes the paired subflow', function () {
        function dropAndGetWidget (root, window, type) {
            const groupBody = root.querySelector('.d2ed-group-body')
            const dt = makeDT({
                'application/x-d2-widget': type,
                'text/plain': type
            })
            groupBody.dispatchEvent(makeDragEvent(window, 'dragenter', dt, 0))
            groupBody.dispatchEvent(makeDragEvent(window, 'dragover', dt, 0))
            groupBody.dispatchEvent(makeDragEvent(window, 'drop', dt, 0))
        }

        it('clicking delete on the widget should also drop its subflow', function () {
            const nodes = onePageOneGroup()
            const { root, window, RED } = boot(nodes)
            dropAndGetWidget(root, window, 'ui-button')
            RED._subflows.length.should.equal(1)
            // The newly added widget tile has the matching delete button.
            root.querySelector('.d2ed-widget [data-action="delete"]').click()
            RED._subflows.length.should.equal(0)
        })

        it('deleting one of two widgets should only drop that widget\'s subflow', function () {
            const nodes = onePageOneGroup()
            const { root, window, RED } = boot(nodes)
            dropAndGetWidget(root, window, 'ui-button')
            dropAndGetWidget(root, window, 'ui-slider')
            RED._subflows.length.should.equal(2)
            const remainingWidget = nodes.find(n => n.type === 'ui-slider')
            // Delete the button (the first widget tile in document order).
            const buttonTile = root.querySelector('[data-node-id="' + nodes.find(n => n.type === 'ui-button').id + '"]')
            buttonTile.querySelector('[data-action="delete"]').click()
            RED._subflows.length.should.equal(1)
            RED._subflows[0].meta.d2edWidgetId.should.equal(remainingWidget.id)
        })

        it('a nodes:remove event for the widget (e.g. canvas delete) should also drop its subflow', function () {
            const nodes = onePageOneGroup()
            const { root, window, RED } = boot(nodes)
            dropAndGetWidget(root, window, 'ui-button')
            const widget = nodes.find(n => n.type === 'ui-button')
            RED._subflows.length.should.equal(1)
            // Simulate Node-RED firing nodes:remove from the canvas
            RED._emit('nodes:remove', widget)
            RED._subflows.length.should.equal(0)
        })

        it('deleting a non-widget node (e.g. ui-group) should NOT touch subflows', function () {
            const nodes = onePageOneGroup()
            const { root, window, RED } = boot(nodes)
            dropAndGetWidget(root, window, 'ui-button')
            RED._subflows.length.should.equal(1)
            const grp = nodes.find(n => n.type === 'ui-group')
            RED._emit('nodes:remove', grp)
            RED._subflows.length.should.equal(1)
        })
    })

    // -----------------------------------------------------------------------
    // Each widget gets a fully-wired subflow plus a companion plumbing group
    // on the dedicated "Used Widgets (UI-Editor)" tab. These tests verify that
    // the websocket bridge between subflow and widget is generated correctly.
    // -----------------------------------------------------------------------
    describe('subflow + widget group plumbing', function () {
        function dropPaletteWidget (window, target, widgetType) {
            const dt = makeDT({
                'application/x-d2-widget': widgetType,
                'text/plain': widgetType
            })
            target.dispatchEvent(makeDragEvent(window, 'dragenter', dt, 0))
            target.dispatchEvent(makeDragEvent(window, 'dragover', dt, 0))
            target.dispatchEvent(makeDragEvent(window, 'drop', dt, 0))
        }

        it('first widget creates the "Used Widgets (UI-Editor)" tab', function () {
            const nodes = onePageOneGroup()
            const { root, window } = boot(nodes)
            dropPaletteWidget(window, root.querySelector('.d2ed-group-body'), 'ui-button')
            const tab = nodes.find(n => n.type === 'tab' && n.label === 'Used Widgets (UI-Editor)')
            should(tab).not.be.null()
            should(tab).not.be.undefined()
        })

        it('second widget reuses the existing "Used Widgets (UI-Editor)" tab', function () {
            const nodes = onePageOneGroup()
            const { root, window } = boot(nodes)
            dropPaletteWidget(window, root.querySelector('.d2ed-group-body'), 'ui-button')
            dropPaletteWidget(window, root.querySelector('.d2ed-group-body'), 'ui-slider')
            const tabs = nodes.filter(n => n.type === 'tab' && n.label === 'Used Widgets (UI-Editor)')
            tabs.length.should.equal(1)
        })

        it('shared websocket-listener configs are created once and reused across widgets', function () {
            const nodes = onePageOneGroup()
            const { root, window } = boot(nodes)
            dropPaletteWidget(window, root.querySelector('.d2ed-group-body'), 'ui-button')
            dropPaletteWidget(window, root.querySelector('.d2ed-group-body'), 'ui-slider')
            const inListeners = nodes.filter(n => n.type === 'websocket-listener' && n.path === '/ws/uieditor/ui-in')
            const outListeners = nodes.filter(n => n.type === 'websocket-listener' && n.path === '/ws/uieditor/ui-out')
            inListeners.length.should.equal(1)
            outListeners.length.should.equal(1)
        })

        it('shared ui-out websocket-client is created once and reused', function () {
            const nodes = onePageOneGroup()
            const { root, window } = boot(nodes)
            dropPaletteWidget(window, root.querySelector('.d2ed-group-body'), 'ui-button')
            dropPaletteWidget(window, root.querySelector('.d2ed-group-body'), 'ui-slider')
            const sharedClients = nodes.filter(n => n.type === 'websocket-client' &&
                n.path === 'ws://localhost:1880/ws/uieditor/ui-out' && !n.z)
            sharedClients.length.should.equal(1)
        })

        it('the widget node is placed on the Used Widgets tab inside its plumbing group', function () {
            const nodes = onePageOneGroup()
            const { root, window } = boot(nodes)
            dropPaletteWidget(window, root.querySelector('.d2ed-group-body'), 'ui-button')
            const tab = nodes.find(n => n.type === 'tab' && n.label === 'Used Widgets (UI-Editor)')
            const widget = nodes.find(n => n.type === 'ui-button')
            const group = nodes.find(n => n.type === 'group' && n.z === tab.id)
            widget.z.should.equal(tab.id)
            widget.g.should.equal(group.id)
            group.nodes.indexOf(widget.id).should.be.greaterThanOrEqual(0)
        })

        it('input-category widget group contains websocket-in, filter switch, function and websocket-out', function () {
            const nodes = onePageOneGroup()
            const { root, window } = boot(nodes)
            dropPaletteWidget(window, root.querySelector('.d2ed-group-body'), 'ui-button')
            const widget = nodes.find(n => n.type === 'ui-button')
            const groupId = widget.g
            const members = nodes.filter(n => n.g === groupId)
            members.some(n => n.type === 'websocket in').should.be.true()
            members.some(n => n.type === 'switch' && n.name === 'filter widgetid').should.be.true()
            members.some(n => n.type === 'function' && /clean up msg/.test(n.name)).should.be.true()
            members.some(n => n.type === 'websocket out').should.be.true()
        })

        it('output-only widget group contains websocket-in and filter switch but no function/websocket-out', function () {
            const nodes = onePageOneGroup()
            const { root, window } = boot(nodes)
            dropPaletteWidget(window, root.querySelector('.d2ed-group-body'), 'ui-gauge')
            const widget = nodes.find(n => n.type === 'ui-gauge')
            const groupId = widget.g
            const members = nodes.filter(n => n.g === groupId)
            members.some(n => n.type === 'websocket in').should.be.true()
            members.some(n => n.type === 'switch' && n.name === 'filter widgetid').should.be.true()
            members.some(n => n.type === 'function').should.be.false()
            members.some(n => n.type === 'websocket out').should.be.false()
        })

        it('the widget-group filter switch hardcodes the widget id (vt: str)', function () {
            const nodes = onePageOneGroup()
            const { root, window } = boot(nodes)
            dropPaletteWidget(window, root.querySelector('.d2ed-group-body'), 'ui-button')
            const widget = nodes.find(n => n.type === 'ui-button')
            const sw = nodes.find(n => n.type === 'switch' && n.g === widget.g)
            sw.property.should.equal('uieditor.widgetid')
            sw.rules[0].vt.should.equal('str')
            sw.rules[0].v.should.equal(widget.id)
        })

        it('the function node body references the widget id and uses "clean up" (no typo)', function () {
            const nodes = onePageOneGroup()
            const { root, window } = boot(nodes)
            dropPaletteWidget(window, root.querySelector('.d2ed-group-body'), 'ui-button')
            const widget = nodes.find(n => n.type === 'ui-button')
            const fn = nodes.find(n => n.type === 'function' && n.g === widget.g)
            fn.name.should.match(/^clean up/)
            fn.func.should.containEql(widget.id)
            fn.func.should.containEql('uieditor')
            fn.func.should.containEql('payload')
        })

        it('subflow exposes a widgetid env var matching the widget id', function () {
            const nodes = onePageOneGroup()
            const { root, window, RED } = boot(nodes)
            dropPaletteWidget(window, root.querySelector('.d2ed-group-body'), 'ui-button')
            const widget = nodes.find(n => n.type === 'ui-button')
            const sf = RED._subflows[0]
            const widgetidEnv = sf.env.find(e => e.name === 'widgetid')
            should(widgetidEnv).not.be.undefined()
            widgetidEnv.value.should.equal(widget.id)
            widgetidEnv.type.should.equal('str')
        })

        it('input-category subflow contains change, websocket-out, websocket-in and filter switch', function () {
            const nodes = onePageOneGroup()
            const { root, window, RED } = boot(nodes)
            dropPaletteWidget(window, root.querySelector('.d2ed-group-body'), 'ui-button')
            const sf = RED._subflows[0]
            // Cross-context arrays from JSDOM don't inherit should's prototype
            // patch — wrap with should() to use the static API.
            const types = Array.from(sf.nodes).map(n => n.type)
            should(types).containEql('change')
            should(types).containEql('websocket out')
            should(types).containEql('websocket in')
            should(types).containEql('switch')
            should(types).containEql('websocket-client')
        })

        it('output-only subflow contains change + websocket-out only (no filter switch / websocket-in)', function () {
            const nodes = onePageOneGroup()
            const { root, window, RED } = boot(nodes)
            dropPaletteWidget(window, root.querySelector('.d2ed-group-body'), 'ui-gauge')
            const sf = RED._subflows[0]
            const types = Array.from(sf.nodes).map(n => n.type)
            should(types).containEql('change')
            should(types).containEql('websocket out')
            should(types).not.containEql('switch')
            should(types).not.containEql('websocket in')
        })

        it('subflow filter switch uses env-based widgetid lookup (vt: env)', function () {
            const nodes = onePageOneGroup()
            const { root, window, RED } = boot(nodes)
            dropPaletteWidget(window, root.querySelector('.d2ed-group-body'), 'ui-button')
            const sf = RED._subflows[0]
            const sw = sf.nodes.find(n => n.type === 'switch')
            sw.rules[0].vt.should.equal('env')
            sw.rules[0].v.should.equal('widgetid')
        })

        it('removing a widget tears down its plumbing group and member nodes', function () {
            const nodes = onePageOneGroup()
            const { root, window, RED } = boot(nodes)
            dropPaletteWidget(window, root.querySelector('.d2ed-group-body'), 'ui-button')
            const widget = nodes.find(n => n.type === 'ui-button')
            const groupId = widget.g
            // Plumbing was created.
            nodes.some(n => n.id === groupId).should.be.true()
            nodes.filter(n => n.g === groupId).length.should.be.greaterThan(0)
            // Trigger canvas-style removal (the editor's nodes:remove hook).
            // In real Node-RED the widget is already gone by the time the
            // event fires; mirror that here.
            const widgetIdx = nodes.indexOf(widget)
            if (widgetIdx >= 0) nodes.splice(widgetIdx, 1)
            RED._emit('nodes:remove', widget)
            // Group and its members are gone.
            nodes.some(n => n.id === groupId).should.be.false()
            nodes.filter(n => n.g === groupId).length.should.equal(0)
        })

        it('removing one of two widgets keeps shared listeners + tab intact', function () {
            const nodes = onePageOneGroup()
            const { root, window, RED } = boot(nodes)
            dropPaletteWidget(window, root.querySelector('.d2ed-group-body'), 'ui-button')
            dropPaletteWidget(window, root.querySelector('.d2ed-group-body'), 'ui-slider')
            const button = nodes.find(n => n.type === 'ui-button')
            RED._emit('nodes:remove', button)
            nodes.some(n => n.type === 'tab' && n.label === 'Used Widgets (UI-Editor)').should.be.true()
            nodes.filter(n => n.type === 'websocket-listener').length.should.equal(2)
        })
    })
})
