import {render, h} from '../index.js'
import {clear, runInAction} from '../rethink.js'

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
    it("update has an effect on tree", () => {
        let state
        const Comp = (props, s) => {
            state = s
            return s.content ? h('span', null, 'one') : h('div', null, 'two')
        }
        const el = document.createElement('div')
        render(el, h(Comp))
        chai.assert.deepEqual(el.childElementCount, 1)
        chai.assert.deepEqual(el.lastElementChild.tagName, 'DIV')
        state.content = 'two'
        chai.assert.deepEqual(el.childElementCount, 1)
        chai.assert.deepEqual(el.lastElementChild.tagName, 'SPAN')
        state.content = ''
        chai.assert.deepEqual(el.childElementCount, 1)
        chai.assert.deepEqual(el.lastElementChild.tagName, 'DIV')
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
        state.newProp = 1
        one.should.have.been.calledOnce
        chai.assert.deepEqual(el.childElementCount, 1)
        chai.assert.deepEqual(el.lastElementChild.tagName, 'DIV')
        state.content = 'asd'
        one.should.have.been.calledOnce
        two.should.have.been.calledOnce
        chai.assert.deepEqual(el.childElementCount, 1)
        chai.assert.deepEqual(el.lastElementChild.tagName, 'SPAN')
        state.content = ''
        one.should.have.been.calledTwice
        chai.assert.deepEqual(el.childElementCount, 1)
        chai.assert.deepEqual(el.lastElementChild.tagName, 'DIV')
    })
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
    it("empty children in component", () => {
        let state
        function Comp(props, s) {
            state = s
            return h('div', null,
                s.content
            )
        }
        const el = document.createElement('div')
        render(el, h(Comp))
        chai.assert.ok(el.lastElementChild)
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
        state.green = true
        one.should.have.been.calledOnce

    })
    it("nested components not update if props did not changed", () => {
        let state

        const two = sinon.spy(function(props, state) {
                return h('span', null)
            }
        )

        const one = sinon.spy(({green}) => {
            return h(two, null, green ? h('span', null, 'green') : h('div', null, 'red'))
        })

        const Comp = sinon.spy((props, s) => {
            const {green = true} = s
            state = s
            return h(one, {green: green})
        })

        const el = document.createElement('div')
        render(el, h(Comp))
        two.should.have.been.calledOnce
        state.green = true
        two.should.have.been.calledOnce

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
        chai.assert.deepEqual(el.lastElementChild.textContent, 'green')
        state.green = false
        one.should.have.been.calledTwice
        chai.assert.deepEqual(el.lastElementChild.textContent, 'red')
    })
    it("children of nested components updates", () => {
        let state
        function Nav() {
            return h('div', null,
                h('slot')
            )
        }
        function Comp(props, s) {
            let {content = 'one'} = s
            state = s
            return h('div', null,
                h(Nav, null,
                    h('div', null, content),
                ),
            )
        }
        const el = document.createElement('div')
        render(el, h(Comp))
        chai.assert.deepEqual(el.lastElementChild.textContent, 'one')
        state.content = 'two'
        chai.assert.deepEqual(el.lastElementChild.textContent, 'two')

    })
    it("children prop updated", () => {
        let cb, stateOne
        function Todo(props, state) {
            let {title} = props
            let {edit = false} = state
            stateOne = state

            cb = function onSave(text) {
                props.onEdit(text)
                state.edit = false
            }

            return h('span', null, edit ? h('div', null, title) : h('span', null, title))
        }

        function TodoList(props, state) {
            if (!state.todo)
                state.todo = '1'

            console.log(state.todo)
            return h(Todo, {title: state.todo, onEdit: text => state.todo = text})
        }
        const el = document.getElementById('tests')
        render(el, h(TodoList))
        stateOne.edit = true
        cb('2')
        chai.assert.deepEqual(el.lastElementChild.textContent, '2')
        stateOne.edit = true
        cb('3')
        chai.assert.deepEqual(el.lastElementChild.textContent, '3')
    })
})

describe("unmount", () => {
    it("component", () => {
        let state
        const el = document.createElement('div')
        const cb = sinon.spy()
        function One(props, state) {
            if (!state.unmount)
                state.unmount = cb
            return h('div', null, 'one')
        }
        const one = sinon.spy(One)

        function Comp(props, s) {
            state = s
            return !s.content && h(one, null)
        }
        render(el, h(Comp, null))
        chai.assert.deepEqual(el.lastElementChild.tagName, 'DIV')
        state.content = 'two'
        cb.should.have.been.calledOnce
    })
    it("child components", () => {
        let state, stateOne
        const el = document.createElement('div')
        const cb = sinon.spy()
        const cbOne = sinon.spy()
        function One(props, state) {
            if (!state.unmount)
                state.unmount = cbOne
            return h('div', null, h('slot'))
        }
        const one = sinon.spy(One)

        function Two(props, state) {
            if (!state.unmount)
                state.unmount = cb
            return h('span', null, 'two')
        }
        const two = sinon.spy(Two)

        function Comp(props, s) {
            state = s
            return !s.content && h(one, null,
                h(two, null),
            )
        }
        render(el, h(Comp, null))
        chai.assert.deepEqual(el.lastElementChild.tagName, 'DIV')
        chai.assert.deepEqual(el.lastElementChild.lastElementChild.tagName, 'SPAN')
        state.content = 'two'
        cbOne.should.have.been.calledOnce
        cb.should.have.been.calledOnce
    })
    it("changed children length", () => {
        const el = document.createElement('div')
        const cb = sinon.spy()
        function One(props, state) {
            if (!state.unmount)
                state.unmount = cb
            return h('div', null)
        }
        const one = sinon.spy(One)

        let state
        function Comp(props, s) {
            state = s
            const child = state.content ? [] : [h(one, null)]
            return h('div', null, ...child)
        }
        render(el, h(Comp, null))
        state.content = 'three'
        cb.should.have.been.calledOnce
    })
    it("component not unmounted", () => {
        let state
        const cb = sinon.spy()

        function One({green}, state) {
            if (!state.unmount)
                state.unmount = cb
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
        chai.assert.deepEqual(el.lastElementChild.tagName, 'SPAN')
        chai.assert.deepEqual(el.lastElementChild.textContent, 'green')
        state.green = false
        chai.assert.deepEqual(el.lastElementChild.tagName, 'DIV')
        chai.assert.deepEqual(el.lastElementChild.textContent, 'red')
        one.should.have.been.calledTwice
        cb.should.have.been.callCount(0)
    })
    it("props", () => {
        let state
        const el = document.createElement('div')
        const cb = sinon.spy()
        function One(props, state) {
            let {title} = props
            if (!state.unmount)
                state.unmount = cb
            return h('div', null, title)
        }
        const one = sinon.spy(One)

        function Comp(props, s) {
            if (!s.todosList) {
                s.todosList = [
                    {id: 0, title: 'Дело раз'},
                    {id: 1, title: 'Дело два'},
                    {id: 2, title: 'Дело три'}
                ]
            }
            state = s
            return h('div', {className: 'todo-wrap'}, ...s.todosList.map(todo => h(one, {title: todo.title})))
        }

        render(el, h(Comp, null))
        chai.assert.deepEqual(el.lastElementChild.className, 'todo-wrap')
        state.todosList.splice(2, 1)
        one.should.have.been.callCount(3)
        cb.should.have.been.calledOnce
    })
})

mocha.run()