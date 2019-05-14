let CurrentObserver = null

const $s = Symbol('observable')

class Cell {
    static Pending = new Set()
    static runPending() {
        if (Cell.runPending.active)
            return
        let count = 0
        do {
            Cell.runPending.active = true
            for (const cell of Array.from(Cell.Pending))
                cell.actualize()
            Cell.runPending.active = false
            count++
            if (count >= 100)
                throw new Error('Cycle dependencies!')
        } while (Array.from(Cell.Pending).filter(c => c.state !== 'actual').length)
    }

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
            if (reaction.state === "actual")
                reaction.mark()
        }
        if (this.active)
            Cell.Pending.add(this)
    }

    set(newValue) {
        if (newValue === this.value)
            return false

        this.value = newValue
        for (const reaction of this.reactions) {
            reaction.mark(true)
        }
        Cell.runPending()
        return true
    }

    run() {
        if (!this.fn) return
        const currentObserver = CurrentObserver
        CurrentObserver = this
        const oldDependencies = this.dependencies
        this.dependencies = new Set()
        this.state = "actual"
        let newValue
        try {
            newValue = this.fn()
        } catch (e) {
            console.error('Exception in', this.fn)
            console.error(e)
        }
        CurrentObserver = currentObserver
        for (const dep of oldDependencies) {
            if (!this.dependencies.has(dep))
                dep.reactions.delete(this)
        }
        this.set(newValue)
    }

    actualize() {
        if (this.state === "check") {
            for (const dep of this.dependencies) {
                if (this.state === "dirty")
                    break
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
        if (this.state !== "actual")
            this.actualize()
        if (CurrentObserver) {
            this.reactions.add(CurrentObserver)
            CurrentObserver.dependencies.add(this)
        }
        return this.value
    }

    unsubscribe() {
        for (const dep of this.dependencies) {
            dep.reactions.delete(this)
            if (dep.reactions.size === 0)
                dep.unsubscribe()
        }
        this.state = "dirty"
        if (this.active)
            Cell.Pending.delete(this)
    }
}

function observableInterface(cell) {
    return {
        get: cell.get.bind(cell),
        set: cell.set.bind(cell),
    }
}

function computedInterface(cell) {
    return {
        get: cell.get.bind(cell),
    }
}

export function clear() {
    const copy = new Set(Cell.Pending)
    for (let c of copy)
        c.unsubscribe()
}

/**@typedef {Object} Observable
 * @property {function} get - получает значение
 * @property {function} set - устанавливает новое значение
 */

/**@typedef {Object} Computed
 * @property {function} get - получает вычисленное значение
 */

/** Делает значение наблюдаемым
 * @param {*} [value] - наблюдаемое значение
 * @return Observable
 */
export function box(value) {
    return observableInterface(new Cell(value))
}

/**
 * @callback computedFunction
 * @return {*} value - вычисленное значение
*/

/**Создает вычисляемое значение, которое можно получить с помощью .get()
 * Перезапускается по необходимости при изменении её зависимостей
 * Если не произошло изменений зависимостей, не перезапускается.
 * Вызывается только по требованию: .get(), autorun()
 * @param {computedFunction} computedFn - функция, которая вычисляет значение.
 * @return Computed
 */
export function computed(computedFn) {
    return computedInterface(new Cell(null, computedFn))
}

/**Перезапускает effect при изменении его зависимостей.
 * @param {function} effect - функция, которая запускается при изменении её зависимостей
 * @return {function} функция, останавливающая перезапуски
 */
export function autorun(effect) {
    const cell = new Cell(null, effect, true)
    cell.get()
    return () => cell.unsubscribe()
}

/**При изменении результата выполнения fn запускается effect
 * @param {function} fn - функция, которая запускается при изменении её зависимостей
 * @param {function} effect - функция, которая запускается при изменении результата вызова fn
 * @param {boolean} fireImmediately - если передано true effect выполняется сразу
 * @return {function} функция, останавливающая перезапуски
 */
export function reaction(fn, effect, {fireImmediately=false} = {}) {
    return observe(computed(fn), effect, {fireImmediately})
}

/**effect выполняется один раз, когда fn возвращает true
 * @param {function} fn - функция
 * @param {function} effect - функция, которая запускается, когда fn возвращает true
 * @return {function} функция, которая отменяет выполнение эффекта
 */
export function when(fn, effect) {
    let immediate = true
    const stop = whenever(fn, function _whenEffect() {
        effect()
        if (!immediate)
            stop()
        immediate = false
    })
    if (!immediate)
        stop()
    immediate = false
    return stop
}

/**effect выполняется всегда, когда fn возвращает true
 * @param {function} fn - функция, которая запускается при изменении её зависимостей
 * @param {function} effect - функция, которая запускается при изменении результата вызова fn
 * @return {function} функция, останавливающая перезапуски
 */
export function whenever(fn, effect) {
    return reaction(fn, function _wheneverCheck(res) {res && effect()}, {fireImmediately: true})
}

/**. При изменении cell запускает effect, передавая ему значение cell
 * @param {Observable | Computed} cell - observable или computed, за которыми необходимо наблюдать
 * @param {function} cb - функция, которая запускается при изменении значения cell.
 * Принимает значение cell.get()
 * @param {Object} params - если передано true cb вызывается сразу
 * @return {function} функция, останавливающая перезапуски
 */
export function observe(cell, cb, {fireImmediately=false} = {}) {
    return autorun(function _observeEffect() {
        const res = cell.get()
        if(fireImmediately)
            cb(res)
        else
            fireImmediately = true
    })
}

/**. Делает свойства объекта наблюдаемыми, может устанавливать свойство в computed с помощью get()
 * @param {Object} object - Объект, свойства которого должны стать наблюдаемыми
 * @param {Object} decorator - Объект, пара ключ-значение в котором
 * представлены названием наблюдаемого свойства и типом, которое определяет его поведение
 */
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

/**. Делает наблюдаемыми элементы массива а так же его длину
 * @param {Array} arr - Массив, элементы и длина которого должны стать наблюдаемыми
 */
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
        },
        deleteProperty(target, prop) {
            if (map.has(prop)) {
                map.get(prop).set(undefined)
            }
            return delete target[prop]
        },
    })
}

/**. Делает наблюдаемыми свойства объекта
 * @param {Object} obj - Объект, свойства которого должны стать наблюдаемыми
 */
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
            if (!map.has(prop))
                map.set(prop, box())
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
        },
        deleteProperty(target, prop) {
            if (map.has(prop)) {
                map.get(prop).set(undefined)
                dump.set(!dump.get())
            }
            return delete target[prop]
        },
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

export function isObservableObject(o) {
    return isObject(o) && ($s in o)
}

export function observeObject(o, effect) {
    if (!isObservableObject(o))
        throw TypeError('First argument should be an observable object')
    let prev
    return autorun(function _observeObjectCheck() {
        Object.entries(o) // to trigger autorun on keys and values changing
        if (prev && !areEqualShallow(prev, o))
            effect(o)
        prev = {...o}
    })
}

export function areEqualShallow(a, b) {
    if (a === b)
        return true
    for(let key of Object.keys(a)) {
        if(!(key in b) || a[key] !== b[key]) {
            return false
        }
    }
    for(let key of Object.keys(b)) {
        if(!(key in a) || a[key] !== b[key]) {
            return false
        }
    }
    return true
}