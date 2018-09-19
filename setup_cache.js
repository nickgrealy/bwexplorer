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
            const deferJmsStarters = defer()
            const deferGlobalVariables = defer()
            const promises = [
                deferJmsStarters.promise,
                deferGlobalVariables.promise
            ]

            // find starter JMS processes...
            Walker(project.dir).on('file', (file, stat) => {
                const PD_TYPE = '<pd:type>com.tibco.plugin.jms.JMSQueueEventSource</pd:type>'
                const DEST_START = '<destination>'
                const DEST_END = '</destination>'
                if (file.endsWith('.process')) {

                    const deferParseFile = defer()
                    promises.push(deferParseFile.promise)
                    fs.readFile(file, 'utf-8').then(data => {
                        let idx = data.indexOf(PD_TYPE)
                        while (idx > -1) {
                            const start = data.indexOf(DEST_START, idx)
                            const end = data.indexOf(DEST_END, start)
                            const process = getRelativeDir(file)
                            const destination = data.substring(start + DEST_START.length, end)
                            project.integrations.push({ process, destination })

                            // find next (if any)...
                            idx = data.indexOf(PD_TYPE, end)
                        }
                        deferParseFile.resolve()
                    })
                }
            }).on('end', () => deferJmsStarters.resolve())

            // find global variables...
            const gvsdir = path.resolve(project.dir, 'defaultVars')
            Walker(gvsdir).on('file', (file, stat) => {
                    let prefix = path.dirname(file).split(gvsdir).pop().replace(/\\/g, '/') + '/'
                    if (prefix.startsWith('/'))
                        prefix = prefix.substring(1)

                    const deferParseFile = defer()
                    promises.push(deferParseFile.promise)
                    fs.readFile(file)
                        .then(data => {
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
                        // sort the gvs...
                        const sorted = new Map()
                        Object.keys(project.gvs).sort().forEach(k => sorted.set(k, project.gvs[k]))
                        project.gvs = sorted
                        deferGlobalVariables.resolve()
                    })
                    
            Promise.all(promises).then(() => {

                // attempt to resolve any JMS queues from the global variables...
                project.integrations.forEach(i => {
                    i.destResolved = i.destination.startsWith('%') ? project.gvs[i.destination.replace(/%/g, '')] : i.destination
                })

                // sort integrations...
                project.integrations = project.integrations.sort((a, b) => a.process.localeCompare(b.process))

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