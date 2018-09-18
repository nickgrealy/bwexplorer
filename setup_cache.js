#!/usr/bin/env node

const path = require('path')
const fs = require('fs-extra')
const Walker = require('walker')
const { parseString } = require('xml2js')

const cwd = path.resolve(process.cwd())
const basedir = path.resolve(cwd, process.argv[process.argv.length - 1])

console.log(`Used last argument to create base directory: ${basedir}`)

if (!fs.existsSync(basedir))
    throw Error(`Directory ${basedir} doesn't exist`)

// find BW project dirs...
const projects = []
Walker(basedir).filterDir((dir, stat) => {
        const meta = path.resolve(dir, '.folder')
        if (fs.existsSync(meta)) {
            const text = fs.readFileSync(meta)
            if (text.indexOf('resourceType="ae.rootfolder"') !== -1) {
                const name = /name="([^"]+)"/.exec(text)[1]
                const reldir = dir.split(basedir).pop()
                projects.push({ name, dir, reldir, gvs: {} })
                return false
            }
        }
        return true
    })
    .on('end', () => {
        console.log('Found projects:', projects.map(p => p.name))
        const cacheDir = path.resolve(cwd, '.bwexplorer')
        fs.mkdirpSync(cacheDir)

        // find globalVariables from project...
        projects.forEach(project => {
            const promises = []
            const gvsdir = path.resolve(project.dir, 'defaultVars')
            Walker(gvsdir).on('file', (file, stat) => {
                    const prefix = path.dirname(file).split(gvsdir).pop().replace(/\\/g, '/') + '/'
                    promises.push(fs.readFile(file)
                        .then(data => {
                            parseString(data, function(err, result) {
                                if (err)
                                    return new Error(err)
                                const gvs = result.repository.globalVariables[0].globalVariable.reduce((prev, curr) => {
                                    prev[prefix + curr.name[0]] = curr.value[0]
                                    return prev
                                }, {})
                                Object.assign(project.gvs, gvs)
                            });
                        }))
                })
                .on('end', () => {
        
                    // write project files to cache...
                    Promise.all(promises).then(() => {
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
    })