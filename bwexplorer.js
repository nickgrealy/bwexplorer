#!/usr/bin/env node

const path = require('path')
const fs = require('fs-extra')
const Walker = require('walker')
const writeHtml = require('./src/generate-html')
const { readDotFolder } = require('./src/dotfolder-reader')
const { readGvs } = require('./src/gv-reader')
const { readProcesses } = require('./src/process-reader')
const { defer, regexExec } = require('./src/utils')

const cwd = path.resolve(process.cwd())
const basedir = path.resolve(cwd, process.argv[process.argv.length - 1])
const getRelativeDir = dir => dir.split(basedir).pop()

console.log(`Used last argument to create base directory: ${basedir}`)

if (!fs.existsSync(basedir))
    throw Error(`Directory ${basedir} doesn't exist`)

// find BW project dirs...
const projects = []
Walker(basedir).filterDir(dir => {
        const meta = path.resolve(dir, '.folder')
        if (fs.existsSync(meta)) {
            const name = readDotFolder(meta)
            if (name !== null) {
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

            // setup promises...s
            const deferServiceStarters = defer()
            const deferGlobalVariables = defer()
            const promises = [
                deferServiceStarters.promise,
                deferGlobalVariables.promise
            ]

            // find integration activities...
            const waitForProcesses = []
            Walker(project.dir).on('file', file => {
                
                if (file.endsWith('.process')) {
                    const process = getRelativeDir(file)
                    waitForProcesses.push(readProcesses(file, process).then(activities => {
                        project.integrations = project.integrations.concat(activities)
                    }))

                } else if (file.endsWith('.serviceagent')) {

                    const SOAP_RECV_REGEX = /(?:<httpURI>([^<]+)<\/httpURI>)/g
                    const deferParseFile = defer()
                    waitForProcesses.push(deferParseFile.promise)
                    fs.readFile(file, 'utf-8').then(data => {

                        // search for SOAP endpoints...
                        const destinations = regexExec(SOAP_RECV_REGEX, data)
                        if (destinations.length > 0) {
                            const type = 'SOAPServiceAgent'
                            const process = getRelativeDir(file)
                            project.integrations.push({ type, process, destinations, direction: 'IN', starter: true })
                            deferParseFile.resolve()
                        }
                    })

                }
            }).on('end', () => {
                Promise.all(waitForProcesses).then(() => deferServiceStarters.resolve())
            })

            // find global variables...
            const waitForGlobalVariables = []
            const gvsdir = path.resolve(project.dir, 'defaultVars')
            Walker(gvsdir).on('file', file => {
                    let prefix = path.dirname(file).split(gvsdir).pop().replace(/\\/g, '/') + '/'
                    if (prefix.startsWith('/'))
                        prefix = prefix.substring(1)

                    waitForGlobalVariables.push(readGvs(file, prefix).then(gvs => {
                        Object.assign(project.gvs, gvs)
                    }))

                }).on('end', () => {
                    Promise.all(waitForGlobalVariables).then(() => {
                        // sort the gvs...
                        const sorted = {}
                        Object.keys(project.gvs).sort().forEach(k => sorted[k] = project.gvs[k])
                        project.gvs = sorted
                        deferGlobalVariables.resolve()
                    })
                })
                    
            Promise.all(promises).then(() => {

                // attempt to resolve any JMS queues from the global variables...
                project.integrations.forEach(i => {
                    if (i.destinations) {
                        i.destsResolved = i.destinations.map(d => {
                            return d.startsWith('%') ? project.gvs[d.replace(/%/g, '')] : d
                        })
                    }
                })

                // sort integrations...
                project.integrations = project.integrations.sort((a, b) => a.type.localeCompare(b.type) || a.process.localeCompare(b.process))

                // write project files to cache...
                const filename = project.reldir !== '' ? project.reldir.replace(/\\|\//g, '_') : project.name
                console.log(`Writing project metadata "${filename}" to cache`)
                const cacheFile = path.resolve(cacheDir, `${filename}.json`)
                const htmlFile = path.resolve(cacheDir, `${filename}.html`)
                if (fs.existsSync(cacheFile)) {
                    console.log(`Error: cache already exists! ${cacheFile}`)
                } else {
                    fs.writeJson(cacheFile, project, { spaces: 2 })
                    writeHtml(htmlFile, project)
                }
            })
        })
    })