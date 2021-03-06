import {
    box, computed, autorun, reaction, observe, whenever, when, array, object, decorate, observeObject, clear, runInAction
} from '../rethink.js'

import 'https://unpkg.com/mocha/mocha.js'
import 'https://unpkg.com/chai/chai.js'
import 'https://unpkg.com/sinon/pkg/sinon.js'
import 'https://unpkg.com/sinon-chai/lib/sinon-chai.js'

mocha.setup('bdd')
chai.should()

afterEach(function() {
    clear()
})

describe("box", () => {
    it("get && set work", () => {
        let o = box()
        chai.assert.isUndefined(o.get())
        o.set('test')
        chai.assert.deepEqual(o.get(), 'test')
        o.set(1)
        chai.assert.notDeepEqual(o.get(), 'test')
    })
    it("observable value has not changed", () => {
        let o = box('test')
        let cb = sinon.spy()
        reaction(() => o.get(), cb)
        o.set('test')
        cb.should.have.been.callCount(0)
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
    it("function was active exactly once", () => {
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
        o.set('asd')
        cb.should.have.been.calledThrice
    })
    it("stop works", () => {
        let o = box('cat')
        let cb = sinon.spy(()=> o.get())
        const stop = autorun(cb)
        cb.should.have.been.calledOnce
        stop()
        o.set('dog')
        cb.should.have.been.calledOnce
    })
    it("detect cycles", () => {
        let o = box(1)
        chai.assert.deepEqual(o.get(), 1)
        const stop = autorun(() => {
            if (o.get() > 1)
                o.set(o.get()+1)
        })
        let ex = false
        try {
            o.set(2)
        } catch (e) {
            ex = true
            chai.assert.include(e.message, 'Cycle')
        }
        stop()
        chai.assert.isOk(ex)
    })
    it("autorun trigger himself", () => {
        let o = box(1)
        let cb = sinon.spy(() => o.get() && o.set(2))
        autorun(cb)
        cb.should.have.been.calledTwice
    })
    it("autorun active autorun", () => {
        let o = box(1)
        let inCb = sinon.spy(() => o.set(2))
        let cb = sinon.spy(() => o.get() && autorun(inCb))
        autorun(cb)
        cb.should.have.been.calledTwice
        inCb.should.have.been.calledTwice
    })
})

describe("reaction", () => {
    it("works", () => {
        const o = box('John')
        const r = sinon.spy(() => o.get())
        let cb = sinon.spy()
        const stop = reaction(r, cb)
        r.should.have.been.calledOnce
        o.set('hey')
        r.should.have.been.calledTwice
        cb.calledWith('hey')
        cb.should.have.been.calledOnce
        o.set('asd')
        cb.calledWith('asd')
        cb.should.have.been.calledTwice
        stop()
        o.set('q')
        cb.should.have.been.calledTwice
    })
    it("works with fireImmediately", () => {
        const o = box('John')
        let cb = sinon.spy()
        const r = sinon.spy(() => o.get())
        reaction(r, cb, {fireImmediately: true})
        r.should.have.been.calledOnce
        cb.calledWith('John')
        o.set('hey')
        r.should.have.been.calledTwice
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

describe("array", () => {
    it("shallow observable works", () => {
        const a = array(['z', {name: 'Jim'}, [1, {test: 'Test'}, 7]])
        let cb = sinon.spy()
        reaction(() => a[0], cb)
        a[0] = 'test'
        cb.should.have.been.calledOnce
        chai.assert.deepEqual(a[0], 'test')
        reaction(() => a[1], cb)
        a[1] = {test: 'Test'}
        cb.should.have.been.calledTwice
        chai.assert.deepEqual(a[1], {test: 'Test'})
        reaction(() => a[2], cb)
        a[2] = [1,'b',7]
        cb.should.have.been.callCount(3)
        chai.assert.deepEqual(a[2], [1,'b',7])
    })
    it("deep observable works", () => {
        const a = array(['z', {name: 'Jim'}, 5])
        let cb = sinon.spy()
        reaction(() => a[1].name, cb)
        a[1].name = 'Hey'
        cb.should.have.been.calledOnce
        a[1] = {name: 'Test'}
        cb.should.have.been.calledTwice
    })
    it("length is observable", () => {
        const a = array(['z', 2, 5, 7])
        let cb = sinon.spy()
        reaction(() => a.length, cb)
        a.push('test')
        chai.assert.deepEqual(a.length, 5)
        a.pop()
        chai.assert.deepEqual(a.length, 4)
        a.splice(0, 2, 'test')
        chai.assert.deepEqual(a.length, 3)
        chai.assert.deepEqual(a, ['test', 5, 7])
        cb.should.have.been.callCount(3)
    })
    it("delete work", () => {
        const a = array(['z', 2, 5])
        let cb = sinon.spy()
        reaction(() => a[2], cb)
        a.pop()
        cb.should.have.been.calledOnce
        a.push(3)
        cb.should.have.been.calledTwice
    })
    it("splice", () => {
        const a = array([{id: 1, content: 'one'}, {id: 2, content: 'two'}, {id: 3, content: 'three'}])
        let cb = sinon.spy()
        reaction(() => a.map(e => e), cb)
        a.splice(2, 1)
        cb.should.have.been.calledOnce
    })
})

describe("object", () => {
    it("shallow observable works", () => {
        const a = object({test: [1,2,3], o1: {dog1: 'Jim', dog2: 'Bark'}, o2: 'cat'})
        let cb = sinon.spy()
        reaction(() => a.test, cb)
        a.test = 'test'
        reaction(() => a.o2, cb)
        a.o2 = 'cat'
        cb.should.have.been.calledOnce
    })
    it("deep observable works", () => {
        const a = object({test: [1,2,3], o1: {dog1: 'Jim', dog2: 'Bark'}, o2: 'cat'})
        let cb = sinon.spy()
        reaction(() => a.o1.dog1, cb)
        a.o1.dog1 = 'test'
        reaction(() => a.test[1], cb)
        a.test[1] = 'test'
        cb.should.have.been.calledTwice
    })
    it("delete work", () => {
        const a = object({test: [1,2,3], o1: {dog1: 'Jim', dog2: 'Bark'}, o2: 'cat'})
        let cb = sinon.spy()
        reaction(() => a.test, cb)
        delete a.test
        a.test = 'z'
        cb.should.have.been.calledTwice
    })
    it("new prop is observable", () => {
        const a = object({})
        let cb = sinon.spy()
        reaction(() => a.test, cb)
        a.test = 'z'
        cb.should.have.been.calledOnce
    })
})

describe("decorate", () => {
    it("work", () => {
        const person = {
            name: "John",
            age: 42,
            showAge: false,

            get labelText() {
                return this.showAge ? `${this.name} (age: ${this.age})` : this.name
            }
        }
        decorate(person, {name: box, age: box, showAge: box})
        let cb = sinon.spy()
        reaction(() => person.labelText, cb)
        person.showAge = true
        cb.should.have.been.calledOnce
    })
})

describe("observeObject", () => {
    it("works", () => {
        const o = object({})
        let cb = sinon.spy()
        const stop = observeObject(o, cb)
        o.hey = 1
        cb.should.have.been.calledOnce
        o.hey = 2
        cb.should.have.been.calledTwice
        stop()
        o.hey = 3
        cb.should.have.been.calledTwice
    })
})

describe("runInAction", () => {
    it("works", () => {
        let o = box('cat')
        let cb = sinon.spy(()=> o.get())
        autorun(cb)
        cb.should.have.been.calledOnce
        runInAction(() => {
            o.set('dog')
            cb.should.have.been.calledOnce
            o.set('asd')
            cb.should.have.been.calledOnce
        })
        cb.should.have.been.calledTwice
    })
})

mocha.run()