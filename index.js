import {areEqualShallow, object, reaction} from './rethink.js'

function h(type, props, ...children) {
    let dom = false
    if (typeof type === 'string') {
        if (type !== 'slot')
            dom = type
        type = makeDOMFunction(type)
    }
    if (typeof type === 'function')
        return { treeMaker: type, dom, props: props || {}, children, state: null }
    throw TypeError('Element must be either string with dom node name or function')
}

export {h, render, classNames}

function checkVDOMObject(node) {
    return typeOf(node) === 'object' && 'treeMaker' in node && 'props' in node && 'children' in node && 'dom' in node
        && 'state' in node
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

function createHTMLElement(node) {
    if (isComment(node))
        return document.createComment(String(node))
    if (isString((node)))
        return document.createTextNode(node)
    if (!checkVDOMObject(node))
        throw TypeError('Wrong vDOM node format')
    if (!node.dom)
        throw TypeError('Trying to make DOM from non-DOM node')
    const $el = node.treeMaker(node.props)
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

function start(node, prevNode, children) {
    function onUpdate(nestedTree) {
        let flatTree = connectChildrenToSlot(flatTreeFromNode(nestedTree, prevNode && prevNode.nestedTree), children)
        if (prevNode)
            updateFlatTree(flatTree, prevNode.flatTree)
        node.nestedTree = nestedTree
        node.flatTree = flatTree
        prevNode = node
    }

    const s = reaction(() => node.treeMaker(node.props, node.state), onUpdate, {fireImmediately: true})
    node.stop = function stop(unmount=true) {
        s()
        if (unmount && typeof node.state.unmount === 'function')
            node.state.unmount()
    }
}

function unmount(node) {
    if (!node)
        return
    for (let child of (node.children || [])) {
        if (child && child.stop)
            unmount(child)
    }
    if (node && node.stop)
        node.stop()
}

function flatTreeFromComponent(node, prevNode, children) {
    if (node.dom)
        throw TypeError('Cannot make tree from DOM virtual node')

    const sameComp = prevNode && prevNode.treeMaker === node.treeMaker
    if (sameComp) {
        node.state = prevNode.state
        if (!areEqualShallow(node.props, prevNode.props)) {
            prevNode.stop(false)
            start(node, prevNode, children)
        } else {
            node.nestedTree = prevNode.nestedTree
            node.flatTree = connectChildrenToSlot(flatTreeFromNode(node.nestedTree, prevNode.nestedTree), children)
        }
    }
    else {
        node.state = object({})
        start(node, prevNode, children)
    }
    return node.flatTree
}

function flatTreeFromNode(node, prevNode) {
    //destroy prev state and call unmount if node type changes
    if (checkVDOMObject(prevNode) && (!checkVDOMObject(node) || node.treeMaker !== prevNode.treeMaker))
        unmount(prevNode)
    if (isPrimitive(node) || node.treeMaker === Slot)
        return node
    const children = node.children.map((c, i) => flatTreeFromNode(c, prevNode && prevNode.children[i]))
    if (checkVDOMObject(prevNode)) {
        for (let i = node.children.length; i < prevNode.children.length; i++) {
            unmount(prevNode.children[i])
        }
    }
    if (node.dom)
        return {...node, children}

    return flatTreeFromComponent(node, prevNode, children)
}

function connectChildrenToSlot(flatTree, children) {
    if (isPrimitive(flatTree))
        return flatTree
    if (flatTree.treeMaker === Slot)
        throw Error('Slot can not be root element in component')
    if (flatTree.children.find(n => checkVDOMObject(n) && n.treeMaker === Slot)) {
        if (flatTree.children.length > 1)
            throw Error('Slot must be single child of element')
        flatTree.children = children
        return flatTree
    }
    flatTree.children = flatTree.children.map(c => connectChildrenToSlot(c, children))
    return flatTree
}

function updateFlatTree(tree, prevTree) {
    if (tree.el)
        return
    const {el} = prevTree
    updateElement(el.parentNode, tree, prevTree, Array.from(el.parentNode.childNodes).indexOf(el))
}

function render($root, node) {
    updateElement($root, flatTreeFromNode(node))
}
