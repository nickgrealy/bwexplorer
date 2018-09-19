#!/usr/bin/env node

const path = require('path')
const fs = require('fs-extra')
const Walker = require('walker')
const { parseString } = require('xml2js')

const cwd = path.resolve(process.cwd())
const basedir = path.resolve(cwd, process.argv[process.argv.length - 1])
const getRelativeDir = dir => dir.split(basedir).pop()

console.log(`Used last argument to create base directory: ${basedir}`)

if (!fs.existsSync(basedir))
    throw Error(`Directory ${basedir} doesn't exist`)

const defer = () => {
    const d = {}
    d.promise = new Promise((resolve, reject) => {
        d.resolve = resolve
        d.reject = reject
    })
    return d
}

const regexExec = (re, str) => {
    var match = null
    var matches = []
    while ((match = re.exec(str)) !== null) {
      matches.push(match[1])
    }
    return matches
}

// find BW project dirs...
const projects = []
Walker(basedir).filterDir((dir, stat) => {
        const meta = path.resolve(dir, '.folder')
        if (fs.existsSync(meta)) {
            const text = fs.readFileSync(meta)
            if (text.indexOf('resourceType="ae.rootfolder"') !== -1) {
                const name = /name="([^"]+)"/.exec(text)[1]
                const reldir = getRelativeDir(dir)
                projects.push({ name, dir, reldir, gvs: {}, integrations: [] })
                return false
            }
        }
        return true
    })
    .on('end', () => {
        console.log('Found projects:', projects.map(p => p.name))
        const cacheDir = path.resolve(cwd, '.bwexplorer')
        fs.mkdirpSync(cacheDir)

        projects.forEach(project => {

            // setup promises...
            const deferServiceStarters = defer()
            const deferGlobalVariables = defer()
            const promises = [
                deferServiceStarters.promise,
                deferGlobalVariables.promise
            ]

            // find starter JMS processes...
            const waitForProcesses = []
            Walker(project.dir).on('file', (file, stat) => {
                const JMS_RECV_TYPE = '<pd:type>com.tibco.plugin.jms.JMSQueueEventSource</pd:type>'
                const DEST_START = '<destination>'
                const DEST_END = '</destination>'
                const SOAP_RECV_REGEX = /(?:<httpURI>([^<]+)<\/httpURI>)/g
                if (file.endsWith('.process')) {

                    const deferParseFile = defer()
                    waitForProcesses.push(deferParseFile.promise)
                    fs.readFile(file, 'utf-8').then(data => {

                        // search for JMS...
                        let idx = data.indexOf(JMS_RECV_TYPE)
                        while (idx > -1) {
                            const start = data.indexOf(DEST_START, idx)
                            const end = data.indexOf(DEST_END, start)
                            const type = 'JMSQueueEventSource'
                            const process = getRelativeDir(file)
                            const destinations = [data.substring(start + DEST_START.length, end)]
                            project.integrations.push({ type, process, destinations })

                            // find next (if any)...
                            idx = data.indexOf(JMS_RECV_TYPE, end)
                        }
                        deferParseFile.resolve()
                    })

                } else if (file.endsWith('.serviceagent')) {

                    const deferParseFile = defer()
                    waitForProcesses.push(deferParseFile.promise)
                    fs.readFile(file, 'utf-8').then(data => {

                        // search for SOAP endpoints...
                        const destinations = regexExec(SOAP_RECV_REGEX, data)
                        if (destinations.length > 0) {
                            const type = 'SOAP'
                            const process = getRelativeDir(file)
                            project.integrations.push({ type, process, destinations })
                            deferParseFile.resolve()
                        }
                    })

                }
            }).on('end', () => {
                // console.log(`${project.reldir} - Processes - waiting for ${waitForProcesses.length} promises...`)
                Promise.all(waitForProcesses).then(() => deferServiceStarters.resolve())
            })

            // find global variables...
            const waitForGlobalVariables = []
            const gvsdir = path.resolve(project.dir, 'defaultVars')
            Walker(gvsdir).on('file', (file, stat) => {
                    let prefix = path.dirname(file).split(gvsdir).pop().replace(/\\/g, '/') + '/'
                    if (prefix.startsWith('/'))
                        prefix = prefix.substring(1)

                    const deferParseFile = defer()
                    waitForGlobalVariables.push(deferParseFile.promise)
                    fs.readFile(file)
                        .then(data => {
                            // after read file, parse xml to json...
                            parseString(data, function(err, result) {
                                if (err)
                                    return new Error(err)
                                const gvs = result.repository.globalVariables[0].globalVariable.reduce((prev, curr) => {
                                    prev[prefix + curr.name[0]] = curr.value[0]
                                    return prev
                                }, {})
                                Object.assign(project.gvs, gvs)
                                deferParseFile.resolve()
                            });
                        })
                    }).on('end', () => {
                        // console.log(`${project.reldir} - GVs - waiting for ${waitForGlobalVariables.length} promises...`)
                        Promise.all(waitForGlobalVariables).then(() => {
                            // sort the gvs...
                            const sorted = {}
                            Object.keys(project.gvs).sort().forEach(k => sorted[k] = project.gvs[k])
                            project.gvs = sorted
                            deferGlobalVariables.resolve()
                        })
                    })
                    
            // console.log(`${project.reldir} - Final - waiting for ${promises.length} promises...`)
            Promise.all(promises).then(() => {

                // attempt to resolve any JMS queues from the global variables...
                project.integrations.forEach(i => {
                    i.destsResolved = i.destinations.map(d => {
                        return d.startsWith('%') ? project.gvs[d.replace(/%/g, '')] : d
                    })
                })

                // sort integrations...
                project.integrations = project.integrations.sort((a, b) => a.type.localeCompare(b.type) || a.process.localeCompare(b.process))

                // write project files to cache...
                const filename = project.reldir !== '' ? project.reldir.replace(/\\|\//g, '_') : project.name
                console.log(`Writing project metadata "${filename}" to cache`)
                const cache = path.resolve(cacheDir, `${filename}.json`)
                if (fs.existsSync(cache))
                    console.log(`Error: cache already exists! ${cache}`)
                else
                    fs.writeJson(cache, project, { spaces: 2 })
            })
        })
    })