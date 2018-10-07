#!/usr/bin/env node

const fs = require('fs-extra')
const path = require('path')

fs.readdir('.bwexplorer')
    .then(files => Promise.all(files.filter(f => f.endsWith('.json')).map(f => fs.readJson(path.join('.bwexplorer', f)))))
    .then(jsonArray => {
        console.log(JSON.stringify(json, null, 2))
    })
