
const fs = require('fs-extra')
const { processDefinitions, processDefinitionsEnum } = require('./bw-dictionary')
const xmlparser = require('fast-xml-parser')

const readDotFolder = file => {
    const data = fs.readFileSync(file, 'utf-8')
    const root = xmlparser.parse(data, { ignoreAttributes: false })
    const folder = root['Repository:repository']['folder']
    if (folder && folder['@_resourceType'] == 'ae.rootfolder') {
        return folder['@_name']
    }
    return null
}

module.exports = { readDotFolder }