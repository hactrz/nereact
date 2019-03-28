import {h, render, classNames} from './index.js'
import {box, autorun, decorate, object} from './rethink.js'
/*const fn = observable('a')
const r = reaction(() => fn.get().toUpperCase(), FN => console.log(FN))
when(() => fn.get() === 'c', () => console.log('!!'))
observe(fn, (res) => console.log('observe', res))
fn.set('b')
fn.set('c')
fn.set('d')
fn.set('D')
fn.set('c')
r()*/
//when(()=>true, ()=>console.log(1))

function print(a) {
    console.log(JSON.stringify(a, null, 2))
}
const Div = () => h('div', null,
    h('slot')
)

const Nav = () => h('div', {className: 'nav'},
    h('slot')
)

const Comp = (props, {content = '', update}) => {
    return h(Div, null,
        h(Nav, null,
            h('a', {
                className: classNames('one', {active: content === 'one'}),
                href: '#',
                onClick: () => update({content: 'one'})
            }, 'one'),
            h('a', {
                className: classNames('two', {active: content === 'two'}),
                href: '#',
                onClick: () => update({content: 'two'})
            }, 'two'),
            h('a', {
                className: classNames('three', {active: content === 'three'}),
                href: '#',
                onClick: () => update({content: 'three'})
            }, 'three'),
            h('a', {
                className: classNames('four', {active: content === 'four'}),
                href: '#',
                onClick: () => update({content: 'four'})
            }, 'four'),
        ),
        h('div', {className: 'content'}, content),
    );
}

render(document.getElementById('root'), h(Comp, {count: 0}))

class Person {
    name = "John"
    age = 42
    showAge = false

    constructor() {
        decorate(this, {
            name: box,
            age: box,
            showAge: box,
        })
    }

    get labelText() {
        return this.showAge ? `${this.name} (age: ${this.age})` : this.name
    }
}

// const p = new Person()
// autorun(()=> console.log(p.labelText))
// p.name = 'Test'
// p.showAge = true

// const a = array(['z', 2, 5])
// autorun(()=> console.log(a.toString()))
// a.push('a')
// a.push('b')
// a.push('C')
// a[10] = '1'

const o = object({test: [1,2,3], o1: {dog1: 'Jim', dog2: 'Bark'}, o2: 'cat'})
autorun(()=> print(o))
o['A'] = 'a'
o['B'] = 'b'
o['C'] = 'c'
o[0] = '1'
o.test = '1234567'
o.o1.dog1 = 'Name'
o.o1 = [1, 5, 7]
o.o1[1] = 'z'
