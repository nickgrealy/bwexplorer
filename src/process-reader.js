
const fs = require('fs-extra')
const { processDefinitions, processDefinitionsEnum } = require('./bw-dictionary')
const xmlparser = require('fast-xml-parser')

const readProcesses = (file, process) => {
    return fs.readFile(file, 'utf-8')
        .then(data => {
            var root = xmlparser.parse(data)
            var activities = [
                root['pd:ProcessDefinition']['pd:starter']
            ]
            var starter = root['pd:ProcessDefinition']['pd:starter']
            var activities = root['pd:ProcessDefinition']['pd:activity']
            activities = Array.isArray(activities) ? activities : [activities]
            if (starter) {
                starter.starter = true
                activities.push(starter)
            }
            activities = activities.filter(a => a)
                .filter(a => processDefinitionsEnum.indexOf(a['pd:type']) !== -1)
                .map(a => {
                    const type = a['pd:type']
                    const starter = a.starter
                    const direction = processDefinitions[type].direction
                    let destinations
                    if (a.config && a.config.SessionAttributes && a.config.SessionAttributes.destination) {
                        const d = a.config.SessionAttributes.destination
                        if (d) 
                            destinations = [d]
                    }
                    return { process, type, destinations, starter, direction }
                })
            return activities
        })
}

module.exports = { readProcesses }