import {render, h, classNames} from './index.js'
import {clear} from "./rethink.js"

import 'https://unpkg.com/mocha/mocha.js'
import 'https://unpkg.com/chai/chai.js'
import 'https://unpkg.com/sinon/pkg/sinon.js'
import 'https://unpkg.com/sinon-chai/lib/sinon-chai.js'

mocha.setup('bdd')
chai.should()

afterEach(function() {
    clear()
})

describe("render", () => {
    it("html tag", () => {
        const el = document.createElement('div')
        const content = h('div', {className: 'test1'})
        render(el, content)
        chai.assert.deepEqual(el.lastElementChild.tagName, 'DIV')
        chai.assert.deepEqual(el.lastElementChild.className, 'test1')
    })
    it("custom component", () => {
        const Div = () => h('div', {className: 'element'},
            h('slot')
        )
        const content = h(Div, null,
            h('div', {className: 'test2'}),
        )
        const el = document.createElement('div')
        render(el, content)
        chai.assert.deepEqual(el.lastElementChild.lastElementChild.tagName, 'DIV')
        chai.assert.deepEqual(el.lastElementChild.lastElementChild.className, 'test2')
    })
    it("called once", () => {
        const el = sinon.spy(() => h('div', {className: 'element'},
            h('slot')))
        const div = document.createElement('div')
        render(div, h(el))
        el.should.have.been.calledOnce
    })
})

describe("state", () => {
    it("not sharing between components", () => {
        let stateOne, stateTwo, state

        function One(props, state) {
            stateOne = state
            return h('div', null)
        }

        const one = sinon.spy(One)

        function Two(props, state) {
            stateTwo = state
            return h('span', null)
        }

        const two = sinon.spy(Two)

        function Comp(props, s) {
            state = s
            return !s.content ? h(one, null) : h(two, null)
        }

        const el = document.createElement('div')
        render(el, h(Comp, {count: 0, content: 'content'}))
        stateOne.asd = 1
        chai.assert.deepEqual(stateOne.asd, 1)
        state.newProp = 1
        chai.assert.deepEqual(stateOne.asd, 1)
        state.content = 'asd'
        chai.assert.deepEqual(stateTwo.asd, undefined)
    })
    it("update has an effect on tree", () => {
        let state
        const Comp = (props, s) => {
            state = s
            return s.content ? h('span', null, 'one') : h('div', null, 'two')
        }
        const el = document.createElement('div')
        render(el, h(Comp))
        chai.assert.deepEqual(el.lastElementChild.tagName, 'DIV')
        state.content = 'two'
        chai.assert.deepEqual(el.lastElementChild.tagName, 'SPAN')
    })
    it("render when state updated", () => {
        let stateOne, stateTwo, state

        function One(props, state) {
            stateOne = state
            return h('div', null)
        }
        const one = sinon.spy(One)

        function Two(props, state) {
            stateTwo = state
            return h('span', null)
        }
        const two = sinon.spy(Two)

        function Comp(props, s) {
            state = s
            return !s.content ? h(one, null) : h(two, null)
        }

        const el = document.createElement('div')
        render(el, h(Comp, {count: 0, content: 'content'}))
        one.should.have.been.calledOnce
        stateOne.asd = 1
        one.should.have.been.calledOnce
        chai.assert.deepEqual(stateOne.asd, 1)
        state.newProp = 1
        one.should.have.been.calledOnce
        chai.assert.deepEqual(stateOne.asd, 1)
        state.content = 'asd'
        one.should.have.been.calledOnce
        two.should.have.been.calledOnce
        chai.assert.deepEqual(stateTwo.asd, undefined)
    })
})

describe("props", () => {
    it("update work", () => {
        let state

        const One = ({green}) => {
            return green ? h('span', null, 'green') : h('div', null, 'red')
        }

        const Comp = (props, s) => {
            const {green = true} = s
            state = s
            return h(One, {green: green})
        }

        const el = document.createElement('div')
        render(el, h(Comp))
        chai.assert.deepEqual(el.lastElementChild.tagName, 'SPAN')
        chai.assert.deepEqual(el.lastElementChild.textContent, 'green')
        state.green = false
        chai.assert.deepEqual(el.lastElementChild.tagName, 'DIV')
        chai.assert.deepEqual(el.lastElementChild.textContent, 'red')
    })
    it("does not update if props did not changed", () => {
        let state
        const one = sinon.spy(({green}) => {
            return green ? h('span', null, 'green') : h('div', null, 'red')
        })

        const Comp = sinon.spy((props, s) => {
            const {green = true} = s
            state = s
            return h(one, {green: green})
        })


        const el = document.createElement('div')
        render(el, h(Comp))
        one.should.have.been.calledOnce
        Comp.should.have.been.calledOnce
        state.green = true
        one.should.have.been.calledOnce
        Comp.should.have.been.calledTwice

    })
    it("render when prop updated", () => {
        let state

        function One({green}) {
            return green ? h('span', null, 'green') : h('div', null, 'red')
        }
        const one = sinon.spy(One)

        const Comp = (props, s) => {
            const {green = true} = s
            state = s
            return h(one, {green: green})
        }

        const el = document.createElement('div')
        render(el, h(Comp))
        one.should.have.been.calledOnce
        state.green = false
        one.should.have.been.calledTwice
    })
})

mocha.run()