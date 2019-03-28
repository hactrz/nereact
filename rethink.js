let CurrentObserver = null
let PendingCells = new Set()

const $s = Symbol('observable')

class Cell {
    [$s] = true
    reactions = new Set()
    dependencies = new Set()

    constructor(value, fn = null, active = false) {
        this.value = value
        this.fn = fn
        this.state = fn ? "dirty" : "actual"
        this.active = active
    }

    mark(dirty = false) {
        this.state = dirty ? "dirty" : "check"
        for (const reaction of this.reactions) {
            if (reaction.state === "actual") reaction.mark()
        }
        if (this.active)
            PendingCells.add(this)
    }

    set(newValue) {
        if (newValue === this.value)
            return false

        this.value = newValue
        for (const reaction of this.reactions) {
            reaction.mark(true)
        }
        runPendingCells()
        return true
    }

    run() {
        if (!this.fn) return
        const currentObserver = CurrentObserver
        CurrentObserver = this
        const oldDependencies = this.dependencies
        this.dependencies = new Set()
        const newValue = this.fn()
        CurrentObserver = currentObserver
        for (const dep of oldDependencies) {
            if (!this.dependencies.has(dep)) dep.reactions.delete(this)
        }
        this.state = "actual"
        return this.set(newValue)
    }

    actualize() {
        if (this.state === "check") {
            for (const dep of this.dependencies) {
                if (this.state === "dirty") break
                dep.actualize()
            }
            if (this.state === "dirty") {
                this.run()
            } else {
                this.state = "actual"
            }
        } else if (this.state === "dirty") {
            this.run()
        }
    }

    get() {
        if (this.state !== "actual") this.actualize()
        if (CurrentObserver) {
            this.reactions.add(CurrentObserver)
            CurrentObserver.dependencies.add(this)
        }
        return this.value
    }

    unsubscribe() {
        for (const dep of this.dependencies) {
            dep.reactions.delete(this)
            if (dep.reactions.size === 0) dep.unsubscribe()
        }
        this.state = "dirty"
        if (this.active)
            PendingCells.delete(this)
    }
}

function runPendingCells() {
    for (const cell of PendingCells) {
        cell.actualize()
    }
}

export function box(value) {
    return new Cell(value)
}

export function computed(fn) {
    return new Cell(null, fn)
}

export function autorun(fn) {
    const cell = new Cell(null, fn, true)
    cell.get()
    return () => cell.unsubscribe()
}

export function reaction(fn, effect, {fireImmediately=false} = {}) {
    return observe(computed(fn), effect, {fireImmediately})
}

export function when(fn, effect) {
    let immediate = true
    const stop = whenever(fn, () => {
        effect()
        if (!immediate)
            stop()
        immediate = false
    })
    if (!immediate)
        stop()
    return stop
}

export function whenever(fn, effect) {
    return reaction(fn, res => res && effect(), {fireImmediately: true})
}

export function observe(cell, cb, {fireImmediately=false} = {}) {
    return autorun(() => {
        const res = cell.get()
        if(fireImmediately)
            cb(res)
        else
            fireImmediately = true
    })
}

export function decorate(object, decorator) {
    for (let [key, value] of Object.entries(decorator))  {
        let cell = value(object[key])
        Object.defineProperty(object, key, {
            get() { return cell.get() },
            set(newValue) { cell.set(newValue) },
            enumerable: true,
            configurable: true
        })
    }
}

export function array(arr) {
    if (!Array.isArray(arr))
        throw TypeError('Argument must be an array')
    if (isObservableObject(arr))
        return arr
    let map = new Map(arr.map((v, i) => [String(i), observable(v)]))
    map.set('length', observable(arr.length))
    arr[$s] = true
    return new Proxy(arr, {
        get(target, prop) {
            const res = map.get(prop)
            return res ? res.get() : target[prop]
        },
        set(target, prop, value, self) {
            if (isObject(value))
                value = object(value)
            target[prop] = value
            if(map.has(prop))
                map.get(prop).set(value)
            else
                map.set(prop, box(value))
            if (self.length !== target.length)
                self.length = target.length
            return true
        },
        has(target, prop) {
            if (prop === $s)
                return true
            return prop in target
        }
    })
}

export function object(obj) {
    if (typeof obj !== 'object' || obj === null)
        throw TypeError('Argument must be an object')
    if (isObservableObject(obj))
        return obj
    if (Array.isArray(obj))
        return array(obj)
    let map = new Map(Object.entries(obj).map(([k, v]) => [k, observable(v)]))
    let dump = observable(false)
    return new Proxy(obj, {
        get(target, prop) {
            const res = map.get(prop)
            return res ? res.get() : target[prop]
        },
        set(target, prop, value) {
            if (isObject(value))
                value = object(value)
            target[prop] = value
            if(map.has(prop))
                map.get(prop).set(value)
            else {
                map.set(prop, box(value))
                dump.set(!dump.get())
            }
            return true
        },
        ownKeys(target) {
            dump.get()
            return Reflect.ownKeys(target)
        },
        has(target, prop) {
            if (prop === $s)
                return true
            return prop in target
        }
    })
}

function observable(value) {
    if (isObject(value))
        return box(object(value))
    return box(value)
}

function isObject(o) {
    return typeof o === 'object' && o !== null
}

function isObservableObject(o) {
    return isObject(o) && ($s in o)
}
