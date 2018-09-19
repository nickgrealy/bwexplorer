
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

module.exports = { defer, regexExec }