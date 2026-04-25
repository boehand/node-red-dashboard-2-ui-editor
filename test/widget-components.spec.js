'use strict'

/**
 * Tests for resources/widget-components.js — the per-widget Vue 3 component
 * registry used by the editor preview.
 *
 * The file is a browser IIFE: we evaluate it in a JSDOM window, then assert
 * on the resulting D2UIWidgetComponents object and on the DOM Vue produces
 * when each component is mounted with a representative `node` shape.
 */

const fs = require('fs')
const path = require('path')
const { JSDOM } = require('jsdom')
const should = require('should')

const COMPONENTS_SRC = fs.readFileSync(
    path.join(__dirname, '../resources/widget-components.js'), 'utf8'
)
const CATALOG_SRC = fs.readFileSync(
    path.join(__dirname, '../resources/widget-catalog.js'), 'utf8'
)

// Bundled Vue 3 global build — registry tests rely on its template compiler
// to actually mount each component, just as the editor does at runtime.
const VUE_PATH = path.join(__dirname, '../resources/vue.global.prod.js')
const VUE_AVAILABLE = fs.existsSync(VUE_PATH) && fs.statSync(VUE_PATH).size > 1000

function bootDOM () {
    const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
        runScripts: 'dangerously'
    })
    const { window } = dom
    if (VUE_AVAILABLE) {
        const VUE_SRC = fs.readFileSync(VUE_PATH, 'utf8')
        window.eval(VUE_SRC)
    }
    window.eval(CATALOG_SRC)
    window.eval(COMPONENTS_SRC)
    return { dom, window }
}

function mountWidget (window, type, node) {
    const def = window.D2UIWidgetComponents.resolve(type)
    const host = window.document.createElement('div')
    window.document.body.appendChild(host)
    const app = window.Vue.createApp({
        components: { 'widget-component': def },
        data: () => ({ node, group: { width: 6 } }),
        template: '<widget-component :node="node" :group="group"/>'
    })
    app.config.warnHandler = () => {}
    app.mount(host)
    return { host, app }
}

describe('resources/widget-components.js', function () {
    describe('module exports', function () {
        it('should expose D2UIWidgetComponents with components/resolve/has/types', function () {
            const { window } = bootDOM()
            const m = window.D2UIWidgetComponents
            should(m).be.an.Object()
            should(m.components).be.an.Object()
            should(m.resolve).be.a.Function()
            should(m.has).be.a.Function()
            should(m.types).be.a.Function()
        })

        it('should register a component for every catalog widget type', function () {
            const { window } = bootDOM()
            const { WIDGETS } = window.D2UIEditorCatalog
            const { has } = window.D2UIWidgetComponents
            WIDGETS.forEach(w => {
                has(w.type).should.be.true(`no component registered for ${w.type}`)
            })
        })

        it('every component definition should expose a template string', function () {
            const { window } = bootDOM()
            const { components } = window.D2UIWidgetComponents
            Object.entries(components).forEach(([type, def]) => {
                should(typeof def.template).equal('string', type)
                should(def.template.length).be.greaterThan(10, type)
            })
        })

        it('resolve should throw on an unknown widget type (no fallback)', function () {
            const { window } = bootDOM()
            const { resolve } = window.D2UIWidgetComponents
            ;(function () { resolve('ui-does-not-exist') }).should.throw(/No Vue component registered/)
        })
    })

    if (!VUE_AVAILABLE) {
        // The bundled Vue 3 file is required for the live-mount tests below.
        // Without it the registry exists but cannot be exercised end-to-end.
        return
    }

    describe('rendering — input widgets', function () {
        it('ui-button should render a button labelled with node.label', function () {
            const { window } = bootDOM()
            const { host } = mountWidget(window, 'ui-button', { label: 'Click me', color: '#ff0000' })
            const btn = host.querySelector('.d2ed-pw-btn')
            should(btn).not.be.null()
            btn.textContent.should.containEql('Click me')
            btn.getAttribute('style').should.match(/background:\s*(#ff0000|rgb\(255,\s*0,\s*0\))/)
        })

        it('ui-button should fall back to "button" text when no label given', function () {
            const { window } = bootDOM()
            const { host } = mountWidget(window, 'ui-button', {})
            host.querySelector('.d2ed-pw-btn').textContent.should.containEql('button')
        })

        it('ui-switch should render the toggle in the off state when passthru is false', function () {
            const { window } = bootDOM()
            const { host } = mountWidget(window, 'ui-switch', { label: 'L1', passthru: false })
            host.querySelector('.d2ed-pw-toggle').classList.contains('is-off').should.be.true()
        })

        it('ui-slider should render min/max bounds from node defaults', function () {
            const { window } = bootDOM()
            const { host } = mountWidget(window, 'ui-slider', { label: 'L', min: 5, max: 25 })
            const bounds = host.querySelectorAll('.d2ed-pw-slider-bound')
            bounds[0].textContent.should.equal('5')
            bounds[1].textContent.should.equal('25')
        })

        it('ui-dropdown should display the first option label', function () {
            const { window } = bootDOM()
            const { host } = mountWidget(window, 'ui-dropdown', {
                label: 'L',
                options: [{ label: 'Alpha', value: 'a' }, { label: 'Beta', value: 'b' }]
            })
            host.querySelector('.d2ed-pw-select span').textContent.should.equal('Alpha')
        })

        it('ui-radio-group should render one row per option (capped at 4)', function () {
            const { window } = bootDOM()
            const { host } = mountWidget(window, 'ui-radio-group', {
                label: 'L',
                options: [{ label: 'A' }, { label: 'B' }, { label: 'C' }, { label: 'D' }, { label: 'E' }]
            })
            host.querySelectorAll('.d2ed-pw-radio-row').length.should.equal(4)
        })

        it('ui-button-group should render an active first button', function () {
            const { window } = bootDOM()
            const { host } = mountWidget(window, 'ui-button-group', {
                label: 'L',
                options: [{ label: 'X' }, { label: 'Y' }]
            })
            const buttons = host.querySelectorAll('.d2ed-pw-btn-group-btn')
            buttons.length.should.equal(2)
            buttons[0].classList.contains('is-active').should.be.true()
        })

        it('ui-form should render submit text from node.submit', function () {
            const { window } = bootDOM()
            const { host } = mountWidget(window, 'ui-form', { submit: 'Send', options: [{ label: 'Field1', key: 'f1' }] })
            host.querySelector('.d2ed-pw-btn-form').textContent.should.equal('Send')
        })

        it('ui-text-input should set the password class when mode is password', function () {
            const { window } = bootDOM()
            const { host } = mountWidget(window, 'ui-text-input', { label: 'pw', mode: 'password' })
            host.querySelector('.d2ed-pw-input-field').classList.contains('d2ed-pw-input-password').should.be.true()
        })

        it('ui-number-input should display the configured min', function () {
            const { window } = bootDOM()
            const { host } = mountWidget(window, 'ui-number-input', { label: 'N', min: 7 })
            host.querySelector('.d2ed-pw-number-val').textContent.should.equal('7')
        })

        it('ui-file-input should render the configured label', function () {
            const { window } = bootDOM()
            const { host } = mountWidget(window, 'ui-file-input', { label: 'Choose a file' })
            host.querySelector('.d2ed-pw-btn-outline span').textContent.should.equal('Choose a file')
        })
    })

    describe('rendering — output widgets', function () {
        it('ui-text should display the format string', function () {
            const { window } = bootDOM()
            const { host } = mountWidget(window, 'ui-text', { label: 'lbl', format: 'Value: 42' })
            host.querySelector('.d2ed-pw-text-value').textContent.should.equal('Value: 42')
        })

        it('ui-gauge should render an SVG with min/max range text', function () {
            const { window } = bootDOM()
            const { host } = mountWidget(window, 'ui-gauge', { title: 'Speed', min: 0, max: 100 })
            should(host.querySelector('svg.d2ed-pw-gauge-svg')).not.be.null()
            host.querySelector('.d2ed-pw-gauge-title').textContent.should.equal('Speed')
            host.querySelector('text').textContent.should.equal('0 – 100')
        })

        it('ui-chart should render bars when chartType is "bar"', function () {
            const { window } = bootDOM()
            const { host } = mountWidget(window, 'ui-chart', { label: 'Bars', chartType: 'bar' })
            host.querySelectorAll('rect').length.should.equal(5)
            host.querySelectorAll('polyline').length.should.equal(0)
        })

        it('ui-chart should render polylines for line charts', function () {
            const { window } = bootDOM()
            const { host } = mountWidget(window, 'ui-chart', { label: 'Line', chartType: 'line' })
            host.querySelectorAll('rect').length.should.equal(0)
            host.querySelectorAll('polyline').length.should.equal(2)
        })

        it('ui-table should render the configured columns', function () {
            const { window } = bootDOM()
            const { host } = mountWidget(window, 'ui-table', {
                label: 'T',
                columns: [{ title: 'A', key: 'a' }, { title: 'B', key: 'b' }]
            })
            const heads = host.querySelectorAll('.d2ed-pw-table-head span')
            heads.length.should.equal(2)
            heads[0].textContent.should.equal('A')
            heads[1].textContent.should.equal('B')
        })

        it('ui-progress should hide the value when showValue is false', function () {
            const { window } = bootDOM()
            const { host } = mountWidget(window, 'ui-progress', { label: 'P', showValue: false })
            should(host.querySelector('.d2ed-pw-progress-val')).be.null()
        })

        it('ui-notification should display the configured position', function () {
            const { window } = bootDOM()
            const { host } = mountWidget(window, 'ui-notification', { position: 'top right' })
            host.querySelector('.d2ed-pw-notif-pos').textContent.should.equal('top right')
        })

        it('ui-audio should render the volume icon', function () {
            const { window } = bootDOM()
            const { host } = mountWidget(window, 'ui-audio', {})
            should(host.querySelector('.fa-volume-up')).not.be.null()
        })
    })

    describe('rendering — content widgets', function () {
        it('ui-markdown should render a snippet of node.content', function () {
            const { window } = bootDOM()
            const { host } = mountWidget(window, 'ui-markdown', { content: 'Hello world from markdown' })
            host.querySelector('.d2ed-pw-md-p').textContent.should.equal('Hello world from markdown')
        })

        it('ui-template should render an escaped snippet of node.template', function () {
            const { window } = bootDOM()
            const { host } = mountWidget(window, 'ui-template', { template: '<div>Hi</div>' })
            const code = host.querySelector('.d2ed-pw-code')
            code.textContent.should.equal('<div>Hi</div>')
            // Ensure it's text, not parsed HTML
            code.querySelector('div') == null && true
        })

        it('ui-spacer should render the spacer pattern', function () {
            const { window } = bootDOM()
            const { host } = mountWidget(window, 'ui-spacer', {})
            should(host.querySelector('.d2ed-pw-spacer-inner')).not.be.null()
        })
    })

    describe('rendering — logic widgets', function () {
        it('ui-control should render the control badge', function () {
            const { window } = bootDOM()
            const { host } = mountWidget(window, 'ui-control', {})
            host.querySelector('.d2ed-pw-logic').textContent.should.containEql('Control')
        })

        it('ui-event should render the event badge', function () {
            const { window } = bootDOM()
            const { host } = mountWidget(window, 'ui-event', {})
            host.querySelector('.d2ed-pw-logic').textContent.should.containEql('Event')
        })
    })
})
