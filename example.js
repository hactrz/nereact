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

function NewTodo(props, state) {
    if (!state.title)
        state.title = ''
    let {onNew} = props
    let {title} = state
    return h('div', null,
        h('label', {for: 'new-todo'}, 'Добавить задачу'),
        h('input', {
            id: 'new-todo', value: title,
            onChange: (e) => state.title = e.target.value
        }),
        h('button', {
            onClick: () => {
                onNew(title)
                state.title = ''
                document.getElementById('new-todo').value = ''
            }
        }, 'Добавить')
    )
}

function Todo(props, state) {
    if (!state.edit)
        state.edit = false
    let {edit, todo} = state
    let {title, onDelete} = props

    function onEdit() {
        props.onEdit(state.todo)
        state.edit = false
        state.todo = undefined
    }
    console.log(title)
    return h('div', null,
        edit
            ? h('input', {value: todo === undefined ? title : todo, onChange: (e) => state.todo = e.target.value})
            : h('span', null, title),
        h('button', {onClick: edit ? onEdit : () => state.edit = true}, edit ? 'Сохранить' : 'Редактировать'),
        onDelete && h('button', {onClick: onDelete}, 'Удалить')
    )
}

function TodoList(props, state) {
    if (!state.todosList) {
        state.todosList = [
            {id: 0, title: 'Дело раз'},
            {id: 1, title: 'Дело два'},
            {id: 2, title: 'Дело три'}
        ]
    }
    let {todosList} = state

    function onNew(title) {
        let newTodoId = todosList.length > 0 ? Math.max(...todosList.map(t => t.id)) + 1 : 0
        state.todosList.push({id: newTodoId, title: title})
    }

    function onDelete(id) {
        const index = state.todosList.findIndex(t => t.id === id)
        if (index > -1)
            state.todosList.splice(index, 1)
    }

    function onEdit(id, title) {
        const index = state.todosList.findIndex(t => t.id === id)
        if (index > -1) {
            state.todosList[index].title = title
        }
    }

    return h('div', null,
        h(NewTodo, {onNew: onNew}),
        ...todosList.map(todo =>
            h('div', {className: 'todo-wrap'},
                h('span', null, todo.id),
                h('span', null, todo.title),
                h(Todo, {
                    title: todo.title,
                    onDelete: () => onDelete(todo.id),
                    onEdit: (text) => onEdit(todo.id, text)
                })
            )
        )
    )
}

render(document.getElementById('root'), h(TodoList))
