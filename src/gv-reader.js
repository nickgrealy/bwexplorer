
const fs = require('fs-extra')
const xmlparser = require('fast-xml-parser')

const readGvs = (file, prefix) => {
    return fs.readFile(file, 'utf-8').then(data => {
        const root = xmlparser.parse(data)
        const tmp = root.repository.globalVariables.globalVariable
        const gvs = (Array.isArray(tmp) ? tmp : [tmp]).reduce((prev, curr) => {
            prev[prefix + curr.name] = curr.value
            return prev
        }, {})
        return gvs
    })
}

module.exports = { readGvs }