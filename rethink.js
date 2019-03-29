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
 * @param {Object} params - если передано true effect выполняется сразу
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
    const stop = whenever(fn, () => {
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
    return reaction(fn, res => res && effect(), {fireImmediately: true})
}

/**. При изменении cell запускает effect, передавая ему значение cell
 * @param {Observable | Computed} cell - observable или computed, за которыми необходимо наблюдать
 * @param {function} cb - функция, которая запускается при изменении значения cell.
 * Принимает значение cell.get()
 * @param {Object} params - если передано true cb вызывается сразу
 * @return {function} функция, останавливающая перезапуски
 */
export function observe(cell, cb, {fireImmediately=false} = {}) {
    return autorun(() => {
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
        }
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
