
const path = require('path')
const fs = require('fs-extra')
const pug = require('pug')

const writeHtml = (htmlFile, json) => {
    const html = pug.renderFile(path.resolve(__dirname, 'main.pug'), json)
    fs.writeFile(htmlFile, html)
}

module.exports = writeHtml