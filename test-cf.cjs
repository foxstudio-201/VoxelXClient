fetch('https://api.curse.tools/v1/cf/mods/search?gameId=432&searchFilter=jei&pageSize=1', {
  headers: { 'User-Agent': 'Mozilla/5.0' }
})
.then(r => r.json())
.then(r => console.log(r.data ? r.data[0].name : r))
.catch(console.error)
