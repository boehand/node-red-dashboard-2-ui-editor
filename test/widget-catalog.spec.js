'use strict'

const path = require('path')
require('should')

// Load the browser catalog in Node.js by supplying the window global it expects
const savedWindow = global.window
global.window = {}
// Bypass require cache so parallel test runs start clean
delete require.cache[require.resolve('../resources/widget-catalog.js')]
require('../resources/widget-catalog.js')
const { WIDGETS, CATEGORIES } = global.window.D2UIEditorCatalog
global.window = savedWindow

describe('resources/widget-catalog.js', function () {
    describe('CATEGORIES', function () {
        it('should be a non-empty array', function () {
            CATEGORIES.should.be.an.Array().and.not.be.empty()
        })

        it('each category should have an id and a label string', function () {
            CATEGORIES.forEach(cat => {
                cat.should.have.property('id').which.is.a.String().and.not.be.empty()
                cat.should.have.property('label').which.is.a.String().and.not.be.empty()
            })
        })

        it('category ids should be unique', function () {
            const ids = CATEGORIES.map(c => c.id)
            new Set(ids).size.should.equal(ids.length)
        })

        it('should contain the four standard Dashboard 2 categories', function () {
            const ids = CATEGORIES.map(c => c.id)
            ids.should.containEql('input')
            ids.should.containEql('output')
            ids.should.containEql('content')
            ids.should.containEql('logic')
        })
    })

    describe('WIDGETS', function () {
        it('should be a non-empty array', function () {
            WIDGETS.should.be.an.Array().and.not.be.empty()
        })

        it('should contain at least 10 widget definitions', function () {
            WIDGETS.length.should.be.greaterThanOrEqual(10)
        })

        it('each widget should have type, label, category, icon and defaults', function () {
            WIDGETS.forEach(w => {
                w.should.have.property('type').which.is.a.String().and.not.be.empty()
                w.should.have.property('label').which.is.a.String().and.not.be.empty()
                w.should.have.property('category').which.is.a.String().and.not.be.empty()
                w.should.have.property('icon').which.is.a.String().and.not.be.empty()
                w.should.have.property('defaults').which.is.an.Object()
            })
        })

        it('widget types should be unique', function () {
            const types = WIDGETS.map(w => w.type)
            new Set(types).size.should.equal(types.length, 'duplicate widget types found')
        })

        it('every widget type should start with "ui-"', function () {
            WIDGETS.forEach(w => {
                w.type.should.startWith('ui-', `${w.type} does not start with "ui-"`)
            })
        })

        it('each widget category should reference an existing CATEGORY id', function () {
            const validIds = new Set(CATEGORIES.map(c => c.id))
            WIDGETS.forEach(w => {
                validIds.has(w.category).should.be.true(
                    `widget "${w.type}" has unknown category "${w.category}"`
                )
            })
        })

        it('icon values should start with "fa-"', function () {
            WIDGETS.forEach(w => {
                w.icon.should.startWith('fa-', `${w.type} icon "${w.icon}" does not start with "fa-"`)
            })
        })

        it('should include the core Dashboard 2 widget types', function () {
            const types = WIDGETS.map(w => w.type)
            const required = ['ui-button', 'ui-switch', 'ui-slider', 'ui-gauge', 'ui-chart', 'ui-text']
            required.forEach(t => {
                types.should.containEql(t, `missing expected widget type "${t}"`)
            })
        })

        describe('defaults', function () {
            const widgetsWithGrid = WIDGETS.filter(
                w => w.defaults && 'width' in w.defaults && 'height' in w.defaults
            )

            it('grid-enabled widgets should have numeric width, height and order defaults', function () {
                widgetsWithGrid.forEach(w => {
                    // should.js .be.a.Number() does not accept a message arg; use typeof check
                    ;(typeof w.defaults.width).should.equal('number',
                        `${w.type} defaults.width is not a number`)
                    ;(typeof w.defaults.height).should.equal('number',
                        `${w.type} defaults.height is not a number`)
                    w.defaults.should.have.property('order').which.is.a.Number()
                })
            })

            it('width defaults should be 0 (auto-fit) or a positive integer', function () {
                widgetsWithGrid.forEach(w => {
                    w.defaults.width.should.be.greaterThanOrEqual(0)
                })
            })

            it('height defaults should be a non-negative integer (0 is valid for non-visual widgets)', function () {
                widgetsWithGrid.forEach(w => {
                    w.defaults.height.should.be.greaterThanOrEqual(0)
                })
            })
        })

        describe('individual widgets', function () {
            function widget (type) {
                return WIDGETS.find(w => w.type === type)
            }

            it('ui-button should be in the input category', function () {
                widget('ui-button').category.should.equal('input')
            })

            it('ui-gauge should be in the output category', function () {
                widget('ui-gauge').category.should.equal('output')
            })

            it('ui-markdown should be in the content category', function () {
                widget('ui-markdown').category.should.equal('content')
            })

            it('ui-control should be in the logic category', function () {
                widget('ui-control').category.should.equal('logic')
            })

            it('ui-button defaults should include a payload field', function () {
                widget('ui-button').defaults.should.have.property('payload')
            })

            it('ui-gauge defaults should include min and max', function () {
                const g = widget('ui-gauge').defaults
                g.should.have.property('min').which.is.a.Number()
                g.should.have.property('max').which.is.a.Number()
                g.max.should.be.greaterThan(g.min)
            })

            it('ui-slider defaults should include min, max and step', function () {
                const s = widget('ui-slider').defaults
                s.should.have.property('min').which.is.a.Number()
                s.should.have.property('max').which.is.a.Number()
                s.should.have.property('step').which.is.a.Number()
                s.step.should.be.greaterThan(0)
            })

            it('ui-dropdown defaults should include an options array', function () {
                widget('ui-dropdown').defaults.options.should.be.an.Array().and.not.be.empty()
            })

            it('ui-chart defaults height should be > 1 (charts need room)', function () {
                widget('ui-chart').defaults.height.should.be.greaterThan(1)
            })
        })
    })

    describe('D2UIEditorCatalog export', function () {
        it('should expose both WIDGETS and CATEGORIES on window.D2UIEditorCatalog', function () {
            const catalog = { WIDGETS, CATEGORIES }
            catalog.should.have.property('WIDGETS').which.is.an.Array()
            catalog.should.have.property('CATEGORIES').which.is.an.Array()
        })

        it('catalog file path should resolve correctly', function () {
            const resolved = path.resolve(__dirname, '../resources/widget-catalog.js')
            require('fs').existsSync(resolved).should.be.true()
        })
    })
})
