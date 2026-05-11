const https = require('https')

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'Accept': 'application/json' } }, (res) => {
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => {
        try { resolve(JSON.parse(data)) }
        catch (e) { reject(e) }
      })
    }).on('error', reject)
  })
}

fetchJson('https://api.curse.tools/v1/cf/mods/search?gameId=432&searchFilter=jei&pageSize=1')
  .then(console.log)
  .catch(console.error)
