const path = require('path')
const fs = require('fs-extra')
const Walker = require('walker')
const { parseString } = require('xml2js')

const dir = path.resolve(__dirname, process.argv[process.argv.length - 1])

console.log(`Used last argument to create base directory: ${dir}`)

if (!fs.existsSync(dir))
    throw Error(`Directory ${dir} doesn't exist`)

// find BW project dirs...
const projects = []
Walker(dir).filterDir((dir, stat) => {
        const meta = path.resolve(dir, '.folder')
        if (fs.existsSync(meta)) {
            const text = fs.readFileSync(meta)
            if (text.indexOf('resourceType="ae.rootfolder"') !== -1) {
                const name = /name="([^"]+)"/.exec(text)[1]
                projects.push({ name, dir, gvs: {} })
                return false
            }
        }
        return true
    })
    .on('end', () => {
        console.log('Found projects:', projects.map(p => p.name))
        const cacheDir = path.resolve(__dirname, '.bwexplorer')
        const promises = [fs.mkdirp(cacheDir)]

        // find globalVariables from project...
        projects.forEach(project => {
            Walker(path.resolve(project.dir, 'defaultVars')).on('file', (file, stat) => {
                    promises.push(fs.readFile(file)
                        .then(data => {
                            parseString(data, function(err, result) {
                                if (err)
                                    return new Error(err)
                                const gvs = result.repository.globalVariables[0].globalVariable.reduce((prev, curr) => {
                                    prev[curr.name[0]] = curr.value[0]
                                    return prev
                                }, {})
                                Object.assign(project.gvs, gvs)
                            });
                        }))
                })
                .on('end', () => {

                    // write project files to cache...
                    Promise.all(promises).then(() => {
                        console.log('Writing projects to cache')
                        projects.forEach(project => {
                            const cache = path.resolve(cacheDir, project.name + '.json')
                            if (fs.existsSync(cache))
                                console.log(`Error: cache already exists! ${cache}`)
                            else
                                fs.writeJson(cache, project, { spaces: 2 })
                        })
                    })
                })
        })
    })