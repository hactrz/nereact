window.nereact = {}

/** @jsx h */
function h(type, props, ...children) {
    return { type, props: props || {}, children }
}

function setBooleanProp($target, name, value) {
    if (value) {
        $target.setAttribute(name, value)
        $target[name] = true
    } else {
        $target[name] = false
    }
}

function removeBooleanProp($target, name) {
    $target.removeAttribute(name)
    $target[name] = false
}

function isEventProp(name) {
    return /^on/.test(name)
}

function extractEventName(name) {
    return name.slice(2).toLowerCase()
}

function isCustomProp(name) {
    return name === 'forceUpdate'
}

function setProp($target, name, value, oldValue) {
    if (isCustomProp(name)) {
        return
    } else if (isEventProp(name)) {
        name = extractEventName(name)
        if (oldValue)
            $target.removeEventListener(name, oldValue)
        $target.addEventListener(name, value)
    } else if (name === 'className') {
        $target.setAttribute('class', value)
    } else if (typeof value === 'boolean') {
        setBooleanProp($target, name, value)
    } else {
        $target.setAttribute(name, value)
    }
}

function removeProp($target, name, value) {
    if (isCustomProp(name)) {
        return
    } else if (isEventProp(name)) {
        $target.removeEventListener(extractEventName(name), value)
    } else if (name === 'className') {
        $target.removeAttribute('class')
    } else if (typeof value === 'boolean') {
        removeBooleanProp($target, name)
    } else {
        $target.removeAttribute(name)
    }
}

function setProps($target, props) {
    Object.keys(props).forEach(name => {
        setProp($target, name, props[name])
    })
}

function updateProp($target, name, newVal, oldVal) {
    if (!newVal) {
        removeProp($target, name, oldVal)
    } else if (!oldVal || newVal !== oldVal) {
        setProp($target, name, newVal, oldVal)
    }
}

function updateProps($target, newProps, oldProps = {}) {
    const props = Object.assign({}, newProps, oldProps)
    Object.keys(props).forEach(name => {
        updateProp($target, name, newProps[name], oldProps[name])
    })
}

function createElement(node) {
    if (node === null || node === false)
        return document.createComment(String(node))
    if (typeof node === 'string' || typeof node === 'number')
        return document.createTextNode(node)
    if (typeof node.type === 'function')
        return createElement(node.type({...node.props, children: node.children}))
    const $el = document.createElement(node.type)
    setProps($el, node.props)
    node.children
        .map(createElement)
        .forEach($el.appendChild.bind($el))
    return $el
}

function changed(node1, node2) {
    return typeof node1 !== typeof node2 ||
        typeof node1 === 'string' && node1 !== node2 ||
        typeof node1.type === 'function' ||
        node1.type !== node2.type ||
        node1.props && node1.props.forceUpdate
}

function updateElement($parent, newNode, oldNode, index = 0) {
    if (typeof newNode === 'number')
        newNode = newNode.toString()
    if (typeof oldNode === 'number')
        oldNode = oldNode.toString()

    if (!oldNode) {
        $parent.appendChild(
            createElement(newNode)
        )
    } else if (!newNode) {
        $parent.removeChild(
            $parent.childNodes[index]
        )
    } else if (changed(newNode, oldNode)) {
        $parent.replaceChild(
            createElement(newNode),
            $parent.childNodes[index]
        )
    }
    else if (newNode.type) {
        updateProps(
            $parent.childNodes[index],
            newNode.props,
            oldNode.props
        )
        const newLength = newNode.children.length
        const oldLength = oldNode.children.length
        for (let i = 0; i < newLength || i < oldLength; i++) {
            updateElement(
                $parent.childNodes[index],
                newNode.children[i],
                oldNode.children[i],
                i
            )
        }
    }
}
