import {h, render, classNames} from './index.js'

function Nav() {
    return h('div', {className: 'nav'},
        h('slot')
    )
}

function Comp(props, state) {
    let {content = 'one'} = state
    return h('div', null,
        h(Nav, null,
            h('a', {
                className: classNames({active: content === 'one'}),
                href: '#',
                onClick: () => state.content = 'one'
            }, 'one'),
            h('a', {
                className: classNames({active: content === 'two'}),
                href: '#',
                onClick: () => state.content = 'two'
            }, 'two'),
            h('a', {
                className: classNames({active: content === 'three'}),
                href: '#',
                onClick: () => state.content = 'three'
            }, 'three'),
            h('a', {
                className: classNames({active: content === 'four'}),
                href: '#',
                onClick: () => state.content = 'four'
            }, 'four'),
        ),
        h('div', {className: 'content'}, content),
    )
}

render(document.getElementById('root'), h(Comp))
