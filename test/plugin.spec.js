'use strict'

const sinon = require('sinon')
require('should')
require('should-sinon')

function freshPlugin () {
    delete require.cache[require.resolve('../lib/ui-editor.js')]
    return require('../lib/ui-editor.js')
}

function buildRED () {
    return {
        plugins: {
            registerPlugin: sinon.stub()
        },
        log: {
            info: sinon.stub()
        }
    }
}

describe('lib/ui-editor.js', function () {
    describe('module shape', function () {
        it('should export a function', function () {
            freshPlugin().should.be.a.Function()
        })
    })

    describe('plugin registration', function () {
        let RED

        beforeEach(function () {
            RED = buildRED()
            freshPlugin()(RED)
        })

        it('should call RED.plugins.registerPlugin exactly once', function () {
            RED.plugins.registerPlugin.should.be.calledOnce()
        })

        it('should register with the id "dashboard-2-ui-editor"', function () {
            const id = RED.plugins.registerPlugin.getCall(0).args[0]
            id.should.equal('dashboard-2-ui-editor')
        })

        it('plugin definition should be an object', function () {
            const def = RED.plugins.registerPlugin.getCall(0).args[1]
            def.should.be.an.Object()
        })

        it('plugin definition should have type "editor-plugin"', function () {
            const def = RED.plugins.registerPlugin.getCall(0).args[1]
            def.should.have.property('type', 'editor-plugin')
        })

        it('plugin definition should have an onadd function', function () {
            const def = RED.plugins.registerPlugin.getCall(0).args[1]
            def.should.have.property('onadd').which.is.a.Function()
        })
    })

    describe('onadd callback', function () {
        let RED

        beforeEach(function () {
            RED = buildRED()
            freshPlugin()(RED)
        })

        it('should call RED.log.info when onadd is invoked', function () {
            const def = RED.plugins.registerPlugin.getCall(0).args[1]
            def.onadd()
            RED.log.info.should.be.calledOnce()
        })

        it('should log a message that mentions the plugin name', function () {
            const def = RED.plugins.registerPlugin.getCall(0).args[1]
            def.onadd()
            const msg = RED.log.info.getCall(0).args[0]
            msg.should.match(/dashboard-2-ui-editor/)
        })
    })
})
