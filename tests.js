import {box, computed, autorun, reaction, observe, whenever, when} from './rethink.js'

import 'https://unpkg.com/mocha/mocha.js'
import 'https://unpkg.com/chai/chai.js'
import 'https://unpkg.com/sinon/pkg/sinon.js'
import 'https://unpkg.com/sinon-chai/lib/sinon-chai.js'

mocha.setup('bdd')
chai.should()

describe("box", () => {
    it("get && set working", () => {
        let o = box()
        chai.assert.isUndefined(o.get())
        o.set('test')
        chai.assert.deepEqual(o.get(), 'test')
        o.set(1)
        chai.assert.notDeepEqual(o.get(), 'test')
    })
})

describe("computed", () => {
    it("working", () => {
        let o = box('cat')
        const c = computed(()=> o.get().toUpperCase())
        chai.assert.deepEqual(c.get(), 'CAT')
        o.set('dog')
        chai.assert.deepEqual(c.get(), 'DOG')
    })
    it("lazy by default", () => {
        let o = box('cat')
        let cb = sinon.spy(()=> o.get().toUpperCase())
        const c = computed(cb)
        cb.should.have.been.callCount(0)
        c.get()
        cb.should.have.been.calledOnce
        c.get()
        cb.should.have.been.calledOnce
        o.set('dog')
        cb.should.have.been.calledOnce
        c.get()
        cb.should.have.been.calledTwice
    })
    it("not lazy when observed", () => {
        let o = box('cat')
        let cb = sinon.spy(()=> o.get())
        const c = computed(cb)
        autorun(() => c.get())
        cb.should.have.been.calledOnce
        o.set('dog')
        cb.should.have.been.calledTwice
    })
})

describe("autorun", () => {
    it("function was called exactly once", () => {
        let cb = sinon.spy()
        autorun(cb)
        cb.should.have.been.calledOnce
    })
    it("not lazy", () => {
        let o = box('cat')
        let cb = sinon.spy(()=> o.get())
        autorun(cb)
        cb.should.have.been.calledOnce
        o.set('dog')
        cb.should.have.been.calledTwice
    })
    it("called once", () => {
        let o = box('cat')
        let cb = sinon.spy(()=> o.get())
        const stop = autorun(cb)
        cb.should.have.been.calledOnce
        stop()
        o.set('dog')
        cb.should.have.been.calledOnce
    })
})

describe("reaction", () => {
    it("cb was called exactly once", () => {
        const o = box('John')
        let cb = sinon.spy()
        reaction(() => o.get(), cb)
        o.set('hey')
        cb.calledWith('hey')
        cb.should.have.been.calledOnce
    })
    it("works with fireImmediately", () => {
        const o = box('John')
        let cb = sinon.spy()
        reaction(() => o.get(), cb, {fireImmediately: true})
        cb.calledWith('John')
        o.set('hey')
        cb.calledWith('hey')
        cb.should.have.been.calledTwice
    })
})

describe("whenever", () => {
    it("whenever", () => {
        let cb = sinon.spy()
        let o = box(true)
        whenever(() => o.get(), cb)
        cb.should.have.been.calledOnce
        o.set(false)
        cb.should.have.been.calledOnce
        o.set(true)
        cb.should.have.been.calledTwice
    })
})

describe("when", () => {
    it("when", () => {
        let cb = sinon.spy()
        let o = box(true)
        when(() => o.get(), cb)
        cb.should.have.been.calledOnce
        o.set(false)
        cb.should.have.been.calledOnce
        o.set(true)
        cb.should.have.been.calledOnce
    })
})

describe("observe", () => {
    it("observe box", () => {
        const o = box('John')
        let cb = sinon.spy()
        observe(o, cb)
        o.set('hey')
        cb.should.have.been.calledOnce
        cb.should.have.been.calledWith('hey')
    })
    it("observe computed", () => {
        const o = box('hey')
        let cb = sinon.spy()
        const c = computed(()=> o.get().toUpperCase())
        observe(c, cb)
        o.set('test')
        cb.should.have.been.calledOnce
        cb.should.have.been.calledWith('TEST')
    })
    it("works with fireImmediately", () => {
        const o = box('hey')
        let cb = sinon.spy()
        observe(o, cb, {fireImmediately: true})
        cb.should.have.been.calledWith('hey')
        o.set('test')
        cb.should.have.been.calledTwice
        cb.should.have.been.calledWith('test')
    })
})

mocha.run()