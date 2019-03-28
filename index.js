function h(type, props, ...children) {
    let dom = false
    if (typeof type === 'string') {
        if (type !== 'slot')
            dom = type
        type = makeDOMFunction(type)
    }
    if (typeof type === 'function')
        return { treeMaker: type, dom, props: props || {}, children, source: null, state: null }
    throw TypeError('Element must be either string with dom node name or function')
}

export {h, render, classNames}

function checkVDOMObject(node) {
    return typeOf(node) === 'object' && 'treeMaker' in node && 'props' in node && 'children' in node && 'dom' in node
        && 'source' in node && 'state' in node
}

function classNames () {
    let classes = []

    for (let arg of arguments) {
        if (!arg) continue
        let argType = typeof arg
        if (argType === 'string' || argType === 'number') {
            classes.push(arg)
        } else if (Array.isArray(arg) && arg.length) {
            let inner = classNames.apply(null, arg)
            if (inner) {
                classes.push(inner)
            }
        } else if (argType === 'object') {
            for (let [key, value] of Object.entries(arg)) {
                if (value) {
                    classes.push(key)
                }
            }
        }
    }
    return classes.join(' ')
}

function Slot() {}
const cache = {slot: Slot}

function makeDOMFunction(tagName) {
    if (!(tagName in cache))
        cache[tagName] = function domMaker(props) {
            const $el = document.createElement(tagName)
            setProps($el, props)
            return $el
        }
    return cache[tagName]
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

//type VDOMNode = null | undefined | boolean | string | number | VDOMNodeObject

function isComment(node) {
    return ['null', 'undefined', 'boolean'].includes(typeOf(node))
}

function isString(node) {
    return ['string', 'number'].includes(typeOf(node))
}

function isPrimitive(node) {
    return isComment(node) || isString(node)
}

function makeDOM(nodeObject) {
    if (!nodeObject.dom)
        throw TypeError('Trying to make DOM from non-DOM node')
    return nodeObject.treeMaker(nodeObject.props)
}

function createHTMLElement(node) {
    if (isComment(node))
        return document.createComment(String(node))
    if (isString((node)))
        return document.createTextNode(node)
    if (!checkVDOMObject(node))
        throw TypeError('Wrong vDOM node format')
    const $el = makeDOM(node)
    node.el = $el
    node.children.forEach(c => $el.appendChild(createHTMLElement(c)))
    return $el
}

function typeOf(v) {
    if (v === null)
        return 'null'
    return typeof v
}

function typeChanged(node1, node2) {
    return typeOf(node1) !== typeOf(node2)
        || typeOf(node1) !== 'object' && node1 !== node2
        || node1.dom && node1.treeMaker !== node2.treeMaker
}

function updateElement($parent, newNode, oldNode, index = 0) {
    if (typeOf(newNode) === 'number')
        newNode = newNode.toString()
    if (typeOf(oldNode) === 'number')
        oldNode = oldNode.toString()

    if (oldNode === undefined) {
        $parent.appendChild(
            createHTMLElement(newNode)
        )
    } else if (newNode === undefined) {
        $parent.removeChild(
            $parent.childNodes[index]
        )
    } else if (typeChanged(newNode, oldNode)) {
        $parent.replaceChild(
            createHTMLElement(newNode),
            $parent.childNodes[index]
        )
    }
    else if (newNode.treeMaker) {
        newNode.el = oldNode.el
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

function replaceSlot(node, children) {
    if (isPrimitive(node))
        return node
    if (node.treeMaker === Slot)
        throw Error('Slot can not be root element in component')
    if (node.children.find(n => n.treeMaker === Slot)) {
        if (node.children.length > 1)
            throw Error('Slot must be single child of element')
        node.children = children
        return node
    }
    node.children = node.children.map(c => replaceSlot(c, children))
    return node
}

function makeTree(nodeObject) {
    if (nodeObject.dom)
        return makeDOM(nodeObject)
    return nodeObject.treeMaker(nodeObject.props, nodeObject.state)
}

function openTree(node, prevTree) {
    if (isPrimitive(node))
        return node
    const children = node.children.map((c, i) => openTree(c, prevTree ? prevTree.source.children[i] : undefined))
    if (node.dom)
        return {...node, children}
    if (node.treeMaker === Slot)
        return node
    node.state = (prevTree && prevTree.source.treeMaker === node.treeMaker) ? prevTree.source.state : {
        update(newState) {
            if (newState)
                Object.assign(node.state, newState)
            const newTree = openTree(makeTree(openedTree.source), openedTree)
            const {el} = openedTree
            updateElement(el.parentNode, newTree, openedTree, Array.from(el.parentNode.childNodes).indexOf(el))
            openedTree = newTree
            openedTree.source = node
        }
    }
    const rootNode = makeTree(node)
    let openedTree = openTree(rootNode, prevTree)
    openedTree.source = node
    return replaceSlot(openedTree, children)
}

function render($root, node) {
    updateElement($root, openTree(node))
}
